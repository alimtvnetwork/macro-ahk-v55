/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { UrlMatchType, UrlTabClickFailureModeType, SelectorKindType, OkTabnotfoundType, PredicateEvaluationKindType, ValidationErrorReasonType } from "../../types/enums";
import { compileUrlPattern, CompileResult, splitForCaseFold } from "./url-tab-click-patterns";

/**
 * Marco Extension — UrlTabClick Step (Spec 19 §1)
 *
 * A capture/replay step kind (`StepKindId = 9`) that resolves a click
 * action against a tab whose URL matches a declared pattern, choosing
 * between three behaviours based on the current workspace tabs:
 *
 *   - `OpenNew`        — always open a new tab.
 *   - `FocusExisting`  — focus a matching tab; fail if none exists.
 *   - `OpenOrFocus`    — focus a matching tab if present, else open a new one.
 *
 * Pure module: no chrome.* / DOM dependencies. The runner injects a
 * `TabsAdapter` so this file stays unit-testable. Failures are returned as
 * structured objects per the project failure-diagnostics standard.
 *
 * @see spec/31-macro-recorder/19-url-tabs-appearance-waits-conditions.md §1
 * @see mem://standards/verbose-logging-and-failure-diagnostics
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type UrlMatchDialect = UrlMatchType;
export type UrlTabClickMode = UrlTabClickFailureModeType;
export type SelectorKindOption = SelectorKindType;

export interface UrlTabClickParams {
    readonly UrlPattern: string;
    readonly UrlMatch: UrlMatchDialect;
    readonly OperationModeType: UrlTabClickMode;
    readonly Selector?: string;
    readonly SelectorKind?: SelectorKindOption;
    readonly TimeoutMs?: number;
    readonly DirectOpen: boolean;
    readonly Url?: string;
}

export type UrlTabClickReason =
    OkTabnotfoundType;

export interface UrlTabClickResult {
    readonly Reason: UrlTabClickReason;
    readonly ResolvedTabId?: number;
    readonly ResolvedUrl?: string;
    readonly Pattern: string;
    readonly Dialect: UrlMatchDialect;
    readonly OperationModeType: UrlTabClickMode;
    readonly DurationMs: number;
    readonly OpenedNewTab: boolean;
    readonly Detail?: string;
}

export interface TabRef {
    readonly Id: number;
    readonly Url: string;
}

export interface TabsAdapter {
    listTabs(): Promise<ReadonlyArray<TabRef>>;
    focusTab(id: number): Promise<void>;
    createTab(url: string): Promise<TabRef>;
    /** Dispatch the captured click; returns the URL of the resulting tab. */
    dispatchClick?(selector: string, kind: PredicateEvaluationKindType): Promise<TabRef>;
    /** Wait for an updated tab whose URL matches `predicate` within deadline. */
    waitForMatchingTab(
        predicate: (url: string) => boolean,
        deadlineMs: number,
    ): Promise<TabRef | null>;
}

