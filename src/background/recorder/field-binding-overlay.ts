/**
 * Marco Extension — Hover Field-Binding Overlay
 *
 * Phase 08 — Macro Recorder.
 *
 * In-page UI mounted in a closed Shadow Root that follows the cursor as the
 * user hovers over input-like elements (`input`, `textarea`,
 * `[contenteditable]`). Shows a column picker — clicking a column emits a
 * binding payload that the caller persists via `RECORDER_FIELD_BINDING_UPSERT`.
 *
 * The overlay does *not* mutate the host page (no `{{Column}}` is written
 * into the input). It also previews the resolved value via
 * {@link resolveFieldReferences} when a sample row is supplied.
 *
 * ### Multi-column composer (Phase 08.1)
 * When the popover is pinned (user clicked the target), the overlay enters
 * composer mode: an editable template input + live preview let the user
 * combine multiple `{{Column}}` placeholders before committing. Clicking a
 * column appends `{{Column}}` to the template at the caret. The preview
 * resolves every placeholder against `SampleRow` on every keystroke.
 * Pressing "Bind" emits a single payload describing the full template.
 *
 * @see ./field-reference-resolver.ts — `{{Column}}` substitution
 * @see spec/31-macro-recorder/08-field-reference-wrapper.md
 */

import {
    extractReferencedColumns,
    resolveFieldReferences,
    type FieldRow,
} from "./field-reference-resolver";

export const FIELD_BINDING_HOST_ID = "marco-recorder-field-binding-host";

export interface FieldBindingOptions {
    /** Column names available in the active data source. */
    readonly Columns: ReadonlyArray<string>;
    /** Optional sample row used to preview the resolved value of a column. */
    readonly SampleRow?: FieldRow;
    /** Invoked when the user clicks a column for the currently-hovered field. */
    readonly OnBind: (binding: FieldBindingPayload) => void;
}

export interface FieldBindingPayload {
    readonly Target: HTMLElement;
    /**
     * The first column referenced by `Template`, or the single column the
     * user clicked. Kept for backwards compatibility with single-column
     * callers; multi-column templates expose every name via `Columns`.
     */
    readonly ColumnName: string;
    /** Every distinct column referenced in `Template`, in first-occurrence order. */
    readonly Columns: ReadonlyArray<string>;
    /** Final template, e.g. `"{{First}} {{Last}}"` or `"{{Email}}"`. */
    readonly Template: string;
    /** Resolved preview against `SampleRow`, or `null` when unavailable. */
    readonly PreviewValue: string | null;
}

export interface FieldBindingHandle {
    readonly Host: HTMLElement;
    readonly Root: ShadowRoot;
    /** Currently-hovered bindable element, if any. */
    GetHoveredTarget(): HTMLElement | null;
    /** Current composer template string. Empty when not in composer mode. */
    GetTemplate(): string;
    Destroy(): void;
}

