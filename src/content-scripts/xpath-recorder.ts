/**
 * Marco Extension — Content Script: XPath Recorder
 *
 * Injected programmatically when the user toggles recording.
 * Listens for clicks, generates XPaths using a priority strategy
 * (ID > testid > role+text > positional), highlights elements,
 * and reports a `RecorderCaptureMessage` (Phase 06 schema) back to the
 * background service worker.
 *
 * Exclusions: iframes, Shadow DOM, SVG elements.
 *
 * Canonical source — chrome-extension/src/content-scripts/ re-exports from here.
 */

import {
    tryIdStrategy,
    tryTestIdStrategy,
    tryRoleTextStrategy,
    buildPositionalXPath,
} from "./xpath-strategies";
import {
    findAutoAnchor,
    buildRelativeXPath,
} from "./xpath-anchor-strategies";
import { suggestVariableName } from "./xpath-label-suggester";
import { enqueueCapture, flushNow } from "./xpath-capture-coalescer";
import { mountRecorderToolbar, type RecorderToolbarHandle, type RecorderToolbarOptions } from "../background/recorder/recorder-toolbar";
import type { RecordingPhase, RecordingSession } from "../background/recorder/recorder-session-types";

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let isActive = true;
let toolbarHandle: RecorderToolbarHandle | null = null;

/* ------------------------------------------------------------------ */
/*  XPath Generation — Priority Strategy                               */
/* ------------------------------------------------------------------ */

type FullStrategy = "id" | "testid" | "role-text" | "positional";

interface FullCapture {
    xpath: string;
    strategy: FullStrategy;
}

/** Generates an XPath for the given element using priority strategy. */
function generateXPath(element: Element): FullCapture {
    const byId = tryIdStrategy(element);
    if (byId !== null) return byId;

    const byTestId = tryTestIdStrategy(element);
    if (byTestId !== null) return byTestId;

    const byRole = tryRoleTextStrategy(element);
    if (byRole !== null) return byRole;

    return buildPositionalXPath(element);
}

/* ------------------------------------------------------------------ */
/*  Element Filtering                                                  */
/* ------------------------------------------------------------------ */

/** Returns true if the element should be excluded from recording. */
function isExcludedElement(element: Element): boolean {
    const isIframe = element.tagName === "IFRAME";
    const isSvg = element instanceof SVGElement;
    const isInShadowDom = element.getRootNode() instanceof ShadowRoot;

    return isIframe || isSvg || isInShadowDom;
}

/* ------------------------------------------------------------------ */
/*  Capture Builder                                                    */
/* ------------------------------------------------------------------ */

/** Builds the Phase-06 XPATH_CAPTURED payload for the background worker. */
export function buildCapturePayload(target: Element, value?: string): {
    type: "XPATH_CAPTURED";
    XPathFull: string;
    XPathRelative: string | null;
    AnchorXPath: string | null;
    Strategy: FullStrategy;
    SuggestedVariableName: string;
    TagName: string;
    Text: string;
    Value?: string;
    CapturedAt: string;
} {
    const generated = generateXPath(target);
    const anchor = findAutoAnchor(target);
    const relative = anchor === null ? null : buildRelativeXPath(target, anchor);
    const anchorXPath = anchor === null ? null : generateXPath(anchor).xpath;

    const urlTabClickHint = {
        Tag: target.tagName.toLowerCase(),
        Target: target.getAttribute("target") ?? undefined,
        Href: (target as HTMLAnchorElement).href ?? undefined,
        LocationOrigin: window.location.origin,
        WindowOpenCalled: false,
    };

    return {
        type: "XPATH_CAPTURED",
        XPathFull: generated.xpath,
        XPathRelative: relative,
        AnchorXPath: anchorXPath,
        Strategy: generated.strategy,
        SuggestedVariableName: suggestVariableName(target),
        TagName: target.tagName.toLowerCase(),
        Text: target.textContent?.trim().slice(0, 100) ?? "",
        Value: value,
        UrlTabClickHint: urlTabClickHint,
        CapturedAt: new Date().toISOString(),
    };
}

/* ------------------------------------------------------------------ */
/*  Click Handler                                                      */
/* ------------------------------------------------------------------ */

/** Handles click events to record XPaths. */
function onElementClick(event: MouseEvent): void {
    if (isActive === false) return;

    const target = event.target as Element;
    if (isExcludedElement(target)) return;
    
    // Do not preventDefault or stopPropagation here, otherwise the user
    // cannot interact with the page normally while recording.

    const payload = buildCapturePayload(target);
    enqueueCapture(payload);

    highlightElement(target);
}

const inputDebounceMap = new WeakMap<Element, number>();

function onElementInput(event: Event): void {
    if (isActive === false) return;
    const target = event.target as Element;
    if (isExcludedElement(target)) return;

    const value = (target as HTMLInputElement | HTMLTextAreaElement).value;
    if (value === undefined) return;

    // Debounce input events to avoid spamming the backend on every keystroke.
    const existingTimer = inputDebounceMap.get(target);
    if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(() => {
        inputDebounceMap.delete(target);
        const payload = buildCapturePayload(target, (target as HTMLInputElement).value);
        enqueueCapture(payload);
        highlightElement(target);
    }, 500);

    inputDebounceMap.set(target, timerId);
}

