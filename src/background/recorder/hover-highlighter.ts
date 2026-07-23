/**
 * Marco Extension — Hover Highlighter
 *
 * Phase 17 — Macro Recorder.
 *
 * Renders two nested overlays — a primary outline of the element under the
 * cursor and a dashed outline of its smart group container — into a single
 * shadow-root host with `pointer-events: none`. No DOM mutation of the
 * inspected element. Active in three modes:
 *
 *   - "recording" — auto-on while a recorder session runs.
 *   - "replay"   — auto-on while the replay runner ticks (listens for
 *                  `replay:step:start` / `replay:step:end` CustomEvents).
 *   - "inspector" — on-demand toggle from the recorder toolbar.
 *
 * Alt-key cycling: while Alt is held, mouse-wheel up/down moves the primary
 * outline up/down the ancestor chain; releasing Alt resets the offset on the
 * next mousemove.
 *
 * @see spec/31-macro-recorder/17-hover-highlighter-and-data-controllers.md
 */

export type HighlighterMode = "off" | "recording" | "replay" | "inspector";

export interface HoverHighlighterHandle {
    readonly Host: HTMLElement;
    SetMode(mode: HighlighterMode): void;
    GetMode(): HighlighterMode;
    /** Manually outline an element (used by replay listeners). */
    Outline(target: Element | null): void;
    Destroy(): void;
}

export const HOVER_HIGHLIGHTER_HOST_ID = "marco-hover-highlighter";

const SMART_GROUP_ROLE_SELECTOR =
    '[role="group"], [role="region"], [role="listitem"], [role="row"]';

/* ------------------------------------------------------------------ */
/*  Smart group detection (spec §1.3)                                  */
/* ------------------------------------------------------------------ */

export function findSmartGroup(el: Element): Element | null {
    const form = el.closest("form");
    if (form !== null) return form;

    const fieldset = el.closest("fieldset");
    if (fieldset !== null) return fieldset;

    const tr = el.closest("tr");
    if (tr !== null) return tr;

    const role = el.closest(SMART_GROUP_ROLE_SELECTOR);
    if (role !== null) return role;

    const cardLike = closestByClassToken(el, ["card", "panel", "field-row", "form-group"]);
    if (cardLike !== null) return cardLike;

    const flexGrid = closestFlexOrGrid(el);
    if (flexGrid !== null) return flexGrid;

    return el.parentElement;
}

function closestByClassToken(el: Element, tokens: ReadonlyArray<string>): Element | null {
    let current: Element | null = el;
    while (current !== null) {
        const cls = current.className;
        const isString = typeof cls === "string";
        if (isString) {
            const lower = cls.toLowerCase();
            const hasToken = tokens.some((t) => lower.includes(t));
            if (hasToken) return current;
        }
        current = current.parentElement;
    }
    return null;
}