const STYLE = `
:host { all: initial; }
.popover {
    position: fixed; z-index: 2147483645;
    display: none; min-width: 220px; max-width: 300px;
    padding: 8px; border-radius: 8px;
    background: #111; color: #fff;
    font: 500 12px/1.3 system-ui, -apple-system, sans-serif;
    box-shadow: 0 6px 20px rgba(0,0,0,.45);
}
.popover[data-open="true"] { display: block; }
.title { font-size: 10px; opacity: .7; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
.col {
    display: flex; justify-content: space-between; gap: 10px;
    width: 100%; box-sizing: border-box;
    appearance: none; border: 0; cursor: pointer;
    padding: 5px 8px; border-radius: 6px;
    background: transparent; color: inherit; font: inherit; text-align: left;
}
.col:hover, .col:focus { background: #2a2a2a; outline: none; }
.col-name { font-weight: 600; }
.col-preview { opacity: .65; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composer { margin-top: 8px; padding-top: 8px; border-top: 1px solid #2a2a2a; display: none; }
.composer[data-open="true"] { display: block; }
.template-input {
    width: 100%; box-sizing: border-box;
    padding: 5px 8px; border-radius: 6px;
    border: 1px solid #2a2a2a; background: #0b0b0b; color: #fff;
    font: 500 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.template-input:focus { outline: none; border-color: #16a34a; }
.preview {
    margin-top: 6px; padding: 5px 8px; border-radius: 6px;
    background: #0b0b0b; color: #d1fae5;
    font: 500 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all; min-height: 18px;
}
.preview[data-error="true"] { color: #fecaca; }
.preview-label { font-size: 10px; opacity: .55; text-transform: uppercase; letter-spacing: .08em; margin-top: 6px; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.tag {
    display: inline-block; padding: 2px 6px; border-radius: 4px;
    background: #1f2937; color: #93c5fd; font-size: 11px;
}
.actions { display: flex; gap: 6px; margin-top: 8px; }
.btn {
    appearance: none; border: 0; cursor: pointer;
    padding: 6px 10px; border-radius: 6px;
    font: 600 12px/1 system-ui, -apple-system, sans-serif;
}
.btn-primary { background: #16a34a; color: #fff; flex: 1; }
.btn-primary:disabled { background: #374151; cursor: not-allowed; }
.btn-secondary { background: transparent; color: #9ca3af; }
.btn-secondary:hover { color: #fff; }
.outline {
    position: fixed; z-index: 2147483644; pointer-events: none;
    border: 2px solid #16a34a; border-radius: 4px; display: none;
}
.outline[data-open="true"] { display: block; }
`;

const BINDABLE_SELECTOR = "input, textarea, [contenteditable=''], [contenteditable='true']";

interface State {
    options: FieldBindingOptions;
    host: HTMLElement;
    popover: HTMLDivElement;
    outline: HTMLDivElement;
    composer: HTMLDivElement | null;
    templateInput: HTMLInputElement | null;
    preview: HTMLDivElement | null;
    tagsRow: HTMLDivElement | null;
    bindBtn: HTMLButtonElement | null;
    hovered: HTMLElement | null;
    pinned: boolean;
    template: string;
}

function buildTitle(text: string): HTMLDivElement {
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = text;
    return t;
}

function buildColumnButton(col: string, sampleRow: FieldRow | undefined, onClick: (c: string) => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "col";
    btn.dataset.column = col;
    btn.setAttribute("role", "menuitem");
    const name = document.createElement("span");
    name.className = "col-name";
    name.textContent = col;
    btn.appendChild(name);
    const colPreview = document.createElement("span");
    colPreview.className = "col-preview";
    colPreview.textContent = sampleRow?.[col] ?? "";
    btn.appendChild(colPreview);
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); });
    btn.addEventListener("click", () => { onClick(col); });
    return btn;
}

function buildTemplateInput(state: State): HTMLInputElement {
    const templateInput = document.createElement("input");
    templateInput.type = "text";
    templateInput.className = "template-input";
    templateInput.placeholder = "{{First}} {{Last}}";
    templateInput.spellcheck = false;
    templateInput.addEventListener("input", () => {
        state.template = templateInput.value;
        refreshPreview(state);
    });
    templateInput.addEventListener("mousedown", (e) => { e.stopPropagation(); });
    templateInput.addEventListener("click", (e) => { e.stopPropagation(); });
    state.templateInput = templateInput;
    return templateInput;
}

function buildPreviewBlock(state: State): DocumentFragment {
    const frag = document.createDocumentFragment();
    const previewLabel = document.createElement("div");
    previewLabel.className = "preview-label";
    previewLabel.textContent = "Preview";
    frag.appendChild(previewLabel);
    const preview = document.createElement("div");
    preview.className = "preview";
    frag.appendChild(preview);
    state.preview = preview;
    const tagsRow = document.createElement("div");
    tagsRow.className = "tags";
    frag.appendChild(tagsRow);
    state.tagsRow = tagsRow;
    return frag;
}

function buildComposer(state: State): HTMLDivElement {
    const composer = document.createElement("div");
    composer.className = "composer";
    composer.dataset.open = "false";
    composer.appendChild(buildTitle("Template"));
    composer.appendChild(buildTemplateInput(state));
    composer.appendChild(buildPreviewBlock(state));
    composer.appendChild(buildComposerActions(state));
    return composer;
}

