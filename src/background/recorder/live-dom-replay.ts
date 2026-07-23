/**
 * Marco Extension — Live-DOM Replay Executor
 *
 * Phase 09 — Macro Recorder.
 *
 * Consumes a list of persisted Steps + their selectors, locates each target
 * in the live DOM via {@link resolveStepSelector}, and dispatches a real
 * browser event (`click`, `input`, `change`, …) on it. This is the missing
 * caller side — the resolver is pure, and this module is the imperative
 * actuator.
 *
 * Pure event dispatch only — no chrome.* or messaging. Caller supplies the
 * Document and the binding/value lookup so the same code is unit-testable
 * under jsdom and shippable in the content script.
 *
 * @see ./replay-resolver.ts          — Pure selector resolution.
 * @see ./field-reference-resolver.ts — `{{Column}}` substitution for Type values.
 * @see spec/31-macro-recorder/12-record-replay-e2e-contract.md
 */

import { resolveStepSelector, type ResolvedSelector } from "./replay-resolver";
import {
    resolveFieldReferences,
    resolveFieldReferencesDetailed,
    type FieldRow,
    type VariableContext,
} from "./field-reference-resolver";
import type { PersistedSelector } from "./step-persistence";
import {
    saveReplayRun,
    type PersistedReplayRun,
    type ReplayStepResultDraft,
} from "./replay-run-persistence";
import {
    logFailure,
    type FailureReasonCode,
    type FailureReport,
} from "./failure-logger";
import { evaluateAllSelectors } from "./selector-attempt-evaluator";
import { resolveVerboseLogging } from "./verbose-logging";
import { waitForElement, type WaitForSpec } from "./wait-for-element";
import { readStepWait, type WaitConfig } from "./step-library/step-wait";
import {
    waitForCondition,
    type Condition,
    type ConditionWaitOutcome,
} from "./condition-evaluator";

const SOURCE_FILE = "src/background/recorder/live-dom-replay.ts";

export interface ReplayStepInput {
    readonly StepId: number;
    readonly Index: number;
    readonly Kind: "Click" | "Type" | "Select" | "Wait";
    readonly Selectors: ReadonlyArray<PersistedSelector>;
    /** For Type/Select — the literal value or a `{{Column}}` template. */
    readonly Value?: string;
    /** For Wait — milliseconds. */
    readonly WaitMs?: number;
    /**
     * Optional backend-controlled gate: after the action dispatches the
     * executor polls the live DOM until this selector resolves to an
     * `HTMLElement`, or fails the step on timeout. Applies to Click /
     * Type / Select only — Wait steps ignore it. See
     * {@link WaitForSpec} for the selector grammar.
     */
    readonly WaitFor?: WaitForSpec;
    /**
     * Spec-19 canonical pre-condition gate. When present, the executor
     * polls `Condition` against the live DOM **before** actuating the
     * step. On timeout:
     *   - `OnTimeout = "Fail"` → step fails with `ConditionTimeout`.
     *   - `OnTimeout = "Skip"` → step is skipped (no actuation, not a
     *     failure).
     */
    readonly Gate?: StepGate;
}

export interface StepGate {
    readonly Condition: Condition;
    readonly TimeoutMs: number;
    readonly PollMs?: number;
    readonly OnTimeout: "Fail" | "Skip";
}

export interface ReplayPersistOptions {
    /** Project slug whose per-project DB receives the run row. */
    readonly ProjectSlug: string;
    /** Optional free-text notes attached to the persisted ReplayRun. */
    readonly Notes?: string;
}

export interface ReplayOptions {
    readonly Doc: Document;
    /** Active data-source row used to resolve `{{Column}}` templates in Value. */
    readonly Row?: FieldRow;
    /** Sleep implementation — injected so tests can fast-forward. */
    readonly Sleep?: (ms: number) => Promise<void>;
    /** Wall-clock provider — injected so tests get deterministic timestamps. */
    readonly Now?: () => Date;
    /**
     * When provided, the run + per-step results are persisted to the project
     * DB after `executeReplay` finishes. Tests omit this to stay pure.
     */
    readonly Persist?: ReplayPersistOptions;
    /**
     * Verbose-logging override. When `undefined` (default), the replay
     * resolves the toggle via
     * `resolveVerboseLogging(Persist?.ProjectSlug)`. When set explicitly,
     * the value wins — used by tests and by callers who already know the
     * effective flag (e.g. settings preview). Per
     * `mem://standards/verbose-logging-and-failure-diagnostics`, default
     * remains OFF; callers must opt in.
     */
    readonly Verbose?: boolean;
}