function closestFlexOrGrid(el: Element): Element | null {
    let current: Element | null = el.parentElement;
    while (current !== null) {
        const styles = current.ownerDocument?.defaultView?.getComputedStyle(current);
        const display = styles?.display ?? "";
        const isFlexOrGrid = display === "flex" || display === "grid";
        const hasMultipleChildren = current.childElementCount >= 2;
        if (isFlexOrGrid && hasMultipleChildren) return current;
        current = current.parentElement;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Ancestor offset                                                    */
/* ------------------------------------------------------------------ */

export function nthAncestor(el: Element, depth: number): Element {
    let current: Element = el;
    let remaining = depth;
    while (remaining > 0 && current.parentElement !== null) {
        current = current.parentElement;
        remaining--;
    }
    return current;
}

/* ------------------------------------------------------------------ */
/*  Mount                                                              */
/* ------------------------------------------------------------------ */

interface InternalState {
    Mode: HighlighterMode;
    HoverTarget: Element | null;
    AncestorOffset: number;
    AltHeld: boolean;
    RafToken: number | null;
}

const STYLE = `
:host { all: initial; }
.outline-primary, .outline-group, .chip {
    position: fixed;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 2147483647;
    transition: transform 80ms linear, width 80ms linear, height 80ms linear;
}
.outline-primary {
    border: 2px solid hsl(217 91% 60%);
    background: hsla(217, 91%, 60%, 0.08);
    border-radius: 2px;
}
.outline-group {
    border: 1px dashed hsl(280 80% 65%);
    border-radius: 4px;
}
.chip {
    font: 11px/1.4 ui-monospace, monospace;
    background: hsl(222 47% 11% / 0.92);
    color: hsl(0 0% 100%);
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.hidden { display: none; }
`;

interface HighlighterNodes {
    readonly host: HTMLElement;
    readonly primaryEl: HTMLDivElement;
    readonly groupEl: HTMLDivElement;
    readonly chipEl: HTMLDivElement;
}

interface HighlighterHandlers {
    readonly onMouseMove: (event: MouseEvent) => void;
    readonly onKeyDown: (event: KeyboardEvent) => void;
    readonly onKeyUp: (event: KeyboardEvent) => void;
    readonly onWheel: (event: WheelEvent) => void;
    readonly onReplayStart: (event: Event) => void;
    readonly onReplayEnd: () => void;
}

export function mountHoverHighlighter(
    doc: Document = document,
): HoverHighlighterHandle {
    removeExistingHighlighterHost(doc);
    const nodes = buildHighlighterNodes(doc);
    const state: InternalState = {
        Mode: "off", HoverTarget: null, AncestorOffset: 0, AltHeld: false, RafToken: null,
    };
    const schedulePaint = createPaintScheduler(nodes, state, doc);
    const handlers = createHighlighterHandlers(nodes.host, state, schedulePaint);
    attachHighlighterListeners(doc, handlers);
    return buildHighlighterHandle(nodes.host, state, schedulePaint, doc, handlers);
}

function removeExistingHighlighterHost(doc: Document): void {
    const existing = doc.getElementById(HOVER_HIGHLIGHTER_HOST_ID);
    if (existing !== null) { existing.remove(); }
}

function buildHighlighterNodes(doc: Document): HighlighterNodes {
    const host = doc.createElement("div");
    host.id = HOVER_HIGHLIGHTER_HOST_ID;
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    doc.body.appendChild(host);
    const root = host.attachShadow({ mode: "closed" });
    appendHighlighterStyle(doc, root);
    const { primaryEl, groupEl, chipEl } = createHighlighterOverlays(doc);
    root.append(groupEl, primaryEl, chipEl);
    return { host, primaryEl, groupEl, chipEl };
}

function appendHighlighterStyle(doc: Document, root: ShadowRoot): void {
    const style = doc.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
}

function createHighlighterOverlays(doc: Document): {
    primaryEl: HTMLDivElement; groupEl: HTMLDivElement; chipEl: HTMLDivElement;
} {
    const groupEl = doc.createElement("div");
    groupEl.className = "outline-group hidden";
    const primaryEl = doc.createElement("div");
    primaryEl.className = "outline-primary hidden";
    const chipEl = doc.createElement("div");
    chipEl.className = "chip hidden";
    return { primaryEl, groupEl, chipEl };
}

function createPaintScheduler(
    nodes: HighlighterNodes, state: InternalState, doc: Document,
): () => void {
    const paint = (): void => {
        state.RafToken = null;
        renderHighlighter(nodes, state);
    };
    return () => {
        if (state.RafToken !== null) { return; }
        const win = doc.defaultView;
        if (win === null) { return; }
        state.RafToken = win.requestAnimationFrame(paint);
    };
}

function renderHighlighter(nodes: HighlighterNodes, state: InternalState): void {
    const target = state.HoverTarget;
    if (target === null || state.Mode === "off") {
        hideHighlighterNodes(nodes);
        return;
    }
    const resolved = nthAncestor(target, state.AncestorOffset);
    paintPrimary(nodes.primaryEl, resolved);
    paintGroup(nodes.groupEl, resolved);
    paintChip(nodes.chipEl, resolved, state.AncestorOffset);
}

function hideHighlighterNodes(nodes: HighlighterNodes): void {
    nodes.primaryEl.classList.add("hidden");
    nodes.groupEl.classList.add("hidden");
    nodes.chipEl.classList.add("hidden");
}

function paintPrimary(primaryEl: HTMLDivElement, resolved: Element): void {
    applyRect(primaryEl, resolved.getBoundingClientRect());
    primaryEl.classList.remove("hidden");
}

function paintGroup(groupEl: HTMLDivElement, resolved: Element): void {
    const group = findSmartGroup(resolved);
    if (group !== null && group !== resolved) {
        applyRect(groupEl, group.getBoundingClientRect());
        groupEl.classList.remove("hidden");
    } else {
        groupEl.classList.add("hidden");
    }
}

function paintChip(chipEl: HTMLDivElement, resolved: Element, depthOffset: number): void {
    const rect = resolved.getBoundingClientRect();
    chipEl.textContent = describeElement(resolved, depthOffset);
    chipEl.style.transform =
        `translate(${Math.round(rect.left)}px, ${Math.round(Math.max(rect.top - 18, 0))}px)`;
    chipEl.classList.remove("hidden");
}

function createHighlighterHandlers(
    host: HTMLElement, state: InternalState, schedulePaint: () => void,
): HighlighterHandlers {
    return {
        onMouseMove: (event) => handleHighlighterMouseMove(event, host, state, schedulePaint),
        onKeyDown: (event) => handleHighlighterKeyDown(event, state, schedulePaint),
        onKeyUp: (event) => { if (event.key === "Alt") { state.AltHeld = false; } },
        onWheel: (event) => handleHighlighterWheel(event, state, schedulePaint),
        onReplayStart: (event) => handleReplayStart(event, state, schedulePaint),
        onReplayEnd: () => handleReplayEnd(state, schedulePaint),
    };
}

function handleHighlighterMouseMove(
    event: MouseEvent, host: HTMLElement, state: InternalState, schedulePaint: () => void,
): void {
    if (state.Mode === "off") { return; }
    const target = event.target;
    if (!(target instanceof Element)) { return; }
    if (host.contains(target)) { return; }
    if (state.HoverTarget !== target) {
        state.HoverTarget = target;
        if (!state.AltHeld) { state.AncestorOffset = 0; }
    }
    schedulePaint();
}

function handleHighlighterKeyDown(
    event: KeyboardEvent, state: InternalState, schedulePaint: () => void,
): void {
    if (event.key !== "Alt") { return; }
    state.AltHeld = true;
    if (state.AncestorOffset === 0) { state.AncestorOffset = 1; }
    schedulePaint();
}

function handleHighlighterWheel(
    event: WheelEvent, state: InternalState, schedulePaint: () => void,
): void {
    if (!state.AltHeld) { return; }
    const direction = event.deltaY < 0 ? 1 : -1;
    state.AncestorOffset = Math.max(0, state.AncestorOffset + direction);
    schedulePaint();
}

function handleReplayStart(event: Event, state: InternalState, schedulePaint: () => void): void {
    if (state.Mode !== "replay") { return; }
    const detail = (event as CustomEvent<{ Element?: Element }>).detail;
    const target = detail?.Element ?? null;
    if (target === null) { return; }
    state.HoverTarget = target;
    state.AncestorOffset = 0;
    schedulePaint();
}

function handleReplayEnd(state: InternalState, schedulePaint: () => void): void {
    if (state.Mode !== "replay") { return; }
    state.HoverTarget = null;
    schedulePaint();
}

function attachHighlighterListeners(doc: Document, handlers: HighlighterHandlers): void {
    doc.addEventListener("mousemove", handlers.onMouseMove, { passive: true });
    doc.addEventListener("keydown", handlers.onKeyDown, { passive: true });
    doc.addEventListener("keyup", handlers.onKeyUp, { passive: true });
    doc.addEventListener("wheel", handlers.onWheel, { passive: true });
    doc.addEventListener("replay:step:start", handlers.onReplayStart);
    doc.addEventListener("replay:step:end", handlers.onReplayEnd);
}

function detachHighlighterListeners(doc: Document, handlers: HighlighterHandlers): void {
    doc.removeEventListener("mousemove", handlers.onMouseMove);
    doc.removeEventListener("keydown", handlers.onKeyDown);
    doc.removeEventListener("keyup", handlers.onKeyUp);
    doc.removeEventListener("wheel", handlers.onWheel);
    doc.removeEventListener("replay:step:start", handlers.onReplayStart);
    doc.removeEventListener("replay:step:end", handlers.onReplayEnd);
}

function buildHighlighterHandle(
    host: HTMLElement,
    state: InternalState,
    schedulePaint: () => void,
    doc: Document,
    handlers: HighlighterHandlers,
): HoverHighlighterHandle {
    return {
        Host: host,
        SetMode(mode) {
            state.Mode = mode;
            if (mode === "off") { state.HoverTarget = null; state.AncestorOffset = 0; }
            schedulePaint();
        },
        GetMode() { return state.Mode; },
        Outline(target) { state.HoverTarget = target; state.AncestorOffset = 0; schedulePaint(); },
        Destroy() { detachHighlighterListeners(doc, handlers); host.remove(); },
    };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function applyRect(el: HTMLElement, r: DOMRect): void {
    el.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
    el.style.width = `${Math.round(r.width)}px`;
    el.style.height = `${Math.round(r.height)}px`;
}

export function describeElement(el: Element, depthOffset: number): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id !== "" ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className !== ""
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    const depth = depthOffset > 0 ? `  · depth +${depthOffset}` : "";
    return `${tag}${id}${cls}${depth}`;
}
