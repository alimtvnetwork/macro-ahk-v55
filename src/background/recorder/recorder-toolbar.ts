/**
 * Marco Extension — Shadow-Root Recorder Toolbar
 *
 * Self-contained floating toolbar mounted into a closed Shadow DOM so that
 * host-page CSS cannot leak in. Wraps the pure {@link recorderReducer} and
 * exposes three controls — Start, Pause/Resume, Stop — that drive the
 * RecordingPhase state machine.
 *
 * No chrome.* APIs, no React — pure DOM so it can be injected by the content
 * script during macro recording. State changes are emitted via the
 * {@link RecorderToolbarOptions.onPhaseChange} callback so the caller can
 * persist sessions, broadcast messages, or wire shortcuts on top.
 *
 * @see ./recorder-store.ts          — Pure reducer this toolbar drives.
 * @see ./recorder-session-types.ts  — RecordingPhase / RecordingSession types.
 * @see spec/26-chrome-extension-generic/06-ui-and-design-system/10-toolbar-recording-ux.md
 */

import {
    IDLE_SESSION,
    type RecorderAction,
    recorderReducer,
} from "./recorder-store";
import type { RecordingPhase, RecordingSession } from "./recorder-session-types";

/* ------------------------------------------------------------------ */
/*  Public contract                                                    */
/* ------------------------------------------------------------------ */

export const RECORDER_TOOLBAR_HOST_ID = "marco-recorder-toolbar-host";

export interface RecorderToolbarOptions {
    readonly ProjectSlug: string;
    /** Factory for SessionId — injected so tests are deterministic. */
    readonly NewSessionId: () => string;
    /** Wall-clock provider — injected so tests are deterministic. */
    readonly Now: () => string;
    /** Notified after each successful phase transition. */
    readonly OnPhaseChange?: (phase: RecordingPhase, session: RecordingSession) => void;
}

export interface RecorderToolbarHandle {
    /** The DOM host element appended to <body>. */
    readonly Host: HTMLElement;
    /** The closed Shadow Root containing the toolbar UI. */
    readonly Root: ShadowRoot;
    /** Current immutable session snapshot. */
    GetSession(): RecordingSession;
    /** Programmatic equivalents of the three buttons. */
    Start(): void;
    Pause(): void;
    Resume(): void;
    Stop(): void;
    /** Removes the toolbar from the DOM. Idempotent. */
    Destroy(): void;
}

/* ------------------------------------------------------------------ */
/*  Styling — scoped inside the shadow root                            */
/* ------------------------------------------------------------------ */

const TOOLBAR_CSS = `
:host { all: initial; }
.toolbar {
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    display: inline-flex; gap: 6px; padding: 8px 10px;
    background: #111; color: #fff; border-radius: 8px;
    font: 500 12px/1 system-ui, -apple-system, sans-serif;
    box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.btn {
    appearance: none; border: 0; cursor: pointer;
    padding: 6px 10px; border-radius: 6px;
    background: #2a2a2a; color: #fff; font: inherit;
}
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn[data-action="start"]  { background: #16a34a; }
.btn[data-action="pause"]  { background: #f59e0b; color: #111; }
.btn[data-action="resume"] { background: #16a34a; }
.btn[data-action="stop"]   { background: #dc2626; }
.phase {
    align-self: center; padding: 0 8px;
    text-transform: uppercase; letter-spacing: .08em; font-size: 10px;
}
.project {
    align-self: center; display: none; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: 999px;
    background: #1f2937; color: #e5e7eb;
    font-size: 11px; max-width: 220px;
}
.project[data-active="true"] { display: inline-flex; }
.project .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,.7);
    animation: marco-pulse 1.4s infinite;
}
.project[data-phase="Paused"] .dot {
    background: #f59e0b; animation: none;
}
.project .label {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 180px; font-weight: 600;
}
@keyframes marco-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.6); }
    70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
.health {
    align-self: center; display: inline-flex; align-items: center; gap: 8px;
    padding: 4px 8px; border-radius: 6px;
    background: #0b1220; color: #cbd5e1;
    font-size: 11px; font-variant-numeric: tabular-nums;
    border: 1px solid #1f2937;
}
.health .hdot {
    width: 6px; height: 6px; border-radius: 50%; background: #64748b;
}
.health[data-status="ok"]    .hdot { background: #22c55e; }
.health[data-status="warn"]  .hdot { background: #f59e0b; }
.health[data-status="error"] .hdot { background: #ef4444; }
.health .sep { opacity: .4; }
.health .muted { color: #94a3b8; }
`;

