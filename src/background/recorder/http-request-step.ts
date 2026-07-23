/**
 * Marco Extension — HttpRequest Step (Spec 17 §3)
 *
 * A new replay step kind that performs an HTTP call, optionally interpolating
 * `{{Column}}` placeholders against the active data row. Intended for sending
 * collected form values back to a backend, or pulling fresh data mid-run.
 *
 * Pure module — no chrome.* / DOM dependencies. Failures are returned as a
 * structured object (not thrown) so the recorder failure pipeline can attach
 * verbose-log tail / row vars / selectors per the project standard.
 *
 * @see spec/31-macro-recorder/17-hover-highlighter-and-data-controllers.md §3
 * @see mem://standards/verbose-logging-and-failure-diagnostics
 */

export interface HttpRequestParams {
    readonly Url: string;
    readonly Method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    readonly HeadersJson?: string;
    readonly BodyJson?: string;
    readonly CaptureAs?: string;
    readonly TimeoutMs?: number;
}

export type HttpStepReason =
    | "Ok"
    | "EndpointHttpError"
    | "EndpointTimeout"
    | "EndpointParseError"
    | "BadParams";

export interface HttpStepResult {
    readonly Reason: HttpStepReason;
    readonly Status?: number;
    readonly ResponseSnippet?: string;
    readonly CapturedValue?: unknown;
    readonly ResolvedUrl: string;
    readonly ResolvedMethod: string;
    readonly ResolvedHeaders: Record<string, string>;
    readonly ResolvedBody?: string;
    readonly DurationMs: number;
}

