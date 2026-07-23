/**
 * Marco Extension — Data-Source Drop-Zone Overlay
 *
 * Phase 07 — Macro Recorder.
 *
 * Renders a fixed full-viewport drop target inside a closed Shadow Root that
 * activates when the user drags a file over the page. Accepts CSV / JSON
 * files, parses them via {@link parseCsv} / {@link parseJson}, and forwards
 * the parsed result to the caller through {@link DropZoneOptions.OnFileDropped}.
 *
 * The overlay is *passive* — it never persists. The caller is expected to
 * forward the payload to `RECORDER_DATA_SOURCE_ADD` or equivalent.
 *
 * @see ./data-source-parsers.ts — Pure CSV/JSON parsers used here.
 * @see spec/31-macro-recorder/07-data-source-drop-zone.md
 */

import { DataSourceKindId } from "../recorder-db-schema";
import { parseCsv, parseJson, type ParsedDataSource } from "./data-source-parsers";

export const DROPZONE_HOST_ID = "marco-recorder-dropzone-host";

export interface DroppedDataSource {
    readonly FileName: string;
    readonly MimeKind: "csv" | "json";
    readonly RawText: string;
    readonly Parsed: ParsedDataSource;
}

export interface DropZoneOptions {
    readonly OnFileDropped: (file: DroppedDataSource) => void;
    /** Optional error sink — defaults to console.warn. */
    readonly OnError?: (err: Error, fileName: string) => void;
}

export interface DropZoneHandle {
    readonly Host: HTMLElement;
    readonly Root: ShadowRoot;
    /** True while a drag operation is hovering over the page. */
    IsActive(): boolean;
    Destroy(): void;
}

const STYLE = `
:host { all: initial; }
.overlay {
    position: fixed; inset: 0; z-index: 2147483646;
    display: none; align-items: center; justify-content: center;
    background: rgba(17, 17, 17, .55);
    pointer-events: none;
    font: 600 16px/1.4 system-ui, -apple-system, sans-serif;
    color: #fff;
}
.overlay[data-active="true"] { display: flex; pointer-events: auto; }
.panel {
    border: 2px dashed #fff; border-radius: 12px;
    padding: 28px 36px; background: rgba(0,0,0,.45);
    text-align: center;
}
.panel small { display: block; font-weight: 400; opacity: .75; margin-top: 6px; }
`;

interface DropZoneNodes {
    readonly host: HTMLElement;
    readonly root: ShadowRoot;
    readonly overlay: HTMLDivElement;
}

interface DropZoneState {
    dragDepth: number;
    active: boolean;
}

interface DropZoneHandlers {
    readonly onDragEnter: (event: DragEvent) => void;
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragLeave: () => void;
    readonly onDrop: (event: DragEvent) => void;
}

export function mountDropZoneOverlay(
    options: DropZoneOptions,
    container: ParentNode = document.body,
): DropZoneHandle {
    if (container === null || container === undefined) {
        throw new Error("mountDropZoneOverlay: no container available");
    }
    const nodes = buildDropZoneNodes(container);
    const state: DropZoneState = { dragDepth: 0, active: false };
    const handlers = createDropZoneHandlers(nodes.overlay, state, options);
    attachDropZoneListeners(handlers);
    return buildDropZoneHandle(nodes, state, handlers);
}

function buildDropZoneNodes(container: ParentNode): DropZoneNodes {
    const host = document.createElement("div");
    host.id = DROPZONE_HOST_ID;
    const root = host.attachShadow({ mode: "closed" });
    root.appendChild(buildDropZoneStyle());
    const overlay = buildDropZoneOverlayEl();
    root.appendChild(overlay);
    container.appendChild(host);
    return { host, root, overlay };
}

function buildDropZoneStyle(): HTMLStyleElement {
    const style = document.createElement("style");
    style.textContent = STYLE;
    return style;
}

function buildDropZoneOverlayEl(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.dataset.active = "false";
    overlay.innerHTML =
        '<div class="panel">Drop CSV or JSON to attach<small>.csv · .json — first row used as header for CSV</small></div>';
    return overlay;
}