function buildBindButton(state: State): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = "Bind";
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener("click", (e) => { e.stopPropagation(); commitTemplate(state); });
    state.bindBtn = btn;
    return btn;
}

function buildClearButton(state: State): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary";
    btn.textContent = "Clear";
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.template = "";
        if (state.templateInput !== null) { state.templateInput.value = ""; }
        refreshPreview(state);
        state.templateInput?.focus();
    });
    return btn;
}

function buildComposerActions(state: State): HTMLDivElement {
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(buildBindButton(state));
    actions.appendChild(buildClearButton(state));
    return actions;
}

function renderColumns(state: State): void {
    state.popover.innerHTML = "";
    state.popover.appendChild(buildTitle("Bind to column"));
    for (const col of state.options.Columns) {
        state.popover.appendChild(buildColumnButton(col, state.options.SampleRow, (c) => handleColumnClick(state, c)));
    }
    state.composer = buildComposer(state);
    state.popover.appendChild(state.composer);
}

function handleColumnClick(state: State, col: string): void {
    if (state.hovered === null) { return; }
    const token = `{{${col}}}`;
    if (state.pinned) {
        insertTokenIntoTemplate(state, token);
        refreshPreview(state);
        state.templateInput?.focus();
        return;
    }
    emitBinding(state, token);
    hide(state);
}

function insertTokenIntoTemplate(state: State, token: string): void {
    if (state.templateInput === null) {
        state.template = `${state.template}${token}`;
        return;
    }
    const start = state.templateInput.selectionStart ?? state.template.length;
    const end = state.templateInput.selectionEnd ?? state.template.length;
    const next = `${state.template.slice(0, start)}${token}${state.template.slice(end)}`;
    state.template = next;
    state.templateInput.value = next;
    const caret = start + token.length;
    state.templateInput.setSelectionRange(caret, caret);
}

function renderPreviewTags(state: State, cols: ReadonlyArray<string>): void {
    if (state.tagsRow === null) { return; }
    state.tagsRow.innerHTML = "";
    for (const c of cols) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = c;
        state.tagsRow.appendChild(tag);
    }
}

function renderResolvedPreview(state: State, preview: HTMLElement): void {
    if (state.options.SampleRow === undefined) {
        preview.textContent = state.template;
        preview.dataset.error = "false";
        return;
    }
    try {
        preview.textContent = resolveFieldReferences(state.template, state.options.SampleRow);
        preview.dataset.error = "false";
    } catch (err) {
        preview.textContent = err instanceof Error ? err.message : String(err);
        preview.dataset.error = "true";
    }
}

function refreshPreview(state: State): void {
    if (state.preview === null || state.tagsRow === null) return;
    renderPreviewTags(state, extractReferencedColumns(state.template));
    if (state.template === "") {
        state.preview.textContent = "";
        state.preview.dataset.error = "false";
        if (state.bindBtn !== null) state.bindBtn.disabled = true;
        return;
    }
    renderResolvedPreview(state, state.preview);
    if (state.bindBtn !== null) state.bindBtn.disabled = false;
}

function commitTemplate(state: State): void {
    if (state.hovered === null || state.template === "") { return; }
    emitBinding(state, state.template);
    state.pinned = false;
    state.template = "";
    if (state.templateInput !== null) { state.templateInput.value = ""; }
    refreshPreview(state);
    hide(state);
}

function emitBinding(state: State, tpl: string): void {
    if (state.hovered === null) { return; }
    const cols = extractReferencedColumns(tpl);
    const primary = cols[0] ?? "";
    let previewValue: string | null = null;
    if (state.options.SampleRow !== undefined) {
        try { previewValue = resolveFieldReferences(tpl, state.options.SampleRow); }
        catch { previewValue = null; }
    }
    state.options.OnBind({
        Target: state.hovered,
        ColumnName: primary,
        Columns: cols,
        Template: tpl,
        PreviewValue: previewValue,
    });
}

