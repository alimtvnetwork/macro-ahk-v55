/**
 * Marco Extension — Condition Evaluator (Spec 18)
 *
 * Pure DOM-only module that evaluates compound boolean condition trees over
 * selector predicates. Supersedes the single-predicate `wait-for-element.ts`
 * gate while remaining shape-compatible (an `Exists` leaf condition with a
 * `TimeoutMs` is exactly the old `WaitFor`).
 *
 * No chrome.* / no messaging — fully unit-testable under jsdom and reusable
 * from the content script.
 *
 * @see spec/31-macro-recorder/18-conditional-elements.md
 * @see ./wait-for-element.ts — Single-predicate predecessor.
 */

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type SelectorKind = "Auto" | "XPath" | "Css";

export type Matcher =
    | { readonly Kind: "Exists" }
    | { readonly Kind: "Visible" }
    | { readonly Kind: "TextEquals";   readonly Value: string; readonly CaseSensitive?: boolean }
    | { readonly Kind: "TextContains"; readonly Value: string; readonly CaseSensitive?: boolean }
    | { readonly Kind: "TextRegex";    readonly Pattern: string; readonly Flags?: string }
    | { readonly Kind: "AttrEquals";   readonly Name: string; readonly Value: string }
    | { readonly Kind: "AttrContains"; readonly Name: string; readonly Value: string }
    | { readonly Kind: "Count";        readonly Op: "eq" | "gte" | "lte"; readonly N: number };

export interface Predicate {
    readonly Selector: string;
    readonly SelectorKind?: SelectorKind;
    readonly Matcher: Matcher;
    readonly Negate?: boolean;
}

export type Condition =
    | Predicate
    | { readonly All: ReadonlyArray<Condition> }
    | { readonly Any: ReadonlyArray<Condition> }
    | { readonly Not: Condition };

export const MAX_CONDITION_DEPTH = 8;
export const MAX_PREDICATE_COUNT = 32;

export type ConditionWaitOutcome =
    | { readonly Ok: true;  readonly DurationMs: number; readonly Polls: number }
    | { readonly Ok: false; readonly DurationMs: number; readonly Polls: number;
        readonly Reason: "ConditionTimeout" | "InvalidSelector";
        readonly Detail: string;
        readonly LastEvaluation: PredicateEvaluation[] };

export interface PredicateEvaluation {
    readonly Selector: string;
    readonly Kind: "XPath" | "Css";
    readonly Matcher: string;
    readonly Result: boolean;
    readonly Detail?: string;
}

export interface EvaluateOptions {
    readonly Doc: Document;
    /** When provided, every predicate's outcome is appended for diagnostics. */
    readonly Trace?: PredicateEvaluation[];
}

export interface WaitOptions {
    readonly Doc: Document;
    readonly TimeoutMs: number;
    readonly PollMs?: number;
    readonly Sleep?: (ms: number) => Promise<void>;
    readonly Now?: () => number;
}

type WaitClock = {
    readonly Sleep: (ms: number) => Promise<void>;
    readonly Now: () => number;
    readonly PollMs: number;
    readonly Started: number;
    readonly Deadline: number;
};

type PollResult = {
    readonly Outcome: ConditionWaitOutcome | null;
    readonly Trace: PredicateEvaluation[];
};

type CaughtError = unknown;

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

interface WalkState { count: number }

function walkCondition(node: Condition, depth: number, path: string, state: WalkState): void {
    if (depth > MAX_CONDITION_DEPTH) {
        throw new Error(`InvalidSelector: condition tree exceeds depth ${MAX_CONDITION_DEPTH} at ${path || "<root>"}`);
    }
    if ("All" in node) {
        node.All.forEach((child, i) => walkCondition(child, depth + 1, joinPath(path, `All[${i}]`), state));
        return;
    }
    if ("Any" in node) {
        node.Any.forEach((child, i) => walkCondition(child, depth + 1, joinPath(path, `Any[${i}]`), state));
        return;
    }
    if ("Not" in node) { walkCondition(node.Not, depth + 1, joinPath(path, "Not"), state); return; }
    state.count++;
    if (state.count > MAX_PREDICATE_COUNT) {
        throw new Error(`InvalidSelector: condition exceeds ${MAX_PREDICATE_COUNT} predicates at ${joinPath(path, node.Matcher.Kind)}`);
    }
    validateMatcher(node, joinPath(path, node.Matcher.Kind));
}

export function validateCondition(condition: Condition): void {
    walkCondition(condition, 0, "", { count: 0 });
}

function joinPath(prefix: string, segment: string): string {
    return prefix.length === 0 ? segment : `${prefix}.${segment}`;
}