export interface ReplayStepResult {
    readonly StepId: number;
    readonly Index: number;
    readonly Ok: boolean;
    readonly Error?: string;
    readonly ResolvedXPath?: string;
    readonly StartedAt: string;
    readonly FinishedAt: string;
    readonly DurationMs: number;
    /** Structured failure report — populated only when `Ok === false`. */
    readonly FailureReport?: FailureReport;
    /**
     * When `true`, the step was intentionally skipped because its
     * pre-condition gate timed out with `OnTimeout = "Skip"`. Not a
     * failure — `Ok` is also `true`.
     */
    readonly Skipped?: true;
}

export interface ReplayRunOutcome {
    readonly Results: ReadonlyArray<ReplayStepResult>;
    readonly StartedAt: string;
    readonly FinishedAt: string;
    /** Populated only when `options.Persist` was supplied and the save succeeded. */
    readonly PersistedRun: PersistedReplayRun | null;
}

async function persistIfRequested(
    options: ReplayOptions,
    results: ReplayStepResult[],
    startedAt: string,
    finishedAt: string,
): Promise<PersistedReplayRun | null> {
    if (options.Persist === undefined) return null;
    return saveReplayRun(options.Persist.ProjectSlug, {
        StartedAt: startedAt, FinishedAt: finishedAt,
        Notes: options.Persist.Notes ?? "",
        StepResults: results.map(toStepResultDraft),
    });
}

export async function executeReplay(
    steps: ReadonlyArray<ReplayStepInput>,
    options: ReplayOptions,
): Promise<ReplayRunOutcome> {
    const sleep = options.Sleep ?? defaultSleep;
    const now = options.Now ?? defaultNow;
    const results: ReplayStepResult[] = [];
    const startedAt = toIso(now());
    for (const step of steps) {
        results.push(await executeStep(step, options, sleep, now));
    }
    const finishedAt = toIso(now());
    const persistedRun = await persistIfRequested(options, results, startedAt, finishedAt);
    return { Results: results, StartedAt: startedAt, FinishedAt: finishedAt, PersistedRun: persistedRun };
}

/* ------------------------------------------------------------------ */
/*  Per-step execution — Shell + Wire (SS-02 pattern #1)               */
/* ------------------------------------------------------------------ */

interface ActionState {
    target: HTMLElement | null;
    resolvedXPath: string | undefined;
    variables: ReadonlyArray<VariableContext>;
}

interface FinalizeOutcome {
    readonly Ok: boolean;
    readonly Error?: unknown;
    readonly ResolvedXPath?: string;
    readonly Target?: HTMLElement | null;
    readonly Variables?: ReadonlyArray<VariableContext>;
    readonly Reason?: FailureReasonCode;
    readonly ReasonDetail?: string;
    readonly Skipped?: boolean;
}

async function executeStep(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    now: () => Date,
): Promise<ReplayStepResult> {
    const startedAt = now();
    if (step.Kind === "Wait") {
        return runWaitStep(step, options, sleep, startedAt, now);
    }
    return runActionStep(step, options, sleep, startedAt, now);
}

async function runWaitStep(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    startedAt: Date,
    now: () => Date,
): Promise<ReplayStepResult> {
    await sleep(step.WaitMs ?? 0);
    return finalize(step, options, startedAt, now(), { Ok: true });
}

async function runActionStep(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    startedAt: Date,
    now: () => Date,
): Promise<ReplayStepResult> {
    const state: ActionState = { target: null, resolvedXPath: undefined, variables: [] };
    try {
        return await runActionPipeline(step, options, sleep, startedAt, now, state);
    } catch (err) {
        return finalize(step, options, startedAt, now(), {
            Ok: false, ResolvedXPath: state.resolvedXPath, Variables: state.variables,
            Error: err, Target: state.target,
        });
    }
}