/* ------------------------------------------------------------------ */
/*  Mount                                                              */
/* ------------------------------------------------------------------ */

interface ToolbarNodes {
    readonly host: HTMLElement;
    readonly root: ShadowRoot;
    readonly phaseLabel: HTMLSpanElement;
    readonly projectChip: HTMLSpanElement;
    readonly healthChip: HTMLSpanElement;
    readonly healthText: HTMLSpanElement;
    readonly healthCapture: HTMLSpanElement;
    readonly startBtn: HTMLButtonElement;
    readonly pauseBtn: HTMLButtonElement;
    readonly stopBtn: HTMLButtonElement;
}

interface SessionRef { current: RecordingSession; }

interface ToolbarActions {
    readonly start: () => void;
    readonly pause: () => void;
    readonly resume: () => void;
    readonly stop: () => void;
}

interface ToolbarLifecycle {
    readonly destroy: () => void;
}

export function mountRecorderToolbar(
    options: RecorderToolbarOptions,
    container: ParentNode = (typeof document !== "undefined" ? document.body : (null as unknown as ParentNode)),
): RecorderToolbarHandle {
    if (container === null || container === undefined) {
        throw new Error("mountRecorderToolbar: no container available (document.body missing)");
    }
    const sessionRef: SessionRef = { current: IDLE_SESSION };
    const nodes = buildToolbarNodes(options, container);
    const render = (): void => renderToolbar(nodes, sessionRef.current, options);
    const actions = createToolbarActions(options, sessionRef, render);
    wireToolbarButtons(nodes, actions, sessionRef);
    render();
    const lifecycle = installToolbarLifecycle(nodes, render);
    return buildToolbarHandle(nodes, sessionRef, actions, lifecycle);
}

function buildToolbarNodes(options: RecorderToolbarOptions, container: ParentNode): ToolbarNodes {
    const host = document.createElement("div");
    host.id = RECORDER_TOOLBAR_HOST_ID;
    const root = host.attachShadow({ mode: "closed" });
    appendToolbarStyle(root);
    const bar = createToolbarBar();
    const chips = buildToolbarChips(options);
    const buttons = buildToolbarButtons();
    bar.append(chips.phaseLabel, chips.projectChip, chips.healthChip, buttons.startBtn, buttons.pauseBtn, buttons.stopBtn);
    root.appendChild(bar);
    container.appendChild(host);
    return { host, root, ...chips, ...buttons };
}

function appendToolbarStyle(root: ShadowRoot): void {
    const style = document.createElement("style");
    style.textContent = TOOLBAR_CSS;
    root.appendChild(style);
}

function createToolbarBar(): HTMLDivElement {
    const bar = document.createElement("div");
    bar.className = "toolbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Marco Recorder");
    return bar;
}

interface ToolbarChips {
    phaseLabel: HTMLSpanElement;
    projectChip: HTMLSpanElement;
    healthChip: HTMLSpanElement;
    healthText: HTMLSpanElement;
    healthCapture: HTMLSpanElement;
}

function buildToolbarChips(options: RecorderToolbarOptions): ToolbarChips {
    const phaseLabel = document.createElement("span");
    phaseLabel.className = "phase";
    const projectChip = buildProjectChip(options.ProjectSlug);
    const { healthChip, healthText, healthCapture } = buildHealthChip();
    return { phaseLabel, projectChip, healthChip, healthText, healthCapture };
}

function buildProjectChip(slug: string): HTMLSpanElement {
    const projectChip = document.createElement("span");
    projectChip.className = "project";
    projectChip.setAttribute("aria-label", "Active recording project");
    projectChip.title = `Steps will be saved to project: ${slug}`;
    const dot = document.createElement("span");
    dot.className = "dot";
    const text = document.createElement("span");
    text.className = "label";
    text.textContent = slug;
    projectChip.append(dot, text);
    return projectChip;
}