function validateMatcher(predicate: Predicate, path: string): void {
    const matcher = predicate.Matcher;
    if (matcher.Kind === "TextRegex") {
        try { new RegExp(matcher.Pattern, matcher.Flags ?? ""); }
        catch (caughtError) {
            const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
            throw new Error(`InvalidSelector: bad regex /${matcher.Pattern}/ at ${path} — ${message}`);
        }
        return;
    }
    if ((matcher.Kind === "AttrEquals" || matcher.Kind === "AttrContains") && matcher.Name.length === 0) {
        throw new Error(`InvalidSelector: ${matcher.Kind} requires non-empty Name at ${path}`);
    }
    if (matcher.Kind === "Count" && matcher.N < 0) {
        throw new Error(`InvalidSelector: Count.N must be >= 0 at ${path} (got ${matcher.N})`);
    }
}

/* ------------------------------------------------------------------ */
/*  Evaluation                                                         */
/* ------------------------------------------------------------------ */

export function evaluateCondition(condition: Condition, options: EvaluateOptions): boolean {
    if ("All" in condition) {
        for (const child of condition.All) {
            if (evaluateCondition(child, options) === false) return false;
        }
        return true;
    }
    if ("Any" in condition) {
        for (const child of condition.Any) {
            if (evaluateCondition(child, options)) return true;
        }
        return false;
    }
    if ("Not" in condition) return evaluateCondition(condition.Not, options) === false;

    const result = evaluatePredicate(condition, options);
    return condition.Negate === true ? result === false : result;
}

function evaluatePredicate(predicate: Predicate, options: EvaluateOptions): boolean {
    const kind = resolveSelectorKind(predicate.SelectorKind ?? "Auto", predicate.Selector);

    if (predicate.Matcher.Kind === "Count") {
        const count = locateAll(predicate.Selector, kind, options.Doc).length;
        const result = compareCount(count, predicate.Matcher.Op, predicate.Matcher.N);
        recordTrace(options, predicate, kind, result, `count=${count}`);
        return result;
    }

    const element = locateFirst(predicate.Selector, kind, options.Doc);
    if (element === null) {
        recordTrace(options, predicate, kind, predicate.Matcher.Kind === "Exists" ? false : false, "no match");
        return false;
    }

    const result = applyMatcher(element, predicate.Matcher);
    recordTrace(options, predicate, kind, result);
    return result;
}

function recordTrace(
    options: EvaluateOptions,
    predicate: Predicate,
    kind: "XPath" | "Css",
    result: boolean,
    detail?: string,
): void {
    if (options.Trace === undefined) return;
    options.Trace.push({
        Selector: predicate.Selector,
        Kind: kind,
        Matcher: predicate.Matcher.Kind,
        Result: predicate.Negate === true ? result === false : result,
        Detail: detail,
    });
}

function matchText(actual: string, expected: string, caseSensitive: boolean | undefined, compare: (a: string, b: string) => boolean): boolean {
    if (caseSensitive === false) return compare(actual.toLowerCase(), expected.toLowerCase());
    return compare(actual, expected);
}

function matchTextEquals(element: Element, matcher: Matcher & { Kind: "TextEquals" }): boolean {
    return matchText((element.textContent ?? "").trim(), matcher.Value, matcher.CaseSensitive, (a, b) => a === b);
}

function matchTextContains(element: Element, matcher: Matcher & { Kind: "TextContains" }): boolean {
    return matchText(element.textContent ?? "", matcher.Value, matcher.CaseSensitive, (a, b) => a.includes(b));
}

function matchAttr(element: Element, name: string, expected: string, mode: "eq" | "contains"): boolean {
    const value = element.getAttribute(name);
    if (value === null) return false;
    return mode === "eq" ? value === expected : value.includes(expected);
}

function applyMatcher(element: Element, matcher: Matcher): boolean {
    switch (matcher.Kind) {
        case "Exists": return true;
        case "Visible": return isVisible(element);
        case "TextEquals": return matchTextEquals(element, matcher);
        case "TextContains": return matchTextContains(element, matcher);
        case "TextRegex": return new RegExp(matcher.Pattern, matcher.Flags ?? "").test(element.textContent ?? "");
        case "AttrEquals": return matchAttr(element, matcher.Name, matcher.Value, "eq");
        case "AttrContains": return matchAttr(element, matcher.Name, matcher.Value, "contains");
        case "Count": return false; // handled above
    }
}

function isVisible(element: Element): boolean {
    const windowObject = element.ownerDocument?.defaultView;
    if (windowObject === null || windowObject === undefined) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const styles = windowObject.getComputedStyle(element);
    if (styles.display === "none") return false;
    if (styles.visibility === "hidden") return false;
    return true;
}