export interface ExecuteUrlTabClickInit {
    readonly Params: UrlTabClickParams;
    readonly Tabs: TabsAdapter;
    readonly NowMs?: () => number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/* ------------------------------------------------------------------ */
/*  Save-time validation                                               */
/* ------------------------------------------------------------------ */

export interface ValidationError {
    readonly Reason: ValidationErrorReasonType;
    readonly Detail: string;
}

function validateDirectOpen(params: UrlTabClickParams): ValidationError | null {
  if (params.DirectOpen !== true) {
    return null;
  }

  if (params.OperationModeType !== "OpenNew") {
    return { Reason: "BadParams", Detail: "DirectOpen requires Mode='OpenNew'" };
  }

  if (params.Url === undefined || params.Url === "") {
    return { Reason: "InvalidUrlPattern", Detail: "DirectOpen requires a literal Url" };
  }

  return null;
}

export function validateUrlTabClickParams(
  params: UrlTabClickParams,
): ValidationError | null {
  const directErr = validateDirectOpen(params);

  if (directErr !== null) {
    return directErr;
  }

  if (params.TimeoutMs !== undefined && params.TimeoutMs < 0) {
    return { Reason: "BadParams", Detail: "TimeoutMs must be ≥ 0" };
  }

  const compiled = compileUrlPattern(params.UrlPattern, params.UrlMatch);

  if (compiled.Ok === false) {
    return { Reason: "InvalidUrlPattern", Detail: compiled.Detail };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Capture-time pattern derivation                                    */
/* ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Derive a default `Glob` pattern from an observed URL: numeric segments
 * and UUIDs become `*`, query string is stripped. Used at capture time
 * (AC-19.1.1 / 19.1.2).
 */
export function deriveGlobPattern(url: string): string {
  const noQuery = url.split("?")[0].split("#")[0];
  const split = splitForCaseFold(noQuery);

  if (split.Lead === "") {
    return noQuery;
  }

  const segments = split.Tail.split("/").map((seg) => {
    if (seg === "") {
      return seg;
    }

    if (/^\d+$/.test(seg)) {
      return "*";
    }

    if (UUID_RE.test(seg)) {
      return "*";
    }

    return seg;
  });

  return split.Lead + segments.join("/");
}

export interface CaptureClickContext {
    readonly Tag: string;                        // lowercase tag
    readonly Target?: string;                    // anchor `target` attribute
    readonly Href?: string;                      // resolved href
    readonly LocationOrigin: string;             // current page origin
    readonly OpenedTabUrl?: string;              // observed tab url, if any
    readonly WindowOpenCalled: boolean;          // capture proxy fired
}

function isCrossOriginHref(href: string, locationOrigin: string): boolean {
  try {
    return new URL(href).origin !== new URL(locationOrigin).origin;
  } catch { // allow-swallow: malformed href (e.g. "javascript:", relative-only) — treat as same-origin.
    return false;
  }
}

/**
 * Returns true when a click should be persisted as `UrlTabClick`
 * (StepKindId = 9) instead of plain `Click`. Mirrors AC-19.1.1/2 and
 * spec §1.4 detection rules 1–4.
 */
export function shouldRecordAsUrlTabClick(ctx: CaptureClickContext): boolean {
  if (ctx.Tag === "a" && ctx.Target === "_blank") {
    return true;
  }

  if (hasCrossOriginAnchorHref(ctx)) {
    return true;
  }

  if (ctx.WindowOpenCalled) {
    return true;
  }

  if (ctx.OpenedTabUrl !== undefined && ctx.OpenedTabUrl !== "") {
    return true;
  }

  return false;
}

function hasCrossOriginAnchorHref(context: CaptureClickContext): boolean {
  return context.Tag === "a"
        && context.Href !== undefined
        && context.Href !== ""
        && isCrossOriginHref(context.Href, context.LocationOrigin);
}

/* ------------------------------------------------------------------ */
/*  Replay                                                              */
/* ------------------------------------------------------------------ */

function selectorKind(params: UrlTabClickParams): PredicateEvaluationKindType {
  const kind = params.SelectorKind ?? "Auto";

  if (kind === "XPath") {
    return "XPath";
  }

  if (kind === "Css") {
    return "Css";
  }

  const sel = (params.Selector ?? "").trim();

  if (sel.startsWith("/") || sel.startsWith("(")) {
    return "XPath";
  }

  return "Css";
}

interface ResultBase {
    readonly params: UrlTabClickParams;
    readonly now: () => number;
    readonly startedAt: number;
}

function buildResult(
  base: ResultBase,
  reason: UrlTabClickReason,
  extras: Partial<UrlTabClickResult> = {},
): UrlTabClickResult {
  return {
    Reason: reason,
    Pattern: base.params.UrlPattern,
    Dialect: base.params.UrlMatch,
    OperationModeType: base.params.OperationModeType,
    DurationMs: base.now() - base.startedAt,
    OpenedNewTab: false,
    ...extras,
  };
}

async function tryFocusExisting(
  base: ResultBase,
  tabs: TabsAdapter,
  test: (url: string) => boolean,
): Promise<UrlTabClickResult | null> {
  const existing = await tabs.listTabs();
  const hit = existing.find((t) => test(t.Url));

  if (hit !== undefined) {
    await tabs.focusTab(hit.Id);

    return buildResult(base, "Ok", { ResolvedTabId: hit.Id, ResolvedUrl: hit.Url });
  }

  if (base.params.OperationModeType === "FocusExisting") {
    return buildResult(base, "TabNotFound", { Detail: `no tab matched ${base.params.UrlPattern}` });
  }

  return null;
}

type OpenOutcome = { readonly Kind: "opened"; readonly Tab: TabRef } | { readonly Kind: "error"; readonly Result: UrlTabClickResult };

async function openViaDirect(base: ResultBase, tabs: TabsAdapter): Promise<OpenOutcome> {
  const url = base.params.Url ?? "";
  const tab = await tabs.createTab(url);

  return { Kind: "opened", Tab: tab };
}

async function openViaSelector(base: ResultBase, tabs: TabsAdapter): Promise<OpenOutcome> {
  if (tabs.dispatchClick === undefined) {
    return { Kind: "error", Result: buildResult(base, "BadParams", { Detail: "TabsAdapter.dispatchClick missing" }) };
  }

  const sel = base.params.Selector ?? "";
  const tab = await tabs.dispatchClick(sel, selectorKind(base.params));

  return { Kind: "opened", Tab: tab };
}

async function openNewTab(base: ResultBase, tabs: TabsAdapter): Promise<OpenOutcome> {
  const { params } = base;
  try {
    if (params.DirectOpen === true && params.Url !== undefined) {
      return await openViaDirect(base, tabs);
    }

    if (params.Selector !== undefined && params.Selector !== "") {
      return await openViaSelector(base, tabs);
    }

    return { Kind: "error", Result: buildResult(base, "BadParams", { Detail: "OpenNew requires either DirectOpen+Url or Selector" }) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "click dispatch failed";

    return { Kind: "error", Result: buildResult(base, "SelectorNotFound", { Detail: detail }) };
  }
}

function settledResult(base: ResultBase, opened: TabRef | null, settled: TabRef | null): UrlTabClickResult {
  if (settled !== null) {
    return buildResult(base, "Ok", { ResolvedTabId: settled.Id, ResolvedUrl: settled.Url, OpenedNewTab: true });
  }

  const observed = opened?.Url ?? "(none)";
  const reason: UrlTabClickReason = opened === null ? "UrlTabClickTimeout" : "UrlPatternMismatch";

  return buildResult(base, reason, {
    ResolvedTabId: opened?.Id,
    ResolvedUrl: opened?.Url,
    OpenedNewTab: opened !== null,
    Detail: `observed=${observed} pattern=${base.params.UrlPattern}`,
  });
}

async function awaitOpenedSettle(
  base: ResultBase,
  tabs: TabsAdapter,
  test: (url: string) => boolean,
  opened: TabRef,
  timeoutMs: number,
): Promise<UrlTabClickResult> {
  if (test(opened.Url)) {
    return buildResult(base, "Ok", { ResolvedTabId: opened.Id, ResolvedUrl: opened.Url, OpenedNewTab: true });
  }

  const remaining = Math.max(0, timeoutMs - (base.now() - base.startedAt));
  const settled = await tabs.waitForMatchingTab(test, remaining);

  return settledResult(base, opened, settled);
}

function precheck(base: ResultBase): { readonly test?: (url: string) => boolean; readonly error?: UrlTabClickResult } {
  const validation = validateUrlTabClickParams(base.params);
  const hasValidationError = validation !== null;

  if (hasValidationError) {
    const reason: UrlTabClickReason = validation.Reason === "BadParams" ? "BadParams" : "InvalidUrlPattern";

    return { error: buildResult(base, reason, { Detail: validation.Detail }) };
  }

  const compiled = compileUrlPattern(base.params.UrlPattern, base.params.UrlMatch);
  const isCompileFailed = compiled.Ok === false;

  if (isCompileFailed) {
    return { error: buildResult(base, "InvalidUrlPattern", { Detail: compiled.Detail }) };
  }

  return { test: compiled.Test };
}

export async function executeUrlTabClick(init: ExecuteUrlTabClickInit): Promise<UrlTabClickResult> {
  const now = init.NowMs ?? (() => Date.now());
  const base: ResultBase = { params: init.Params, now, startedAt: now() };

  return executeWithBase(base, init);
}

async function executeWithBase(base: ResultBase, init: ExecuteUrlTabClickInit): Promise<UrlTabClickResult> {
  const pre = precheck(base);
  const hasPrecheckError = pre.error !== undefined;

  if (hasPrecheckError) {
    return pre.error!;
  }
    
  const test = pre.test as (url: string) => boolean;
  const mode = init.Params.OperationModeType;
  const shouldTryFocus = mode === "FocusExisting" || mode === "OpenOrFocus";
    
  if (shouldTryFocus) {
    const focused = await tryFocusExisting(base, init.Tabs, test);
    const isFocused = focused !== null;

    if (isFocused) {
      return focused!;
    }
  }
    
  const outcome = await openNewTab(base, init.Tabs);
  const isErrorOutcome = outcome.Kind === "error";

  if (isErrorOutcome) {
    return outcome.Result;
  }
    
  const timeoutMs = init.Params.TimeoutMs ?? DEFAULT_TIMEOUT_MS;

  return awaitOpenedSettle(base, init.Tabs, test, outcome.Tab, timeoutMs);
}
