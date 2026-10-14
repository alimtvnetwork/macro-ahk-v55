import { Events } from "@/constants/events";
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
import { mountDropZoneOverlay, type DropZoneHandle } from "../background/recorder/dropzone-overlay";
import {
  RECORDER_SESSION_STORAGE_KEY,
  type RecordingPhase,
  type RecordingSession,
} from "../background/recorder/recorder-session-types";
import { persistSession } from "../background/recorder/recorder-session-storage";
import { FullStrategyType } from "../../standalone-scripts/macro-controller/src/types/enums";

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let isActive = true;
let toolbarHandle: RecorderToolbarHandle | null = null;
let dropzoneHandle: DropZoneHandle | null = null;

/** Window sentinel — skips duplicate init when the script is injected twice. */
const RECORDER_SENTINEL = "__marcoXPathRecorderActive";

/** True once this page has an initialised recorder (duplicate-injection guard). */
function hasActiveRecorder(): boolean {
  return Boolean((window as unknown as Record<string, unknown>)[RECORDER_SENTINEL]);
}

function markRecorderActive(): void {
  (window as unknown as Record<string, unknown>)[RECORDER_SENTINEL] = true;
}

function clearRecorderSentinel(): void {
  delete (window as unknown as Record<string, unknown>)[RECORDER_SENTINEL];
}

/**
 * Drives the page-local toolbar to the given phase without re-firing
 * redundant transitions (each toolbar action re-persists via OnPhaseChange,
 * so this must be a no-op when already in phase to avoid ping-pong).
 */
function syncToolbarPhase(phase: RecordingPhase): void {
  if (toolbarHandle === null) {
    return;
  }

  const current = toolbarHandle.GetSession().Phase;

  if (current === phase) {
    return;
  }

  if (phase === "Recording") {
    if (current === "Idle") {
      toolbarHandle.Start();
    } else if (current === "Paused") {
      toolbarHandle.Resume();
    }

    return;
  }

  if (phase === "Paused" && current === "Recording") {
    toolbarHandle.Pause();
  }
}

/**
 * Applies an externally changed session (shortcut toggle, popup UI) to the
 * page-local capture gate + toolbar. The key removal means Idle → full stop.
 */
function handleSessionStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local") {
    return;
  }

  const change = changes[RECORDER_SESSION_STORAGE_KEY];

  if (change === undefined) {
    return;
  }

  const next = change.newValue as RecordingSession | undefined;

  if (next === undefined) {
    stopRecorder();

    return;
  }

  isActive = next.Phase === "Recording";
  syncToolbarPhase(next.Phase);
}

/** Window-event entry for the background stop signal. */
function onStopEvent(): void {
  stopRecorder();
}

/* ------------------------------------------------------------------ */
/*  XPath Generation — Priority Strategy                               */
/* ------------------------------------------------------------------ */

type FullStrategy = FullStrategyType;

interface FullCapture {
    xpath: string;
    strategy: FullStrategy;
}

/** Generates an XPath for the given element using priority strategy. */
function generateXPath(element: Element): FullCapture {
  const byId = tryIdStrategy(element);

  if (byId !== null) {
    return byId;
  }

  const byTestId = tryTestIdStrategy(element);

  if (byTestId !== null) {
    return byTestId;
  }

  const byRole = tryRoleTextStrategy(element);

  if (byRole !== null) {
    return byRole;
  }

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
  if (isActive === false) {
    return;
  }

  const target = event.target as Element;

  if (isExcludedElement(target)) {
    return;
  }
    
  // Do not preventDefault or stopPropagation here, otherwise the user
  // cannot interact with the page normally while recording.

  const payload = buildCapturePayload(target);
  enqueueCapture(payload);

  highlightElement(target);
}

const inputDebounceMap = new WeakMap<Element, number>();

function onElementInput(event: Event): void {
  if (isActive === false) {
    return;
  }

  const target = event.target as Element;

  if (isExcludedElement(target)) {
    return;
  }

  const value = (target as HTMLInputElement | HTMLTextAreaElement).value;

  if (value === undefined) {
    return;
  }

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
  if (isActive === false) {
    return;
  }

  const target = event.target as Element;

  if (isExcludedElement(target)) {
    return;
  }

  const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

  if (value === undefined) {
    return;
  }

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
  if (isActive === false) {
    return;
  }

  const target = event.target as Element;

  if (isExcludedElement(target)) {
    return;
  }

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

  if (entry === undefined) {
    return;
  }

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
  if (activeHighlights.size < MAX_CONCURRENT_HIGHLIGHTS) {
    return;
  }

  const oldest = activeHighlights.keys().next().value;

  if (oldest !== undefined) {
    clearHighlight(oldest);
  }
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

    if (entry === undefined) {
      return;
    }

    htmlElement.style.outline = entry.originalOutline;
    activeHighlights.delete(htmlElement);
  }, HIGHLIGHT_DURATION_MS);

  activeHighlights.set(htmlElement, { timerId, originalOutline });
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