function buildHealthChip(): {
    healthChip: HTMLSpanElement; healthText: HTMLSpanElement; healthCapture: HTMLSpanElement;
} {
    const healthChip = document.createElement("span");
    healthChip.className = "health";
    healthChip.setAttribute("aria-label", "Recorder health");
    const dot = document.createElement("span");
    dot.className = "hdot";
    const healthText = document.createElement("span");
    healthText.className = "htext";
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    const healthCapture = document.createElement("span");
    healthCapture.className = "muted";
    healthChip.append(dot, healthText, sep, healthCapture);
    return { healthChip, healthText, healthCapture };
}

function buildToolbarButtons(): {
    startBtn: HTMLButtonElement; pauseBtn: HTMLButtonElement; stopBtn: HTMLButtonElement;
} {
    return {
        startBtn: makeButton("start", "Start"),
        pauseBtn: makeButton("pause", "Pause"),
        stopBtn:  makeButton("stop",  "Stop"),
    };
}

function createToolbarActions(
    options: RecorderToolbarOptions, sessionRef: SessionRef, render: () => void,
): ToolbarActions {
    const dispatch = (action: RecorderAction): void => {
        const next = recorderReducer(sessionRef.current, action);
        sessionRef.current = next;
        render();
        options.OnPhaseChange?.(next.Phase, next);
    };
    return {
        start: () => dispatch({
            Kind: "Start",
            ProjectSlug: options.ProjectSlug,
            SessionId: options.NewSessionId(),
            StartedAt: options.Now(),
        }),
        pause:  () => dispatch({ Kind: "Pause"  }),
        resume: () => dispatch({ Kind: "Resume" }),
        stop:   () => dispatch({ Kind: "Stop"   }),
    };
}

function wireToolbarButtons(
    nodes: ToolbarNodes, actions: ToolbarActions, sessionRef: SessionRef,
): void {
    nodes.startBtn.addEventListener("click", () => actions.start());
    nodes.stopBtn.addEventListener("click",  () => actions.stop());
    nodes.pauseBtn.addEventListener("click", () => {
        const phase = sessionRef.current.Phase;
        if (phase === "Recording") { actions.pause(); return; }
        if (phase === "Paused") { actions.resume(); }
    });
}

function renderToolbar(nodes: ToolbarNodes, session: RecordingSession, options: RecorderToolbarOptions): void {
    const phase = session.Phase;
    nodes.phaseLabel.textContent = phase;
    renderProjectChip(nodes.projectChip, phase);
    renderStartStop(nodes, phase);
    renderPauseButton(nodes.pauseBtn, phase);
    renderHealthChip(nodes, session, options);
}

function renderProjectChip(projectChip: HTMLSpanElement, phase: RecordingPhase): void {
    const isActive = phase === "Recording" || phase === "Paused";
    projectChip.dataset.active = isActive ? "true" : "false";
    projectChip.dataset.phase = phase;
}

function renderStartStop(nodes: ToolbarNodes, phase: RecordingPhase): void {
    nodes.startBtn.disabled = phase !== "Idle";
    nodes.stopBtn.disabled  = phase === "Idle";
}

function renderPauseButton(pauseBtn: HTMLButtonElement, phase: RecordingPhase): void {
    if (phase === "Paused") {
        pauseBtn.textContent = "Resume";
        pauseBtn.dataset.action = "resume";
        pauseBtn.disabled = false;
        return;
    }
    pauseBtn.textContent = "Pause";
    pauseBtn.dataset.action = "pause";
    pauseBtn.disabled = phase !== "Recording";
}

function renderHealthChip(
    nodes: ToolbarNodes, session: RecordingSession, options: RecorderToolbarOptions,
): void {
    const projectOk = options.ProjectSlug.length > 0;
    const stepCount = session.Steps.length;
    const lastStep = stepCount > 0 ? session.Steps[stepCount - 1] : null;
    nodes.healthChip.dataset.status = computeHealthStatus(session.Phase, stepCount, projectOk);
    const projectLabel = projectOk ? options.ProjectSlug : "no project";
    nodes.healthText.textContent = `${projectLabel} · ${stepCount} step${stepCount === 1 ? "" : "s"}`;
    nodes.healthCapture.textContent = formatCaptureLabel(session.Phase, lastStep, options.Now());
    nodes.healthChip.title = formatHealthTitle(projectLabel, session.Phase, stepCount, lastStep);
}

