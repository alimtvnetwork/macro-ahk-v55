/**
 * Marco Extension — Mini Selector Tester
 *
 * Pure helper that evaluates an arbitrary CSS or XPath selector against a
 * Document and reports match count + a snapshot of the first matched
 * element. Auto-detects kind (XPath if expression starts with `/` or `(`,
 * otherwise CSS) but accepts an explicit override.
 *
 * Reuses the {@link DomContext} shape from `failure-logger` so the result
 * round-trips through the same diagnostic pipelines as failure reports
 * and selector comparisons.
 *
 * @see ./selector-comparison.ts — Per-step selector comparison.
 * @see ./failure-logger.ts      — DomContext shape.
 */

import type { DomContext } from "./failure-logger";

export type SelectorTestKind = "Css" | "XPath" | "Auto";

export interface SelectorTestResult {
    readonly Expression: string;
    /** Detected or supplied kind actually used for the lookup. */
    readonly Kind: "Css" | "XPath";
    readonly MatchCount: number;
    readonly FirstMatch: DomContext | null;
    readonly Error: string | null;
}

/** Detect the selector kind from the expression's leading character. */
export function detectSelectorKind(expression: string): "Css" | "XPath" {
    const trimmed = expression.trimStart();
    if (trimmed.startsWith("/") || trimmed.startsWith("(") || trimmed.startsWith("./")) {
        return "XPath";
    }
    return "Css";
}

/** Run the selector against `doc` and report the outcome. */
export function testSelector(
    expression: string,
    doc: Document,
    kind: SelectorTestKind = "Auto",
): SelectorTestResult {
    const trimmed = expression.trim();
    if (trimmed.length === 0) { return emptyExpressionResult(expression, kind); }
    const useKind = resolveKind(kind, trimmed);
    try { return runSelectorLookup(trimmed, doc, useKind); }
    catch (err) { return selectorErrorResult(trimmed, useKind, err); }
}

function resolveKind(kind: SelectorTestKind, trimmed: string): "Css" | "XPath" {
    return kind === "Auto" ? detectSelectorKind(trimmed) : kind;
}

function emptyExpressionResult(expression: string, kind: SelectorTestKind): SelectorTestResult {
    return {
        Expression: expression,
        Kind: kind === "XPath" ? "XPath" : "Css",
        MatchCount: 0,
        FirstMatch: null,
        Error: "Selector is empty",
    };
}

function runSelectorLookup(
    trimmed: string, doc: Document, useKind: "Css" | "XPath",
): SelectorTestResult {
    if (useKind === "XPath") { return runXPathLookup(trimmed, doc); }
    return runCssLookup(trimmed, doc);
}

function runXPathLookup(trimmed: string, doc: Document): SelectorTestResult {
    const snapshot = doc.evaluate(
        trimmed, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null,
    );
    const count = snapshot.snapshotLength;
    const first = count > 0 ? snapshot.snapshotItem(0) : null;
    return {
        Expression: trimmed,
        Kind: "XPath",
        MatchCount: count,
        FirstMatch: first instanceof Element ? readDomContext(first) : null,
        Error: null,
    };
}

function runCssLookup(trimmed: string, doc: Document): SelectorTestResult {
    const list = doc.querySelectorAll(trimmed);
    return {
        Expression: trimmed,
        Kind: "Css",
        MatchCount: list.length,
        FirstMatch: list.length > 0 ? readDomContext(list[0]) : null,
        Error: null,
    };
}

function selectorErrorResult(
    trimmed: string, useKind: "Css" | "XPath", err: unknown,
): SelectorTestResult {
    return {
        Expression: trimmed,
        Kind: useKind,
        MatchCount: 0,
        FirstMatch: null,
        Error: err instanceof Error ? err.message : String(err),
    };
}

function readDomContext(element: Element): DomContext {
    const attrs = readContextAttributes(element);
    return {
        TagName: element.tagName.toLowerCase(),
        Id: attrs.id,
        ClassName: attrs.className,
        AriaLabel: attrs.ariaLabel,
        Name: attrs.name,
        Type: attrs.type,
        TextSnippet: (element.textContent ?? "").trim().slice(0, 120),
        OuterHtmlSnippet: element.outerHTML?.slice(0, 240) ?? "",
    };
}

interface ContextAttrs {
    id: string | null; className: string | null; ariaLabel: string | null;
    name: string | null; type: string | null;
}

function readContextAttributes(element: Element): ContextAttrs {
    return {
        id:        nonEmptyAttr(element, "id"),
        className: nonEmptyAttr(element, "class"),
        ariaLabel: nonEmptyAttr(element, "aria-label"),
        name:      nonEmptyAttr(element, "name"),
        type:      nonEmptyAttr(element, "type"),
    };
}

function nonEmptyAttr(element: Element, name: string): string | null {
    const value = element.getAttribute(name);
    return value !== null && value.length > 0 ? value : null;
}
