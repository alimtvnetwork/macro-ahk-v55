/**
 * Marco Extension — Selector Attempt Comparison
 *
 * Runs every persisted selector for a Step against the live DOM and reports,
 * per selector, whether the lookup succeeded and which Element (if any) was
 * matched. Used by the failure post-mortem UI ("Comparison view") so the
 * user can see at a glance:
 *
 *   - Which selectors no longer match → likely root cause of the failure.
 *   - Which selectors do still resolve → the next-best candidate to promote
 *     to primary.
 *   - When a fallback resolves to a *different* element than the primary
 *     would have → silent drift.
 *
 * Pure: caller injects the Document. No event dispatch, no chrome.*.
 *
 * @see ./replay-resolver.ts   — Same anchor/relative resolution rules.
 * @see ./failure-logger.ts    — DomContext shape reused here.
 */

import { resolveStepSelector } from "./replay-resolver";
import { SelectorKindId } from "../recorder-db-schema";
import type { PersistedSelector } from "./step-persistence";
import type { DomContext } from "./failure-logger";

const SELECTOR_KIND_NAMES: Readonly<Record<number, string>> = {
    1: "XPathFull",
    2: "XPathRelative",
    3: "Css",
    4: "Aria",
};

export interface SelectorAttemptComparison {
    readonly SelectorId: number;
    readonly Kind: string;
    readonly Expression: string;
    readonly ResolvedExpression: string;
    readonly IsPrimary: boolean;
    /** True when the lookup matched at least one element. */
    readonly Matched: boolean;
    /** Number of matches (querySelectorAll for Css/Aria, XPath snapshot for XPath). */
    readonly MatchCount: number;
    /** DOM snapshot of the *first* match (or null when no match). */
    readonly Element: DomContext | null;
    /** Resolver / DOM-API failure message (e.g. invalid XPath). */
    readonly Error: string | null;
}

export interface SelectorComparison {
    /** All attempts, primary first then in original order. */
    readonly Attempts: ReadonlyArray<SelectorAttemptComparison>;
    /** True when the primary selector matched. */
    readonly PrimaryMatched: boolean;
    /** True when at least one fallback (non-primary) matched. */
    readonly AnyFallbackMatched: boolean;
    /**
     * True when the primary fails but a fallback resolves — strong hint that
     * the user should promote the fallback or the primary needs editing.
     */
    readonly DriftDetected: boolean;
}

/**
 * Try every selector for a Step against the live DOM and report which
 * matched. Anchor chains are honored via {@link resolveStepSelector} on a
 * synthetic primary marker per selector so relative XPath fallbacks are
 * evaluated correctly.
 */
export function compareSelectorAttempts(
    selectors: ReadonlyArray<PersistedSelector>,
    doc: Document,
): SelectorComparison {
    const attempts = selectors.map((sel) => evaluateOne(sel, selectors, doc));
    sortAttempts(attempts);
    return summariseComparison(attempts);
}

function sortAttempts(attempts: SelectorAttemptComparison[]): void {
    attempts.sort((a, b) => {
        if (a.IsPrimary !== b.IsPrimary) { return a.IsPrimary ? -1 : 1; }
        return a.SelectorId - b.SelectorId;
    });
}

function summariseComparison(
    attempts: ReadonlyArray<SelectorAttemptComparison>,
): SelectorComparison {
    const primary = attempts.find((a) => a.IsPrimary) ?? null;
    const primaryMatched = primary?.Matched ?? false;
    const anyFallbackMatched = attempts.some((a) => !a.IsPrimary && a.Matched);
    return {
        Attempts: attempts,
        PrimaryMatched: primaryMatched,
        AnyFallbackMatched: anyFallbackMatched,
        DriftDetected: !primaryMatched && anyFallbackMatched,
    };
}

type AttemptBase = Omit<
    SelectorAttemptComparison,
    "Matched" | "MatchCount" | "Element" | "Error" | "ResolvedExpression"
>;