function onElementChange(event: Event): void {
    if (isActive === false) return;
    const target = event.target as Element;
    if (isExcludedElement(target)) return;

    const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    if (value === undefined) return;

    const existingTimer = inputDebounceMap.get(target);
    if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        inputDebounceMap.delete(target);
    }

    const payload = buildCapturePayload(target, value);
    enqueueCapture(payload);
    highlightElement(target);
}

function onElementKeydown(event: KeyboardEvent): void {
    if (isActive === false) return;
    const target = event.target as Element;
    if (isExcludedElement(target)) return;

    if (event.key === "Enter") {
        const payload = buildCapturePayload(target, "{Enter}");
        enqueueCapture(payload);
        highlightElement(target);
    }
}

/* ------------------------------------------------------------------ */
/*  Visual Highlight (PERF-R5 — bounded timeouts, per-element reset)   */
/* ------------------------------------------------------------------ */

const HIGHLIGHT_DURATION_MS = 1500;
const MAX_CONCURRENT_HIGHLIGHTS = 32;

/** Active highlight timers keyed by element so re-clicks reset cleanly. */
const activeHighlights = new Map<HTMLElement, { timerId: number; originalOutline: string }>();

/** Clears a single element's highlight and restores its outline. */
function clearHighlight(htmlElement: HTMLElement): void {
    const entry = activeHighlights.get(htmlElement);
    if (entry === undefined) return;
    window.clearTimeout(entry.timerId);
    htmlElement.style.outline = entry.originalOutline;
    activeHighlights.delete(htmlElement);
}

/** Clears every active highlight (called on stop / pagehide). */
function clearAllHighlights(): void {
    Array.from(activeHighlights.keys()).forEach((el) => clearHighlight(el));
}

/** Drops the oldest highlight if the bound is exceeded. */
function trimHighlightStack(): void {
    if (activeHighlights.size < MAX_CONCURRENT_HIGHLIGHTS) return;
    const oldest = activeHighlights.keys().next().value;
    if (oldest !== undefined) clearHighlight(oldest);
}

/** Briefly highlights the clicked element. Bounded + per-element idempotent. */
function highlightElement(element: Element): void {
    const htmlElement = element as HTMLElement;
    clearHighlight(htmlElement);
    trimHighlightStack();

    const originalOutline = htmlElement.style.outline;
    htmlElement.style.outline = "2px solid #ff6b35";

    const timerId = window.setTimeout(() => {
        const entry = activeHighlights.get(htmlElement);
        if (entry === undefined) return;
        htmlElement.style.outline = entry.originalOutline;
        activeHighlights.delete(htmlElement);
    }, HIGHLIGHT_DURATION_MS);

    activeHighlights.set(htmlElement, { timerId, originalOutline });
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

/** Starts the XPath recorder. */
function startRecorder(): void {
    document.addEventListener("click", onElementClick, true);
    document.addEventListener("input", onElementInput, true);
    document.addEventListener("change", onElementChange, true);
    document.addEventListener("keydown", onElementKeydown, true);
    console.log("[Marco] XPath recorder started");

    if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("marco.recorder.session", (data) => {
            const session = data["marco.recorder.session"] as RecordingSession | undefined;
            const projectSlug = session?.ProjectSlug || "default";
            
            toolbarHandle = mountRecorderToolbar({
                ProjectSlug: projectSlug,
                NewSessionId: () => `sess-${Date.now().toString(36)}`,
                Now: () => new Date().toISOString(),
                OnPhaseChange: (phase, nextSession) => {
                    // Sync back to background
                    chrome.storage.local.set({ "marco.recorder.session": nextSession });
                }
            });
            
            // Sync the toolbar to the current session state
            if (session) {
                if (session.Phase === "Recording") toolbarHandle.Start();
                else if (session.Phase === "Paused") {
                    toolbarHandle.Start();
                    toolbarHandle.Pause();
                }
            }
        });
    }
}

/** Stops the XPath recorder. Tears down listeners + outstanding timers. */
function stopRecorder(): void {
    isActive = false;
    document.removeEventListener("click", onElementClick, true);
    document.removeEventListener("input", onElementInput, true);
    document.removeEventListener("change", onElementChange, true);
    document.removeEventListener("keydown", onElementKeydown, true);
    clearAllHighlights();
    window.removeEventListener("pagehide", onPageHide);
    // PERF-R6: drain any queued captures before teardown.
    void flushNow();
    
    if (toolbarHandle) {
        toolbarHandle.Destroy();
        toolbarHandle = null;
    }
    
    console.log("[Marco] XPath recorder stopped");
}

/** Pagehide teardown — mem://standards/timer-and-observer-teardown. */
function onPageHide(): void {
    stopRecorder();
}

/** Listens for the stop event from the background handler. */
window.addEventListener("marco-xpath-stop", () => {
    stopRecorder();
});

window.addEventListener("pagehide", onPageHide);

startRecorder();