function computeHealthStatus(
    phase: RecordingPhase, stepCount: number, projectOk: boolean,
): "idle" | "ok" | "warn" | "error" {
    if (!projectOk) { return "error"; }
    if (phase === "Recording") { return stepCount > 0 ? "ok" : "warn"; }
    if (phase === "Paused") { return "warn"; }
    return "idle";
}

function formatCaptureLabel(
    phase: RecordingPhase, lastStep: RecordingSession["Steps"][number] | null, nowIso: string,
): string {
    if (lastStep === null) { return phase === "Idle" ? "not recording" : "awaiting capture"; }
    return `last ${formatRelative(lastStep.CapturedAt, nowIso)}`;
}

function formatHealthTitle(
    projectLabel: string,
    phase: RecordingPhase,
    stepCount: number,
    lastStep: RecordingSession["Steps"][number] | null,
): string {
    return `Project: ${projectLabel}\n`
        + `Phase: ${phase}\n`
        + `Steps captured: ${stepCount}\n`
        + `Last capture: ${lastStep?.CapturedAt ?? "—"}`;
}

// L-2 (audit 2026-05-15): visibility-aware tick + pagehide teardown.
const TICK_INTERVAL_MS = 5000;

function installToolbarLifecycle(nodes: ToolbarNodes, render: () => void): ToolbarLifecycle {
    const hasWindow = typeof window !== "undefined";
    const hasDocument = typeof document !== "undefined";
    const tick = (): void => { if (!(hasDocument && document.hidden)) { render(); } };
    const tickInterval = hasWindow ? window.setInterval(tick, TICK_INTERVAL_MS) : 0;
    const onVisibilityChange = (): void => { if (hasDocument && !document.hidden) { render(); } };
    if (hasDocument) { document.addEventListener("visibilitychange", onVisibilityChange); }
    const state = { destroyed: false };
    const destroy = (): void => teardownToolbar(state, nodes.host, tickInterval, onVisibilityChange, onPageHide, hasWindow, hasDocument);
    const onPageHide = (): void => destroy();
    if (hasWindow) { window.addEventListener("pagehide", onPageHide, { once: true }); }
    return { destroy };
}

function teardownToolbar(
    state: { destroyed: boolean },
    host: HTMLElement,
    tickInterval: number,
    onVisibilityChange: () => void,
    onPageHide: () => void,
    hasWindow: boolean,
    hasDocument: boolean,
): void {
    if (state.destroyed) { return; }
    state.destroyed = true;
    if (tickInterval !== 0 && hasWindow) { window.clearInterval(tickInterval); }
    if (hasDocument) { document.removeEventListener("visibilitychange", onVisibilityChange); }
    if (hasWindow) { window.removeEventListener("pagehide", onPageHide); }
    host.remove();
}

function buildToolbarHandle(
    nodes: ToolbarNodes, sessionRef: SessionRef, actions: ToolbarActions, lifecycle: ToolbarLifecycle,
): RecorderToolbarHandle {
    return {
        Host: nodes.host,
        Root: nodes.root,
        GetSession: () => sessionRef.current,
        Start: actions.start,
        Pause: actions.pause,
        Resume: actions.resume,
        Stop: actions.stop,
        Destroy: lifecycle.destroy,
    };
}

function makeButton(action: "start" | "pause" | "stop", label: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.dataset.action = action;
    btn.textContent = label;
    return btn;
}

function formatRelative(thenIso: string, nowIso: string): string {
    const then = Date.parse(thenIso);
    const now = Date.parse(nowIso);
    if (Number.isNaN(then) || Number.isNaN(now)) { return "just now"; }
    const deltaSec = Math.max(0, Math.round((now - then) / 1000));
    if (deltaSec < 5) { return "just now"; }
    if (deltaSec < 60) { return `${deltaSec}s ago`; }
    const min = Math.floor(deltaSec / 60);
    if (min < 60) { return `${min}m ago`; }
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
}