async function runActionPipeline(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    startedAt: Date,
    now: () => Date,
    state: ActionState,
): Promise<ReplayStepResult> {
    const gateResult = await checkPreConditionGate(step, options, sleep, now, startedAt);
    if (gateResult !== null) { return gateResult; }
    const varFailure = applyStepVariables(step, options, state);
    if (varFailure !== null) { return finalize(step, options, startedAt, now(), varFailure); }
    const resolved = resolveStepSelector(step.Selectors);
    state.resolvedXPath = resolved.Expression;
    state.target = locateElement(resolved, options.Doc);
    if (state.target === null) { return notFoundResult(step, options, startedAt, now, resolved, state.variables); }
    actuateStep(step, state.target, options.Row);
    const waitResult = await checkPostWait(step, options, sleep, now, startedAt, resolved, state);
    if (waitResult !== null) { return waitResult; }
    return finalize(step, options, startedAt, now(), { Ok: true, ResolvedXPath: resolved.Expression });
}

async function checkPreConditionGate(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    now: () => Date,
    startedAt: Date,
): Promise<ReplayStepResult | null> {
    if (step.Gate === undefined) { return null; }
    const gateOutcome = await waitForCondition(step.Gate.Condition, {
        Doc: options.Doc, TimeoutMs: step.Gate.TimeoutMs, PollMs: step.Gate.PollMs,
        Sleep: sleep, Now: () => now().getTime(),
    });
    if (gateOutcome.Ok) { return null; }
    return buildGateFailure(step, options, startedAt, now(), gateOutcome);
}

function buildGateFailure(
    step: ReplayStepInput,
    options: ReplayOptions,
    startedAt: Date,
    finishedAt: Date,
    gateOutcome: Extract<ConditionWaitOutcome, { Ok: false }>,
): ReplayStepResult {
    const gate = step.Gate;
    if (gate === undefined) { throw new Error("buildGateFailure called without Gate"); }
    const detail = `polls=${gateOutcome.Polls}, elapsed=${gateOutcome.DurationMs}ms`;
    if (gate.OnTimeout === "Skip") {
        return finalize(step, options, startedAt, finishedAt, {
            Ok: true, Skipped: true,
            Error: new Error(`Skipped: gate condition not met within ${gate.TimeoutMs}ms (${detail})`),
        });
    }
    const reasonDetail = `Gate condition not met within ${gate.TimeoutMs}ms (${detail}). Last evaluation: ${JSON.stringify(gateOutcome.LastEvaluation)}`;
    return finalize(step, options, startedAt, finishedAt, {
        Ok: false, Reason: "ConditionTimeout", ReasonDetail: reasonDetail,
        Error: new Error(`Gate condition not met within ${gate.TimeoutMs}ms`),
    });
}

function applyStepVariables(
    step: ReplayStepInput,
    options: ReplayOptions,
    state: ActionState,
): FinalizeOutcome | null {
    if (step.Kind !== "Type" && step.Kind !== "Select") { return null; }
    if (step.Value === undefined || step.Value === "") { return null; }
    const detailed = resolveFieldReferencesDetailed(step.Value, options.Row ?? {}, {
        Source: options.Row !== undefined ? "Row" : "NoActiveRow",
        ExpectedType: "string",
    });
    state.variables = detailed.Variables;
    if (detailed.FirstFailure === null) { return null; }
    const message = detailed.FirstFailure.FailureDetail ?? `Variable {{${detailed.FirstFailure.Name}}} failed`;
    return { Ok: false, Variables: detailed.Variables, Error: new Error(message) };
}

function actuateStep(step: ReplayStepInput, target: HTMLElement, row: FieldRow | undefined): void {
    if (step.Kind === "Click")  { dispatchClick(target); return; }
    if (step.Kind === "Type")   { dispatchType(target,   resolveValue(step.Value, row)); return; }
    if (step.Kind === "Select") { dispatchSelect(target, resolveValue(step.Value, row)); }
}

function notFoundResult(
    step: ReplayStepInput,
    options: ReplayOptions,
    startedAt: Date,
    now: () => Date,
    resolved: ResolvedSelector,
    variables: ReadonlyArray<VariableContext>,
): ReplayStepResult {
    return finalize(step, options, startedAt, now(), {
        Ok: false, ResolvedXPath: resolved.Expression, Variables: variables,
        Error: new Error(`Element not found for selector '${resolved.Expression}'`),
    });
}