function compareCount(count: number, op: "eq" | "gte" | "lte", n: number): boolean {
    if (op === "eq") return count === n;
    if (op === "gte") return count >= n;
    return count <= n;
}

/* ------------------------------------------------------------------ */
/*  Selector locators                                                  */
/* ------------------------------------------------------------------ */

export function resolveSelectorKind(kind: SelectorKind, expression: string): "XPath" | "Css" {
    if (kind === "XPath") return "XPath";
    if (kind === "Css") return "Css";
    const trimmed = expression.trimStart();
    return trimmed.startsWith("/") || trimmed.startsWith("(") ? "XPath" : "Css";
}

function locateFirst(expression: string, kind: "XPath" | "Css", doc: Document): Element | null {
    if (kind === "XPath") {
        const r = doc.evaluate(expression, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = r.singleNodeValue;
        return node instanceof Element ? node : null;
    }
    return doc.querySelector(expression);
}

function locateAll(expression: string, kind: "XPath" | "Css", doc: Document): Element[] {
    if (kind === "XPath") {
        const r = doc.evaluate(expression, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const out: Element[] = [];
        for (let i = 0; i < r.snapshotLength; i++) {
            const node = r.snapshotItem(i);
            if (node instanceof Element) out.push(node);
        }
        return out;
    }
    return Array.from(doc.querySelectorAll(expression));
}

/* ------------------------------------------------------------------ */
/*  Wait loop                                                          */
/* ------------------------------------------------------------------ */

export async function waitForCondition(
    condition: Condition,
    options: WaitOptions,
): Promise<ConditionWaitOutcome> {
    const validationFailure = validateConditionForWait(condition);
    if (validationFailure !== null) return validationFailure;

    const clock = createWaitClock(options);
    let polls = 0;
    let lastTrace: PredicateEvaluation[] = [];

    for (;;) {
        polls++;
        const poll = evaluateConditionPoll(condition, options, clock, polls);
        if (poll.Outcome !== null) return poll.Outcome;

        lastTrace = poll.Trace;
        if (isConditionTimedOut(polls, clock)) return createTimeoutOutcome(options, clock, polls, lastTrace);

        await clock.Sleep(clock.PollMs);
    }
}

function validateConditionForWait(condition: Condition): ConditionWaitOutcome | null {
    try { validateCondition(condition); }
    catch (err) {
        return createInvalidSelectorOutcome(err, 0, 0, []);
    }

    return null;
}

function createWaitClock(options: WaitOptions): WaitClock {
    const now = options.Now ?? defaultNow;
    const started = now();

    return {
        Sleep: options.Sleep ?? defaultSleep,
        Now: now,
        PollMs: Math.max(1, options.PollMs ?? 50),
        Started: started,
        Deadline: started + Math.max(0, options.TimeoutMs),
    };
}

function evaluateConditionPoll(
    condition: Condition,
    options: WaitOptions,
    clock: WaitClock,
    polls: number,
): PollResult {
    const trace: PredicateEvaluation[] = [];
    try {
        const result = evaluateCondition(condition, { Doc: options.Doc, Trace: trace });
        const outcome = result ? createSuccessOutcome(clock, polls) : null;

        return { Outcome: outcome, Trace: trace };
    } catch (err) {
        return { Outcome: createInvalidSelectorOutcome(err, clock.Now() - clock.Started, polls, trace), Trace: trace };
    }
}

function createSuccessOutcome(clock: WaitClock, polls: number): ConditionWaitOutcome {
    return { Ok: true, DurationMs: clock.Now() - clock.Started, Polls: polls };
}

function isConditionTimedOut(polls: number, clock: WaitClock): boolean {
    return polls >= 2 && clock.Now() >= clock.Deadline;
}

function createTimeoutOutcome(
    options: WaitOptions,
    clock: WaitClock,
    polls: number,
    lastTrace: PredicateEvaluation[],
): ConditionWaitOutcome {
    return {
        Ok: false,
        DurationMs: clock.Now() - clock.Started,
        Polls: polls,
        Reason: "ConditionTimeout",
        Detail: `Condition not met within ${options.TimeoutMs}ms`,
        LastEvaluation: lastTrace,
    };
}

function createInvalidSelectorOutcome(
    error: CaughtError,
    durationMs: number,
    polls: number,
    trace: PredicateEvaluation[],
): ConditionWaitOutcome {
    return {
        Ok: false,
        DurationMs: durationMs,
        Polls: polls,
        Reason: "InvalidSelector",
        Detail: error instanceof Error ? error.message : String(error),
        LastEvaluation: trace,
    };
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

function defaultNow(): number {
    return Date.now();
}