function show(state: State, target: HTMLElement): void {
    state.hovered = target;
    const rect = target.getBoundingClientRect();
    state.outline.style.left = `${rect.left}px`;
    state.outline.style.top = `${rect.top}px`;
    state.outline.style.width = `${rect.width}px`;
    state.outline.style.height = `${rect.height}px`;
    state.outline.dataset.open = "true";

    state.popover.style.left = `${rect.left}px`;
    state.popover.style.top = `${rect.bottom + 6}px`;
    state.popover.dataset.open = "true";

    if (state.composer !== null) {
        state.composer.dataset.open = state.pinned ? "true" : "false";
    }
    if (state.pinned) { refreshPreview(state); }
}

function hide(state: State): void {
    if (state.pinned) { return; }
    state.hovered = null;
    state.outline.dataset.open = "false";
    state.popover.dataset.open = "false";
    if (state.composer !== null) { state.composer.dataset.open = "false"; }
}

function isOurNode(state: State, node: EventTarget | null): boolean {
    return node === state.host || (node instanceof Node && state.host.contains(node));
}

function onMove(state: State, e: MouseEvent): void {
    if (state.pinned) { return; }
    const t = e.target;
    if (isOurNode(state, t)) { return; }
    if (!(t instanceof HTMLElement)) { hide(state); return; }
    const candidate = t.closest(BINDABLE_SELECTOR);
    if (candidate instanceof HTMLElement) { show(state, candidate); }
    else { hide(state); }
}

function onClick(state: State, e: MouseEvent): void {
    const t = e.target;
    if (isOurNode(state, t)) { return; }
    if (!(t instanceof HTMLElement)) { return; }
    const candidate = t.closest(BINDABLE_SELECTOR);
    if (candidate instanceof HTMLElement) {
        e.preventDefault();
        state.pinned = true;
        show(state, candidate);
        refreshPreview(state);
    } else {
        state.pinned = false;
        state.template = "";
        if (state.templateInput !== null) { state.templateInput.value = ""; }
        hide(state);
    }
}

function buildShadowDom(container: ParentNode): { host: HTMLElement; root: ShadowRoot; popover: HTMLDivElement; outline: HTMLDivElement } {
    const host = document.createElement("div");
    host.id = FIELD_BINDING_HOST_ID;
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
    const outline = document.createElement("div");
    outline.className = "outline";
    outline.dataset.open = "false";
    root.appendChild(outline);
    const popover = document.createElement("div");
    popover.className = "popover";
    popover.dataset.open = "false";
    popover.setAttribute("role", "menu");
    popover.setAttribute("aria-label", "Field bindings");
    root.appendChild(popover);
    container.appendChild(host);
    return { host, root, popover, outline };
}

function initOverlayState(options: FieldBindingOptions, container: ParentNode): { state: State; root: ShadowRoot } {
    const { host, root, popover, outline } = buildShadowDom(container);
    const state: State = {
        options, host, popover, outline,
        composer: null, templateInput: null, preview: null, tagsRow: null, bindBtn: null,
        hovered: null, pinned: false, template: "",
    };
    renderColumns(state);
    return { state, root };
}

function attachOverlayListeners(state: State): { move: (e: MouseEvent) => void; click: (e: MouseEvent) => void } {
    const move = (e: MouseEvent): void => onMove(state, e);
    const click = (e: MouseEvent): void => onClick(state, e);
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    return { move, click };
}

export function mountFieldBindingOverlay(
    options: FieldBindingOptions,
    container: ParentNode = document.body,
): FieldBindingHandle {
    if (container === null || container === undefined) {
        throw new Error("mountFieldBindingOverlay: no container available");
    }
    const { state, root } = initOverlayState(options, container);
    const handlers = attachOverlayListeners(state);
    let destroyed = false;
    return {
        Host: state.host, Root: root,
        GetHoveredTarget: () => state.hovered,
        GetTemplate: () => state.template,
        Destroy: () => {
            if (destroyed) { return; }
            destroyed = true;
            document.removeEventListener("mousemove", handlers.move, true);
            document.removeEventListener("click", handlers.click, true);
            state.host.remove();
        },
    };
}