export interface ExecuteHttpStepInit {
    readonly Params: HttpRequestParams;
    readonly Row: Record<string, string>;
    readonly FetchImpl?: typeof fetch;
    readonly NowMs?: () => number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const SNIPPET_LIMIT = 2048;

/* ------------------------------------------------------------------ */
/*  Template interpolation                                             */
/* ------------------------------------------------------------------ */

const TEMPLATE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function interpolateTemplate(
    template: string,
    row: Record<string, string>,
): string {
    return template.replace(TEMPLATE_PATTERN, (_match, key: string) => {
        const value = row[key];
        return value === undefined ? "" : value;
    });
}

function interpolateHeaders(
    raw: string | undefined,
    row: Record<string, string>,
): Record<string, string> {
    if (raw === undefined || raw === "") return {};
    const interpolated = interpolateTemplate(raw, row);
    let parsed: unknown;
    try {
        parsed = JSON.parse(interpolated);
    } catch {
        throw new Error("BadParams: HeadersJson is not valid JSON after interpolation");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("BadParams: HeadersJson must be a JSON object");
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = String(v);
    }
    return out;
}

/* ------------------------------------------------------------------ */
/*  Execute                                                            */
/* ------------------------------------------------------------------ */

interface HttpRequestContext {
    readonly url: string;
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string | undefined;
    readonly now: () => number;
    readonly startedAt: number;
}

export async function executeHttpStep(
    init: ExecuteHttpStepInit,
): Promise<HttpStepResult> {
    const fetchImpl = init.FetchImpl ?? fetch;
    const now = init.NowMs ?? (() => Date.now());
    const startedAt = now();
    const url = interpolateTemplate(init.Params.Url, init.Row);
    const method = init.Params.Method;
    const headersOutcome = tryInterpolateHeaders(init.Params.HeadersJson, init.Row);
    if (headersOutcome.error !== null) {
        return badParamsResult(url, method, now() - startedAt, headersOutcome.error);
    }
    const body = interpolateBody(init.Params.BodyJson, init.Row);
    const headers = withDefaultContentType(headersOutcome.headers, body);
    const context: HttpRequestContext = { url, method, headers, body, now, startedAt };
    return performHttpRequest(fetchImpl, context, init.Params);
}

function tryInterpolateHeaders(
    raw: string | undefined, row: Record<string, string>,
): { headers: Record<string, string>; error: string | null } {
    try {
        return { headers: interpolateHeaders(raw, row), error: null };
    } catch (err) {
        return { headers: {}, error: err instanceof Error ? err.message : String(err) };
    }
}

function interpolateBody(raw: string | undefined, row: Record<string, string>): string | undefined {
    if (raw === undefined || raw === "") { return undefined; }
    return interpolateTemplate(raw, row);
}

function withDefaultContentType(
    headers: Record<string, string>, body: string | undefined,
): Record<string, string> {
    if (body !== undefined && headers["Content-Type"] === undefined) {
        return { ...headers, "Content-Type": "application/json" };
    }
    return headers;
}

async function performHttpRequest(
    fetchImpl: typeof fetch, context: HttpRequestContext, params: HttpRequestParams,
): Promise<HttpStepResult> {
    const timeoutMs = params.TimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOutcome = await tryFetch(fetchImpl, context, controller);
    clearTimeout(timer);
    if (fetchOutcome.error !== null) {
        return networkFailureResult(context, fetchOutcome.error, controller.signal.aborted);
    }
    return processHttpResponse(fetchOutcome.response, context, params);
}

async function tryFetch(
    fetchImpl: typeof fetch, context: HttpRequestContext, controller: AbortController,
): Promise<{ response: Response; error: null } | { response: null; error: unknown }> {
    try {
        const response = await fetchImpl(context.url, {
            method: context.method,
            headers: context.headers,
            body: context.body,
            signal: controller.signal,
        });
        return { response, error: null };
    } catch (err) {
        return { response: null, error: err };
    }
}

async function processHttpResponse(
    response: Response, context: HttpRequestContext, params: HttpRequestParams,
): Promise<HttpStepResult> {
    const snippet = await safeReadSnippet(response);
    if (response.ok === false) {
        return httpErrorResult(response.status, snippet, context);
    }
    const captureOutcome = tryCaptureJson(snippet, params.CaptureAs);
    if (captureOutcome.error !== null) {
        return parseErrorResult(response.status, captureOutcome.error, context);
    }
    return okResult(response.status, snippet, captureOutcome.captured, context);
}

function tryCaptureJson(
    snippet: string, captureAs: string | undefined,
): { captured: unknown; error: string | null } {
    if (captureAs === undefined || captureAs === "") {
        return { captured: undefined, error: null };
    }
    try {
        return { captured: JSON.parse(snippet), error: null };
    } catch (err) {
        return { captured: undefined, error: err instanceof Error ? err.message : String(err) };
    }
}

function badParamsResult(
    url: string, method: string, durationMs: number, snippet: string,
): HttpStepResult {
    return {
        Reason: "BadParams", ResolvedUrl: url, ResolvedMethod: method,
        ResolvedHeaders: {}, DurationMs: durationMs, ResponseSnippet: snippet,
    };
}

function networkFailureResult(
    context: HttpRequestContext, err: unknown, aborted: boolean,
): HttpStepResult {
    return {
        Reason: aborted ? "EndpointTimeout" : "EndpointHttpError",
        ResolvedUrl: context.url, ResolvedMethod: context.method,
        ResolvedHeaders: context.headers, ResolvedBody: context.body,
        DurationMs: context.now() - context.startedAt,
        ResponseSnippet: err instanceof Error ? err.message : String(err),
    };
}

function httpErrorResult(
    status: number, snippet: string, context: HttpRequestContext,
): HttpStepResult {
    return {
        Reason: "EndpointHttpError", Status: status,
        ResolvedUrl: context.url, ResolvedMethod: context.method,
        ResolvedHeaders: context.headers, ResolvedBody: context.body,
        ResponseSnippet: snippet, DurationMs: context.now() - context.startedAt,
    };
}

function parseErrorResult(
    status: number, message: string, context: HttpRequestContext,
): HttpStepResult {
    return {
        Reason: "EndpointParseError", Status: status,
        ResolvedUrl: context.url, ResolvedMethod: context.method,
        ResolvedHeaders: context.headers, ResolvedBody: context.body,
        ResponseSnippet: message, DurationMs: context.now() - context.startedAt,
    };
}

function okResult(
    status: number, snippet: string, captured: unknown, context: HttpRequestContext,
): HttpStepResult {
    return {
        Reason: "Ok", Status: status,
        ResolvedUrl: context.url, ResolvedMethod: context.method,
        ResolvedHeaders: context.headers, ResolvedBody: context.body,
        ResponseSnippet: snippet, CapturedValue: captured,
        DurationMs: context.now() - context.startedAt,
    };
}

async function safeReadSnippet(response: Response): Promise<string> {
    try {
        const text = await response.text();
        return text.slice(0, SNIPPET_LIMIT);
    } catch {
        return "";
    }
}