function createDropZoneHandlers(
    overlay: HTMLDivElement,
    state: DropZoneState,
    options: DropZoneOptions,
): DropZoneHandlers {
    const setActive = (on: boolean): void => {
        state.active = on;
        overlay.dataset.active = on ? "true" : "false";
    };
    return {
        onDragEnter: (event) => handleDragEnter(event, state, setActive),
        onDragOver:  (event) => handleDragOver(event),
        onDragLeave: () => handleDragLeave(state, setActive),
        onDrop:      (event) => handleDrop(event, state, setActive, options),
    };
}

function handleDragEnter(event: DragEvent, state: DropZoneState, setActive: (on: boolean) => void): void {
    if (!hasFiles(event.dataTransfer)) { return; }
    event.preventDefault();
    state.dragDepth += 1;
    if (state.dragDepth === 1) { setActive(true); }
}

function handleDragOver(event: DragEvent): void {
    if (!hasFiles(event.dataTransfer)) { return; }
    event.preventDefault();
    if (event.dataTransfer !== null) { event.dataTransfer.dropEffect = "copy"; }
}

function handleDragLeave(state: DropZoneState, setActive: (on: boolean) => void): void {
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) { setActive(false); }
}

function handleDrop(
    event: DragEvent,
    state: DropZoneState,
    setActive: (on: boolean) => void,
    options: DropZoneOptions,
): void {
    event.preventDefault();
    state.dragDepth = 0;
    setActive(false);
    const files = event.dataTransfer?.files;
    if (files === undefined || files.length === 0) { return; }
    for (const file of Array.from(files)) {
        void handleFile(file, options);
    }
}

function attachDropZoneListeners(handlers: DropZoneHandlers): void {
    window.addEventListener("dragenter", handlers.onDragEnter);
    window.addEventListener("dragover",  handlers.onDragOver);
    window.addEventListener("dragleave", handlers.onDragLeave);
    window.addEventListener("drop",      handlers.onDrop);
}

function buildDropZoneHandle(
    nodes: DropZoneNodes,
    state: DropZoneState,
    handlers: DropZoneHandlers,
): DropZoneHandle {
    let destroyed = false;
    return {
        Host: nodes.host,
        Root: nodes.root,
        IsActive: () => state.active,
        Destroy: () => {
            if (destroyed) { return; }
            destroyed = true;
            detachDropZoneListeners(handlers);
            nodes.host.remove();
        },
    };
}

function detachDropZoneListeners(handlers: DropZoneHandlers): void {
    window.removeEventListener("dragenter", handlers.onDragEnter);
    window.removeEventListener("dragover",  handlers.onDragOver);
    window.removeEventListener("dragleave", handlers.onDragLeave);
    window.removeEventListener("drop",      handlers.onDrop);
}

function hasFiles(dt: DataTransfer | null): boolean {
    if (dt === null) { return false; }
    return Array.from(dt.types).includes("Files");
}

async function handleFile(file: File, options: DropZoneOptions): Promise<void> {
    const onError = options.OnError ?? ((err, name) => console.warn(`[DropZone] ${name}: ${err.message}`));
    try {
        const mimeKind = detectMimeKind(file);
        if (mimeKind === null) {
            throw new Error(`Unsupported file type — accepts .csv / .json (got '${file.name}')`);
        }
        const rawText = await file.text();
        const parsed = mimeKind === "csv" ? parseCsv(rawText) : parseJson(rawText);
        options.OnFileDropped({ FileName: file.name, MimeKind: mimeKind, RawText: rawText, Parsed: parsed });
    } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)), file.name);
    }
}

function detectMimeKind(file: File): "csv" | "json" | null {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv"))  { return "csv";  }
    if (lower.endsWith(".json")) { return "json"; }
    if (file.type === "text/csv")          { return "csv";  }
    if (file.type === "application/json")  { return "json"; }
    return null;
}

export { DataSourceKindId };