/** Toolbar phase transitions: persist via the canonical key + gate captures. */
function handleToolbarPhaseChange(phase: RecordingPhase, nextSession: RecordingSession): void {
  // Sync back to background through the canonical session key
  // (Idle removes the key, mirroring persistSession). The capture
  // gate follows the live phase: Paused suspends capture.
  persistSession(nextSession).catch((err: unknown) => {
    console.warn("[Marco] recorder session persist failed", err);
  });
  isActive = phase === "Recording";
}

/** Mounts the recorder toolbar + drop-zone overlay for the loaded session. */
function mountRecorderUi(session: RecordingSession | undefined): void {
  const projectSlug = session?.ProjectSlug || "default";

  toolbarHandle = mountRecorderToolbar({
    ProjectSlug: projectSlug,
    NewSessionId: () => `sess-${Date.now().toString(36)}`,
    Now: () => new Date().toISOString(),
    OnPhaseChange: handleToolbarPhaseChange,
  });

  // Sync the toolbar to the current session state
  if (session) {
    if (session.Phase === "Recording") {
      toolbarHandle.Start();
    } else if (session.Phase === "Paused") {
      toolbarHandle.Start();
      toolbarHandle.Pause();
    }
  }

  dropzoneHandle = mountDropZoneOverlay({
    OnFileDropped: (file) => {
      chrome.runtime.sendMessage({
        type: "RECORDER_DATA_SOURCE_ADD",
        projectSlug: session?.ProjectSlug || "default",
        filePath: file.FileName,
        mimeKind: file.MimeKind,
        rawText: file.RawText
      });
    }
  });
}

/** Starts the XPath recorder. */
function startRecorder(): void {
  document.addEventListener(Events.CLICK, onElementClick, true);
  document.addEventListener(Events.INPUT, onElementInput, true);
  document.addEventListener(Events.CHANGE, onElementChange, true);
  document.addEventListener(Events.KEYDOWN, onElementKeydown, true);
  console.log("[Marco] XPath recorder started");

  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.onChanged.addListener(handleSessionStorageChange);
    chrome.storage.local.get(RECORDER_SESSION_STORAGE_KEY, (data) => {
      const session = data[RECORDER_SESSION_STORAGE_KEY] as RecordingSession | undefined;
      mountRecorderUi(session);
    });
  }
}

/** Stops the XPath recorder. Tears down listeners + outstanding timers. */
function stopRecorder(): void {
  isActive = false;
  document.removeEventListener(Events.CLICK, onElementClick, true);
  document.removeEventListener(Events.INPUT, onElementInput, true);
  document.removeEventListener(Events.CHANGE, onElementChange, true);
  document.removeEventListener(Events.KEYDOWN, onElementKeydown, true);
  clearAllHighlights();
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("marco-xpath-stop", onStopEvent);

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handleSessionStorageChange);
  }

  // Drop the duplicate-injection sentinel so the next Start re-injects cleanly.
  clearRecorderSentinel();
  // PERF-R6: drain any queued captures before teardown.
  void flushNow();
    
  if (toolbarHandle) {
    toolbarHandle.Destroy();
    toolbarHandle = null;
  }

  if (dropzoneHandle) {
    dropzoneHandle.Destroy();
    dropzoneHandle = null;
  }
    
  console.log("[Marco] XPath recorder stopped");
}

/** Pagehide teardown — mem://standards/timer-and-observer-teardown. */
function onPageHide(): void {
  stopRecorder();
}

if (hasActiveRecorder()) {
  // Duplicate injection (e.g. shortcut pressed twice): the running instance
  // already owns the listeners + toolbar — do not double-mount.
  console.log("[Marco] XPath recorder already active — skipping duplicate init");
} else {
  markRecorderActive();

  /** Listens for the stop event from the background handler. */
  window.addEventListener("marco-xpath-stop", onStopEvent);

  window.addEventListener("pagehide", onPageHide);

  startRecorder();
}