async function checkPostWait(
    step: ReplayStepInput,
    options: ReplayOptions,
    sleep: (ms: number) => Promise<void>,
    now: () => Date,
    startedAt: Date,
    resolved: ResolvedSelector,
    state: ActionState,
): Promise<ReplayStepResult | null> {
    const effectiveWait = step.WaitFor !== undefined ? step.WaitFor : persistedWaitToSpec(readStepWait(step.StepId));
    if (effectiveWait === null) { return null; }
    const waitOutcome = await waitForElement(effectiveWait, {
        Doc: options.Doc, Sleep: sleep, Now: () => now().getTime(),
    });
    if (waitOutcome.Ok) { return null; }
    return buildWaitFailure(step, options, startedAt, now(), resolved, state, effectiveWait, waitOutcome);
}

function detectWaitKind(spec: WaitForSpec): "XPath" | "Css" {
    const declared = spec.Kind ?? "Auto";
    if (declared === "XPath") { return "XPath"; }
    if (declared === "Css")   { return "Css"; }
    return spec.Expression.trim().startsWith("/") ? "XPath" : "Css";
}

function buildWaitFailure(
    step: ReplayStepInput,
    options: ReplayOptions,
    startedAt: Date,
    finishedAt: Date,
    resolved: ResolvedSelector,
    state: ActionState,
    effectiveWait: WaitForSpec,
    waitOutcome: { Ok: false; Reason: "Timeout" | "InvalidSelector"; DurationMs: number; Detail?: string },
): ReplayStepResult {
    const resolvedKind = detectWaitKind(effectiveWait);
    const reasonCode: FailureReasonCode = waitOutcome.Reason === "InvalidSelector"
        ? (resolvedKind === "XPath" ? "XPathSyntaxError" : "CssSyntaxError")
        : "Timeout";
    const reasonDetail = waitOutcome.Reason === "Timeout"
        ? `WaitFor selector '${effectiveWait.Expression}' (Kind=${resolvedKind}) did not appear within ${effectiveWait.TimeoutMs} ms (elapsed ${waitOutcome.DurationMs} ms).`
        : `WaitFor selector '${effectiveWait.Expression}' (Kind=${resolvedKind}) is invalid: ${waitOutcome.Detail}`;
    return finalize(step, options, startedAt, finishedAt, {
        Ok: false, ResolvedXPath: resolved.Expression, Variables: state.variables, Target: state.target,
        Reason: reasonCode, ReasonDetail: reasonDetail, Error: new Error(reasonDetail),
    });
}

/* ------------------------------------------------------------------ */
/*  Result finalization — split per SS-02                              */
/* ------------------------------------------------------------------ */

function finalize(
    step: ReplayStepInput,
    options: ReplayOptions,
    started: Date,
    finished: Date,
    outcome: FinalizeOutcome,
): ReplayStepResult {
    if (outcome.Ok) { return buildSuccessResult(step, started, finished, outcome); }
    return buildFailureResult(step, options, started, finished, outcome);
}

function buildSuccessResult(
    step: ReplayStepInput,
    started: Date,
    finished: Date,
    outcome: FinalizeOutcome,
): ReplayStepResult {
    return {
        StepId: step.StepId, Index: step.Index, Ok: true,
        Skipped: outcome.Skipped === true ? true : undefined,
        ResolvedXPath: outcome.ResolvedXPath,
        StartedAt: toIso(started), FinishedAt: toIso(finished),
        DurationMs: Math.max(0, finished.getTime() - started.getTime()),
    };
}

function buildFailureResult(
    step: ReplayStepInput,
    options: ReplayOptions,
    started: Date,
    finished: Date,
    outcome: FinalizeOutcome,
): ReplayStepResult {
    const report = createFailureReport(step, options, outcome);
    return {
        StepId: step.StepId, Index: step.Index, Ok: false,
        Error: report.Message, ResolvedXPath: outcome.ResolvedXPath,
        StartedAt: toIso(started), FinishedAt: toIso(finished),
        DurationMs: Math.max(0, finished.getTime() - started.getTime()),
        FailureReport: report,
    };
}

function createFailureReport(
    step: ReplayStepInput,
    options: ReplayOptions,
    outcome: FinalizeOutcome,
): FailureReport {
    const evaluatedAttempts = step.Kind === "Wait" ? undefined : evaluateAllSelectors(step.Selectors, options.Doc);
    const verbose = options.Verbose !== undefined ? options.Verbose : resolveVerboseLogging(options.Persist?.ProjectSlug);
    return logFailure({
        Phase: "Replay", Error: outcome.Error, StepId: step.StepId, Index: step.Index,
        StepKind: step.Kind, Selectors: step.Selectors, EvaluatedAttempts: evaluatedAttempts,
        Target: outcome.Target ?? null, DataRow: options.Row, Variables: outcome.Variables,
        ResolvedXPath: outcome.ResolvedXPath, SourceFile: SOURCE_FILE,
        Reason: outcome.Reason, ReasonDetail: outcome.ReasonDetail,
        Verbose: verbose, Now: options.Now,
    });
}