function evaluateOne(
    selector: PersistedSelector,
    all: ReadonlyArray<PersistedSelector>,
    doc: Document,
): SelectorAttemptComparison {
    const base = buildAttemptBase(selector);
    const resolveOutcome = resolveExpression(selector, all);
    if (resolveOutcome.error !== null) {
        return failedAttempt(base, selector.Expression, resolveOutcome.error);
    }
    return tryLookupAttempt(base, selector.SelectorKindId, resolveOutcome.expression, doc);
}

function buildAttemptBase(selector: PersistedSelector): AttemptBase {
    const kind = SELECTOR_KIND_NAMES[selector.SelectorKindId] ?? `Kind${selector.SelectorKindId}`;
    return {
        SelectorId: selector.SelectorId,
        Kind: kind,
        Expression: selector.Expression,
        IsPrimary: selector.IsPrimary === 1,
    };
}

function resolveExpression(
    selector: PersistedSelector, all: ReadonlyArray<PersistedSelector>,
): { expression: string; error: string | null } {
    if (selector.SelectorKindId !== SelectorKindId.XPathRelative) {
        return { expression: selector.Expression, error: null };
    }
    try {
        const synthetic = withSyntheticPrimary(all, selector.SelectorId);
        return { expression: resolveStepSelector(synthetic).Expression, error: null };
    } catch (err) {
        return { expression: selector.Expression, error: errorMessage(err) };
    }
}

function withSyntheticPrimary(
    all: ReadonlyArray<PersistedSelector>, primaryId: number,
): PersistedSelector[] {
    return all.map((s) => ({ ...s, IsPrimary: s.SelectorId === primaryId ? 1 : 0 }));
}

function tryLookupAttempt(
    base: AttemptBase, kindId: number, resolved: string, doc: Document,
): SelectorAttemptComparison {
    try {
        const { element, count } = lookup(kindId, resolved, doc);
        return successfulAttempt(base, resolved, element, count);
    } catch (err) {
        return failedAttempt(base, resolved, errorMessage(err));
    }
}

function successfulAttempt(
    base: AttemptBase, resolved: string, element: Element | null, count: number,
): SelectorAttemptComparison {
    return {
        ...base,
        ResolvedExpression: resolved,
        Matched: element !== null,
        MatchCount: count,
        Element: element !== null ? readDomContext(element) : null,
        Error: null,
    };
}

function failedAttempt(
    base: AttemptBase, resolved: string, error: string,
): SelectorAttemptComparison {
    return {
        ...base,
        ResolvedExpression: resolved,
        Matched: false,
        MatchCount: 0,
        Element: null,
        Error: error,
    };
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function lookup(
    kindId: number,
    expression: string,
    doc: Document,
): { element: Element | null; count: number } {
    if (kindId === SelectorKindId.XPathFull || kindId === SelectorKindId.XPathRelative) {
        return xpathLookup(expression, doc);
    }
    const list = doc.querySelectorAll(expression);
    return { element: list.length > 0 ? list[0] : null, count: list.length };
}

function xpathLookup(
    expression: string, doc: Document,
): { element: Element | null; count: number } {
    const snapshot = doc.evaluate(
        expression, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null,
    );
    const count = snapshot.snapshotLength;
    const first = count > 0 ? snapshot.snapshotItem(0) : null;
    return { element: first instanceof Element ? first : null, count };
}

function readDomContext(element: Element): DomContext {
    return {
        TagName: element.tagName.toLowerCase(),
        Id:        nonEmptyAttr(element, "id"),
        ClassName: nonEmptyAttr(element, "class"),
        AriaLabel: nonEmptyAttr(element, "aria-label"),
        Name:      nonEmptyAttr(element, "name"),
        Type:      nonEmptyAttr(element, "type"),
        TextSnippet: (element.textContent ?? "").trim().slice(0, 120),
        OuterHtmlSnippet: element.outerHTML?.slice(0, 240) ?? "",
    };
}

function nonEmptyAttr(element: Element, name: string): string | null {
    const value = element.getAttribute(name);
    return value !== null && value.length > 0 ? value : null;
}