function toStepResultDraft(r: ReplayStepResult): ReplayStepResultDraft {
    // When a structured FailureReport exists, persist it as JSON so the
    // user can later copy the full diagnostic blob from the project DB.
    const errorMessage = r.FailureReport !== undefined
        ? JSON.stringify(r.FailureReport)
        : (r.Skipped === true ? (r.Error ?? "Skipped: gate condition not met") : (r.Error ?? null));
    return {
        StepId: r.StepId,
        OrderIndex: r.Index,
        IsOk: r.Ok || r.Skipped === true,
        ErrorMessage: errorMessage,
        ResolvedXPath: r.ResolvedXPath ?? null,
        StartedAt: r.StartedAt,
        FinishedAt: r.FinishedAt,
        DurationMs: r.DurationMs,
    };
}

function toIso(d: Date): string {
    // SQLite stores `datetime('now')` in 'YYYY-MM-DD HH:MM:SS'; ISO is fine here
    // because the column is TEXT and we read it back verbatim.
    return d.toISOString();
}

function defaultNow(): Date {
    return new Date();
}

function resolveValue(raw: string | undefined, row: FieldRow | undefined): string {
    if (raw === undefined || raw === "") { return ""; }
    if (row === undefined)               { return raw; }
    return resolveFieldReferences(raw, row);
}

/* ------------------------------------------------------------------ */
/*  DOM lookup                                                         */
/* ------------------------------------------------------------------ */

function locateElement(resolved: ResolvedSelector, doc: Document): HTMLElement | null {
    if (resolved.Kind === "XPath") {
        const r = doc.evaluate(resolved.Expression, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = r.singleNodeValue;
        return node instanceof HTMLElement ? node : null;
    }
    if (resolved.Kind === "Css") {
        const element = doc.querySelector(resolved.Expression);
        return element instanceof HTMLElement ? element : null;
    }
    // Aria — minimal support: `[aria-label="…"]`-style expressions are passed straight to querySelector
    const element = doc.querySelector(resolved.Expression);
    return element instanceof HTMLElement ? element : null;
}

/* ------------------------------------------------------------------ */
/*  Event dispatch                                                     */
/* ------------------------------------------------------------------ */

function dispatchClick(element: HTMLElement): void {
    element.focus({ preventScroll: true });
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true }));
}

function assignInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter !== undefined) setter.call(element, value);
    else element.value = value;
}

function dispatchType(element: HTMLElement, value: string): void {
    element.focus({ preventScroll: true });
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        assignInputValue(element, value);
    } else if (element.isContentEditable) {
        element.textContent = value;
    } else {
        return; // not typeable
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchSelect(element: HTMLElement, value: string): void {
    if (!(element instanceof HTMLSelectElement)) { return; }
    element.value = value;
    element.dispatchEvent(new Event("input",  { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        timeoutId = setTimeout(() => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            resolve();
        }, ms);
    });
}

/**
 * Bridge `WaitConfig` (persisted via the StepWaitDialog UI) into the
 * inline `WaitForSpec` shape that `waitForElement` expects.
 *
 * `wait-for-element.ts` currently implements only the **Appears**
 * predicate (returns when the element is found in the DOM). The
 * `Disappears` and `Visible` modes from the dialog are accepted by the
 * storage layer but cannot be honoured here yet — for those, we still
 * resolve to `Appears` so the user gets *some* gating instead of silent
 * no-op, and we leave a console warning so the discrepancy is traceable.
 *
 * Returns `null` when there's no persisted config so the caller can
 * skip the wait branch entirely.
 */
function persistedWaitToSpec(config: WaitConfig | null): WaitForSpec | null {
    if (config === null) return null;
    if (config.Condition !== "Appears") {
        console.warn(
            `live-dom-replay: persisted wait condition '${config.Condition}' is ` +
            `not yet supported by waitForElement; falling back to 'Appears'.`,
        );
    }
    return {
        Expression: config.Selector,
        Kind: config.Kind === "XPath" ? "XPath" : "Css",
        TimeoutMs: config.TimeoutMs,
    };
}
