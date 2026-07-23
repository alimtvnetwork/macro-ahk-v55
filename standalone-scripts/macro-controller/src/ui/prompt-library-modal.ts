/**
 * prompt-library-modal.ts - plan-14 step 10: user-facing Prompt Library UI.
 *
 * Self-contained modal that lists every row in the `Prompt` table grouped
 * by role (plan / next / generic) and offers three actions per row:
 *   1) Set as default   -> calls setDefaultPromptForRole(id, role)
 *   2) Duplicate        -> calls upsertPrompt with a fresh slug and IsDefault=0
 *   3) Delete           -> calls deletePromptById (which enforces last-row guard)
 *
 * Deliberately kept OUT of the 1400-line `prompt-dropdown.ts` this turn so
 * the diff surface stays minimal and testable. A launcher button will be
 * wired into the dropdown in a follow-up (see remaining task 2).
 *
 * Editing (opening a body editor with token-guard on save) is plan-14
 * step 11 and lives in a follow-up.
 *
 * All errors are surfaced via `logError(LOG_SCOPE, ...)` and
 * rendered inline in the modal so silent failure is impossible.
 */

import { logError } from '../error-utils';
import { log } from '../logger';
import {
    listPromptsByRole,
    setDefaultPromptForRole,
    deletePromptById,
    upsertPrompt,
    type PromptRow,
} from '../db/prompt-db';
import type { PromptRole } from '../types/prompt-role';
import {
    REPLACE_KEY_DEFAULT,
    REPLACE_VALUES_DEFAULT,
    normalizeReplaceValues,
    validateReplaceKey,
} from '../db/prompt-defaults';
import { exportPromptsToJson, parsePromptsText, performPromptImport, previewPromptImport, type ImportProgress, type PromptImportPreview } from './prompt-io';
import { buildFriendlyImportError } from './prompt-import-error-message';
import { openPromptEditor } from './prompt-editor';
import { getSeedBodyForSlug } from '../seed/plan-next-prompts';
import { showToast } from '../toast';
import { ensurePromptModalTheme } from './prompt-modal-theme';

/**
 * Plan-23 step 7: per-role hover copy for the section header. Generic prompts
 * are NOT drift-guarded because they are unstructured user snippets — this
 * tooltip is the single place we document that so users don't wonder why the
 * chip strip is empty when editing a Generic row.
 */
const ROLE_TOOLTIPS: Readonly<Record<PromptRole, string>> = {
    plan: 'Plan chip prompts. The {{n}} token is required and enforced by the drift guard on save.',
    next: 'Next chip prompts. The {{n}} token is required and enforced by the drift guard on save.',
    generic: 'Free-form user snippets. No required tokens — the drift guard does not apply. Add these for reusable text you paste anywhere.',
};

const MODAL_ID = 'macro-prompt-library-modal';
const ROLES: PromptRole[] = ['plan', 'next', 'generic'];
const ROLE_FILTERS: ReadonlyArray<PromptRole | 'all'> = ['all', 'plan', 'next', 'generic'];
const SORT_MODES = ['default-first', 'name', 'length'] as const;
type SortMode = typeof SORT_MODES[number];
const PREVIEW_MAX_CHARS = 240;
const LOG_SCOPE = 'PromptLibraryModal';
const CSS_BORDER_RADIUS_6 = 'border-radius:6px';
const IMPORT_FAILED_PREFIX = 'Import failed: ';
const ATTR_ARIA_LABEL = 'aria-label';
const ATTR_ARIA_VALUENOW = 'aria-valuenow';
const CSS_BORDER_COLOR_DEFAULT = '#2b3648';
const CSS_BORDER_DEFAULT = 'border:1px solid ' + CSS_BORDER_COLOR_DEFAULT;
const CSS_DISPLAY_NONE = 'display:none';
const CSS_MARGIN_BOTTOM_10 = 'margin-bottom:10px';
const CSS_PADDING_10_12 = 'padding:10px 12px';
const CSS_FONT_SIZE_12 = 'font-size:12px';
const CSS_BG_MUTED_1 = 'background:#182033';
const CSS_CURSOR_POINTER = 'cursor:pointer';
const TOAST_ERROR = 'error' as const;
const PREVIEW_FAILED_PREFIX = 'Preview failed: ';
const ATTR_ARIA_VALUETEXT = 'aria-valuetext';

/**
 * logError dedupe for the Import pipeline (v4.186.0). Mirrors the pattern
 * introduced in `prompt-history-panel.ts` (v4.185.0): a user retrying the
 * same rejected file (validation/parse/thrown) previously spammed the
 * audit trail with byte-identical entries. Fixed keys prevent cache blow-
 * up from user-controlled input. Toasts and banners still fire on every
 * attempt; only the telemetry side effect is rate-limited.
 */
const IMPORT_LOG_DEDUPE_WINDOW_MS = 60_000;
interface ImportDedupeEntry { lastAt: number; suppressed: number; }
const _libraryImportFailureDedupe = new Map<string, ImportDedupeEntry>();

/** Exported strictly for unit tests. Not part of the module contract. */
export function _resetLibraryImportFailureDedupeForTests(): void {
    _libraryImportFailureDedupe.clear();
}

function logLibraryImportFailure(key: string, detail: string, cause?: unknown): void {
    const now = Date.now();
    const prev = _libraryImportFailureDedupe.get(key);
    if (prev && (now - prev.lastAt) < IMPORT_LOG_DEDUPE_WINDOW_MS) {
        prev.suppressed += 1;
        prev.lastAt = now;
        return;
    }
    const suffix = prev && prev.suppressed > 0
        ? ' [dedup: ' + String(prev.suppressed) + ' identical entr' + (prev.suppressed === 1 ? 'y' : 'ies') + ' suppressed in prior ' + String(IMPORT_LOG_DEDUPE_WINDOW_MS / 1000) + 's window]'
        : '';
    if (cause === undefined) {
        logError(LOG_SCOPE, 'handleImportFile[' + key + ']: ' + detail + suffix);
    } else {
        logError(LOG_SCOPE, 'handleImportFile[' + key + ']: ' + detail + suffix, cause);
    }
    _libraryImportFailureDedupe.set(key, { lastAt: now, suppressed: 0 });
}


interface ViewState {
    filterRole: PromptRole | 'all';
    sortMode: SortMode;
    expandedIds: Set<number>;
}

interface ActiveEditor {
    row: PromptRow;
    save: () => void;
    cancel: () => void;
}

interface ModalRefs {
    root: HTMLDivElement;
    body: HTMLDivElement;
    status: HTMLDivElement;
    errorBanner: HTMLDivElement;
    fileInfo: HTMLDivElement;
    view: ViewState;
    activeEditor: ActiveEditor | null;
    keyHandler?: (e: KeyboardEvent) => void;
    pagehideHandler?: () => void;
    // Set true whenever an import attempt (validation, parse, or run) fails,
    // cleared on a successful import. Used to announce a "Retrying" prefix on
    // the next attempt via the polite aria-live status region.
    lastImportFailed?: boolean;
    // v4.191.0: header controls for revision-aware export and role-scoped
    // import. Read at click time so the user's final selection is honoured.
    includeRevisionsCb?: HTMLInputElement;
    importRoleSelect?: HTMLSelectElement;
    // v4.192.0: live progress indicator for collection-level imports. The
    // container is hidden by default and shown while a run is in flight so
    // the user can watch revisions being inserted in real time.
    importProgress?: {
        wrap: HTMLDivElement;
        label: HTMLSpanElement;
        bar: HTMLDivElement;
        counter: HTMLSpanElement;
    };
    // Preview step (this change): container + hidden file picker used to
    // show new/updated/revision counts before the user confirms an import.
    previewPanel?: HTMLDivElement;
    previewFileInput?: HTMLInputElement;
    // Partial-failure details panel: per-entry error messages surfaced when
    // performPromptImport returns errors alongside successful writes.
    partialErrorsPanel?: HTMLDivElement;
}



/**
 * Human-readable byte size (B/KB/MB) with a single decimal for KB+. Used to
 * preview the selected import file so users can confirm name + size before
 * the import actually runs.
 */
function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    return (kb / 1024).toFixed(1) + ' MB';
}

/**
 * Render the "Selected file: NAME (SIZE)" preview line so keyboard/screen-reader
 * users can confirm what they picked before the import runs. Polite aria-live
 * so it does not interrupt the existing status region.
 */
function renderSelectedFileInfo(refs: ModalRefs, file: File): void {
    refs.fileInfo.textContent = 'Selected file: ' + file.name + ' (' + formatFileSize(file.size) + ')';
    refs.fileInfo.hidden = false;
    refs.fileInfo.style.display = 'block';
}

/** Public entrypoint. Idempotent: reopening replaces the previous instance. */
export async function openPromptLibraryModal(): Promise<void> {
    log('PromptLibraryModal: open', 'info');
    ensurePromptModalTheme();
    closeExisting();
    const refs = buildShell();
    document.body.appendChild(refs.root);
    // Plan-22 G7 a11y: place initial focus on the Close button so keyboard
    // users start inside the dialog. Focus trap (Tab wrap) is enforced in
    // handleModalKey via focusable-node cycling.
    const closeBtn = refs.root.querySelector<HTMLButtonElement>('button[data-testid="library-close"]');
    if (closeBtn) closeBtn.focus();
    await renderAllRoles(refs);
}

/** Focusable descendants of the modal root, in DOM order, that are visible. */
function focusableNodesIn(root: HTMLElement): HTMLElement[] {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const all = Array.from(root.querySelectorAll<HTMLElement>(sel));
    return all.filter((node) => !node.hasAttribute('disabled') && node.tabIndex !== -1);
}

function closeExisting(): void {
    const prev = document.getElementById(MODAL_ID) as HTMLDivElement | null;
    if (!prev) return;
    // Teardown any listeners we attached in buildShell (memory: timer-and-observer-teardown).
    const key = (prev as unknown as { __keyHandler?: (e: KeyboardEvent) => void }).__keyHandler;
    const ph = (prev as unknown as { __pagehideHandler?: () => void }).__pagehideHandler;
    if (key) document.removeEventListener('keydown', key, true);
    if (ph) window.removeEventListener('pagehide', ph);
    if (prev.parentNode) prev.parentNode.removeChild(prev);
}

// eslint-disable-next-line max-lines-per-function -- shell wiring is naturally long; splitting would fragment aria/style setup
function buildShell(): ModalRefs {
    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483000',
        'background:rgba(0,0,0,0.55)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
        'width:min(720px,92vw)', 'max-height:85vh', 'overflow:auto',
        'background:#121826', 'color:#e6edf7',
        CSS_BORDER_DEFAULT, 'border-radius:10px',
        'box-shadow:0 20px 60px rgba(0,0,0,0.6)',
        'padding:16px 18px',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
    const title = document.createElement('div');
    title.textContent = '🗂 Prompt Library';
    title.style.cssText = 'font-size:15px;font-weight:600;color:#c9b7ff;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

    // Export opt-in: include per-slug revision history in the JSON bundle
    // (v4.190.0 envelope). Off by default so exports stay byte-identical to
    // pre-v4.190 for existing users/tests.
    const includeRevisionsLabel = document.createElement('label');
    includeRevisionsLabel.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#9aa7bd;cursor:pointer;';
    includeRevisionsLabel.title = 'Include per-prompt revision history in the exported JSON.';
    const includeRevisionsCb = document.createElement('input');
    includeRevisionsCb.type = 'checkbox';
    includeRevisionsCb.dataset.testid = 'library-export-include-revisions';
    includeRevisionsCb.style.cssText = 'margin:0;';
    includeRevisionsLabel.appendChild(includeRevisionsCb);
    includeRevisionsLabel.appendChild(document.createTextNode('History'));

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.dataset.testid = 'library-export';
    exportBtn.style.cssText = btnCss('#243050', '#e6edf7');

    // Import scope: restrict which roles are applied on import. 'all' keeps
    // the pre-v4.190 behaviour.
    const importRoleLabel = document.createElement('label');
    importRoleLabel.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#9aa7bd;';
    importRoleLabel.title = 'Only apply imported prompts matching this role. Others are counted as skipped.';
    importRoleLabel.appendChild(document.createTextNode('Import scope:'));
    const importRoleSelect = document.createElement('select');
    importRoleSelect.dataset.testid = 'library-import-role-filter';
    importRoleSelect.style.cssText = 'background:#1a2233;color:#e6edf7;border:1px solid #2b3648;border-radius:4px;padding:2px 4px;font-size:11px;';
    for (const opt of ['all', 'plan', 'next', 'generic'] as const) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt === 'all' ? 'All roles' : opt;
        importRoleSelect.appendChild(o);
    }
    importRoleLabel.appendChild(importRoleSelect);

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.dataset.testid = 'library-import';
    importBtn.style.cssText = btnCss('#243050', '#e6edf7');
    const previewBtn = document.createElement('button');
    previewBtn.textContent = 'Preview';
    previewBtn.dataset.testid = 'library-import-preview';
    previewBtn.title = 'Parse a JSON file and preview how many entries and revisions will be imported before you confirm.';
    previewBtn.style.cssText = btnCss('#243050', '#e6edf7');
    const previewFileInput = document.createElement('input');
    previewFileInput.type = 'file';
    previewFileInput.accept = 'application/json,.json';
    previewFileInput.dataset.testid = 'library-import-preview-file';
    previewFileInput.style.cssText = 'display:none;';
    const sampleBtn = document.createElement('button');
    sampleBtn.textContent = '📄 Sample JSON';
    sampleBtn.dataset.testid = 'library-sample-json';
    sampleBtn.title = 'Download a reference prompts-sample.json you can edit and re-import';
    sampleBtn.style.cssText = btnCss('#243050', '#e6edf7');
    sampleBtn.addEventListener('click', () => {
        void import('./prompt-sample-json').then((m) => m.downloadSamplePromptsJson());
    });
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.dataset.testid = 'library-import-file';
    fileInput.style.cssText = 'display:none;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.dataset.testid = 'library-close';
    closeBtn.style.cssText = btnCss('#2b3648', '#e6edf7');
    closeBtn.addEventListener('click', closeExisting);
    actions.appendChild(includeRevisionsLabel);
    actions.appendChild(exportBtn);
    actions.appendChild(importRoleLabel);
    actions.appendChild(previewBtn);
    actions.appendChild(previewFileInput);
    actions.appendChild(importBtn);
    actions.appendChild(sampleBtn);
    actions.appendChild(fileInput);
    actions.appendChild(closeBtn);


    header.appendChild(title);
    header.appendChild(actions);

    const status = document.createElement('div');
    // Polite live region: success/progress messages (Importing…, summary,
    // Loaded, Saving) are announced by assistive tech without interrupting
    // the user. Failures use the assertive errorBanner below.
    status.dataset.testid = 'library-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.style.cssText = 'font-size:11px;color:#9aa7bd;margin-bottom:8px;min-height:14px;';

    // User-friendly import error banner. Hidden until a parse failure occurs,
    // then rendered with a headline + hint so users see actionable guidance
    // in-place rather than only a toast that auto-dismisses.
    const errorBanner = document.createElement('div');
    errorBanner.dataset.testid = 'library-import-error';
    errorBanner.setAttribute('role', 'alert');
    errorBanner.setAttribute('aria-live', 'assertive');
    // aria-atomic ensures assistive tech speaks the full headline+hint as one
    // announcement instead of incremental child mutations.
    errorBanner.setAttribute('aria-atomic', 'true');
    // tabindex=-1 lets us move keyboard focus to the banner on failure so the
    // error is immediately reachable, without inserting it into the Tab order.
    errorBanner.setAttribute('tabindex', '-1');
    errorBanner.hidden = true;
    errorBanner.style.cssText = [
        CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12,
        'background:#3a1f24', 'color:#ffd7dc',
        'border:1px solid #6b2c34', CSS_BORDER_RADIUS_6,
        CSS_FONT_SIZE_12, 'line-height:1.4',
        'outline-offset:2px',
    ].join(';');

    // Keyboard-accessible drop zone. role=button + tabindex=0 exposes it in the
    // Tab order so users can focus it and press Enter/Space to open the file
    // picker, matching drag-and-drop behavior for mouse users.
    const dropZone = document.createElement('div');
    dropZone.dataset.testid = 'library-drop-zone';
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute(ATTR_ARIA_LABEL, 'Import prompts: drop a JSON file here, or press Enter to choose a file');
    dropZone.style.cssText = [
        CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12,
        'border:1px dashed #3a4863', CSS_BORDER_RADIUS_6,
        CSS_BG_MUTED_1, 'color:#9aa7bd',
        CSS_FONT_SIZE_12, 'text-align:center', CSS_CURSOR_POINTER,
        'outline:2px solid transparent', 'outline-offset:2px',
        'transition:outline-color 120ms ease, box-shadow 120ms ease',
        'display:flex', 'flex-direction:column', 'align-items:center', 'gap:8px',
    ].join(';');
    const dropZoneText = document.createElement('span');
    dropZoneText.textContent = 'Drop a JSON file here, or press Enter to choose a file';
    dropZone.appendChild(dropZoneText);
    // Visible, mouse+keyboard accessible "Choose file" button for users who
    // cannot or prefer not to drag-and-drop. Routes through the same hidden
    // fileInput so the concurrency guard (importBtn.disabled) still applies.
    const chooseFileBtn = document.createElement('button');
    chooseFileBtn.type = 'button';
    chooseFileBtn.textContent = 'Choose file';
    chooseFileBtn.dataset.testid = 'library-choose-file';
    chooseFileBtn.setAttribute(ATTR_ARIA_LABEL, 'Choose a JSON file to import');
    chooseFileBtn.style.cssText = btnCss('#243050', '#e6edf7');
    chooseFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (importBtn.disabled) return;
        fileInput.click();
    });
    chooseFileBtn.addEventListener('keydown', (e) => { e.stopPropagation(); });
    dropZone.appendChild(chooseFileBtn);
    // Explicit high-contrast focus ring: default browser outlines are often
    // invisible on the dark #182033 background, so we paint our own via focus
    // listeners (avoids injecting a global :focus-visible stylesheet).
    const applyFocusRing = (): void => {
        dropZone.style.outlineColor = '#7cc4ff';
        dropZone.style.boxShadow = '0 0 0 4px rgba(124, 196, 255, 0.25)';
        dropZone.style.borderColor = '#7cc4ff';
    };
    const clearFocusRing = (): void => {
        dropZone.style.outlineColor = 'transparent';
        dropZone.style.boxShadow = 'none';
        dropZone.style.borderColor = '#3a4863';
    };
    dropZone.addEventListener('focus', applyFocusRing);
    dropZone.addEventListener('blur', clearFocusRing);

    const body = document.createElement('div');

    // Preview line for the selected import file. Populated on file-picker
    // change and drop so users can see the name + size in the modal before
    // the import runs. Hidden until a file is selected.
    const fileInfo = document.createElement('div');
    fileInfo.dataset.testid = 'library-file-info';
    fileInfo.setAttribute('aria-live', 'polite');
    fileInfo.setAttribute('aria-atomic', 'true');
    fileInfo.hidden = true;
    fileInfo.style.cssText = [
        CSS_DISPLAY_NONE, 'margin-bottom:8px', 'padding:6px 10px',
        CSS_BG_MUTED_1, 'color:#c9d3e6',
        CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6,
        CSS_FONT_SIZE_12,
    ].join(';');

    // v4.192.0: live progress indicator for collection-level imports.
    // Hidden until an import starts; wired via `onProgress` in the pipeline.
    const importProgress = buildImportProgressElement();

    const previewPanel = document.createElement('div');
    previewPanel.dataset.testid = 'library-import-preview-panel';
    previewPanel.setAttribute('role', 'region');
    previewPanel.setAttribute('aria-label', 'Import preview');
    previewPanel.hidden = true;
    previewPanel.style.cssText = [
        CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12,
        CSS_BG_MUTED_1, 'color:#c9d3e6',
        CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6,
        CSS_FONT_SIZE_12, 'line-height:1.5',
    ].join(';');

    // Partial-failure details: shown after an import run when some entries
    // succeeded and others failed, so the user can see per-entry messages
    // (slug + JSON pointer + reason) instead of a bare "N errors" summary.
    const partialErrorsPanel = document.createElement('div');
    partialErrorsPanel.dataset.testid = 'library-import-partial-errors';
    partialErrorsPanel.setAttribute('role', 'region');
    partialErrorsPanel.setAttribute('aria-label', 'Import partial failure details');
    partialErrorsPanel.hidden = true;
    partialErrorsPanel.style.cssText = [
        CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_PADDING_10_12,
        'background:#2a1f24', 'color:#f2c9c9',
        'border:1px solid #6b2b3a', CSS_BORDER_RADIUS_6,
        CSS_FONT_SIZE_12, 'line-height:1.5',
    ].join(';');

    const view: ViewState = { filterRole: 'all', sortMode: 'default-first', expandedIds: new Set<number>() };
    const refs: ModalRefs = {
        root, body, status, errorBanner, fileInfo, view, activeEditor: null,
        includeRevisionsCb, importRoleSelect,
        importProgress,
        previewPanel, previewFileInput,
        partialErrorsPanel,
    };
    const controls = buildControlsBar(refs);
    wireImportExport(refs, exportBtn, importBtn, fileInput);
    wirePreviewImport(refs, previewBtn, previewFileInput, importBtn, fileInput);
    wireDropZoneKeyboard(dropZone, importBtn, fileInput);

    panel.appendChild(header);
    panel.appendChild(status);
    panel.appendChild(errorBanner);
    panel.appendChild(fileInfo);
    panel.appendChild(previewPanel);
    panel.appendChild(importProgress.wrap);
    panel.appendChild(partialErrorsPanel);

    panel.appendChild(dropZone);
    panel.appendChild(controls);
    panel.appendChild(body);
    root.appendChild(panel);


    // Click on scrim (not panel) closes.
    root.addEventListener('click', (e) => { if (e.target === root) closeExisting(); });

    // Keyboard shortcuts: Esc = cancel editor or close modal; Cmd/Ctrl+S = save editor.
    const keyHandler = (e: KeyboardEvent): void => handleModalKey(refs, e);
    document.addEventListener('keydown', keyHandler, true);
    const pagehideHandler = (): void => closeExisting();
    window.addEventListener('pagehide', pagehideHandler);
    (root as unknown as { __keyHandler: (e: KeyboardEvent) => void }).__keyHandler = keyHandler;
    (root as unknown as { __pagehideHandler: () => void }).__pagehideHandler = pagehideHandler;
    refs.keyHandler = keyHandler;
    refs.pagehideHandler = pagehideHandler;

    return refs;
}

/**
 * G8: wire Import / Export buttons in the modal header. Export delegates to
 * `exportPromptsToJson` (envelope + toast). Import opens the hidden file
 * picker, parses via `parsePromptsText`, and applies with `performPromptImport`
 * so DB-scoped roles (plan/next) go through the drift-guarded upsert path and
 * cache-only entries land in IndexedDB. All error branches surface via toast
 * + status + logError so failures are never silent.
 */
function wireImportExport(
    refs: ModalRefs,
    exportBtn: HTMLButtonElement,
    importBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
): void {
    exportBtn.addEventListener('click', () => { void handleExport(refs); });
    // Guard against re-entry: if an import is already in flight, ignore
    // additional Import clicks so the file picker cannot re-open and queue a
    // second run against performPromptImport.
    importBtn.addEventListener('click', () => {
        if (importBtn.disabled) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        renderSelectedFileInfo(refs, file);
        void handleImportFile(refs, file, fileInput, importBtn, 'click');
    });
    wireImportDropZone(refs, importBtn, fileInput);
}

/**
 * Preview step: parse the file, compute new/updated/revision counts via
 * `previewPromptImport`, and render a confirmation panel. Confirming
 * re-uses the existing `handleImportFile` pipeline (with the same File)
 * so nothing about the actual write path changes.
 */
function wirePreviewImport(
    refs: ModalRefs,
    previewBtn: HTMLButtonElement,
    previewFileInput: HTMLInputElement,
    importBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
): void {
    previewBtn.addEventListener('click', () => {
        if (importBtn.disabled) return;
        previewFileInput.click();
    });
    previewFileInput.addEventListener('change', () => {
        const file = previewFileInput.files && previewFileInput.files[0];
        if (!file) return;
        renderSelectedFileInfo(refs, file);
        void computeAndRenderPreview(refs, file, previewFileInput, importBtn, fileInput);
    });
}

async function computeAndRenderPreview(
    refs: ModalRefs,
    file: File,
    previewFileInput: HTMLInputElement,
    importBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
): Promise<void> {
    const panel = refs.previewPanel;
    if (!panel) return;
    const invalid = validateImportFile(file);
    if (invalid) {
        refs.status.textContent = 'Preview rejected: ' + invalid.headline;
        renderImportErrorBanner(refs, invalid.headline, invalid.hint);
        showToast(PREVIEW_FAILED_PREFIX + invalid.headline, TOAST_ERROR);
        try { previewFileInput.value = ''; } catch { /* ignore */ }
        return;
    }
    refs.status.textContent = 'Previewing ' + file.name + ' ...';
    try {
        const text = await file.text();
        const parsed = parsePromptsText(text);
        if (parsed.errors.length > 0 && parsed.valid.length === 0) {
            const friendly = buildFriendlyImportError(parsed.errors, file.name);
            refs.status.textContent = 'Preview parse failed: ' + friendly.headline;
            renderImportErrorBanner(refs, friendly.headline, friendly.hint);
            showToast(PREVIEW_FAILED_PREFIX + friendly.headline, TOAST_ERROR);
            return;
        }
        const roleSel = refs.importRoleSelect?.value;
        const roleFilter = (roleSel === 'plan' || roleSel === 'next' || roleSel === 'generic') ? roleSel : undefined;
        const opts: Parameters<typeof previewPromptImport>[1] = {};
        if (roleFilter) opts.roleFilter = roleFilter;
        if (parsed.revisions && parsed.revisions.length > 0) opts.revisions = parsed.revisions;
        const preview = await previewPromptImport(parsed.valid, opts);
        renderPreviewPanel(refs, panel, preview, file, parsed.errors.length, () => {
            hidePreviewPanel(panel);
            try { previewFileInput.value = ''; } catch { /* ignore */ }
            void handleImportFile(refs, file, fileInput, importBtn, 'click');
        }, () => {
            hidePreviewPanel(panel);
            try { previewFileInput.value = ''; } catch { /* ignore */ }
            refs.status.textContent = 'Preview cancelled.';
        });
        refs.status.textContent = 'Preview ready for ' + file.name + '.';
    } catch (err) {
        logLibraryImportFailure('preview', 'threw during read/parse for name=' + file.name, err);
        const reason = extractImportErrorReason(err);
        refs.status.textContent = PREVIEW_FAILED_PREFIX + reason;
        renderImportErrorBanner(refs, PREVIEW_FAILED_PREFIX + reason,
            'Check the browser console for details and try again.');
        showToast(PREVIEW_FAILED_PREFIX + reason, TOAST_ERROR);
    }
}

function hidePreviewPanel(panel: HTMLDivElement): void {
    panel.hidden = true;
    panel.style.display = 'none';
    while (panel.firstChild) panel.removeChild(panel.firstChild);
}

function buildPreviewList(preview: PromptImportPreview, skipped: number): HTMLUListElement {
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:disc;margin:0 0 8px 18px;padding:0;';
    const rows: [string, number][] = [
        ['New entries', preview.newEntries],
        ['Updated entries', preview.updatedEntries],
        ['Cache-only entries', preview.cacheOnlyEntries],
        ['Revisions', preview.revisions],
    ];
    for (const [label, n] of rows) {
        const li = document.createElement('li');
        li.textContent = label + ': ' + String(n);
        list.appendChild(li);
    }
    const warnRows: [number, string][] = [
        [preview.droppedByRole, 'Skipped by role filter: '],
        [preview.orphanRevisions, 'Orphan revisions (dropped): '],
        [skipped, 'Invalid entries skipped: '],
    ];
    for (const [count, label] of warnRows) {
        if (count <= 0) continue;
        const li = document.createElement('li');
        li.style.color = '#ffd7dc';
        li.textContent = label + String(count);
        list.appendChild(li);
    }
    return list;
}

function buildPreviewButton(text: string, testid: string, css: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.dataset.testid = testid;
    btn.style.cssText = css;
    btn.addEventListener('click', onClick);
    return btn;
}

function buildPreviewButtons(onConfirm: () => void, onCancel: () => void): HTMLDivElement {
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;';
    const confirmCss = 'background:#2b6cb0;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
    const cancelCss = 'background:#2b3648;color:#e6edf7;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
    btnRow.appendChild(buildPreviewButton('Confirm import', 'library-import-preview-confirm', confirmCss, onConfirm));
    btnRow.appendChild(buildPreviewButton('Cancel', 'library-import-preview-cancel', cancelCss, onCancel));
    return btnRow;
}

function renderPreviewPanel(
    refs: ModalRefs,
    panel: HTMLDivElement,
    preview: PromptImportPreview,
    file: File,
    skipped: number,
    onConfirm: () => void,
    onCancel: () => void,
): void {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    const heading = document.createElement('div');
    heading.style.cssText = 'font-weight:600;color:#c9b7ff;margin-bottom:6px;';
    heading.textContent = 'Import preview: ' + file.name;
    panel.appendChild(heading);
    panel.appendChild(buildPreviewList(preview, skipped));
    panel.appendChild(buildPreviewButtons(onConfirm, onCancel));
    panel.hidden = false;
    panel.style.display = 'block';
    void refs;
}


/**
 * Drag-and-drop upload: the whole modal root acts as a drop zone. Dropping a
 * JSON file routes through the same handleImportFile pipeline, so the exact
 * same concurrency guard (importBtn.disabled short-circuit) applies. Rapid
 * successive drops during an in-flight import are ignored and cannot
 * double-invoke performPromptImport.
 */
function wireImportDropZone(
    refs: ModalRefs,
    importBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
): void {
    const onDragOver = (e: DragEvent): void => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = importBtn.disabled ? 'none' : 'copy';
    };
    const onDrop = (e: DragEvent): void => {
        e.preventDefault();
        // Concurrency guard mirrors the click path: if an import is running,
        // the drop is a no-op so we never queue a second performPromptImport.
        if (importBtn.disabled) return;
        const file = e.dataTransfer?.files && e.dataTransfer.files[0];
        if (!file) return;
        renderSelectedFileInfo(refs, file);
        void handleImportFile(refs, file, fileInput, importBtn, 'drop');
    };
    refs.root.addEventListener('dragover', onDragOver);
    refs.root.addEventListener('drop', onDrop);
}

/**
 * Keyboard support for the visible drop zone. role=button + tabindex=0 makes it
 * reachable via Tab; Enter or Space opens the hidden file picker so users can
 * import without a mouse. The concurrency guard mirrors the click path: while
 * an import is in flight the Import button is disabled and the zone is a no-op.
 */
function wireDropZoneKeyboard(
    dropZone: HTMLDivElement,
    importBtn: HTMLButtonElement,
    fileInput: HTMLInputElement,
): void {
    const activate = (): void => {
        if (importBtn.disabled) return;
        fileInput.click();
    };
    dropZone.addEventListener('click', activate);
    dropZone.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        activate();
    });
}


async function handleExport(refs: ModalRefs): Promise<void> {
    refs.status.textContent = 'Exporting ...';
    try {
        const includeRevisions = refs.includeRevisionsCb?.checked === true;
        await exportPromptsToJson({ includeRevisions });
        refs.status.textContent = 'Export complete.';
        log('PromptLibraryModal: export completed', 'info');
    } catch (err) {
        logError(LOG_SCOPE, 'export threw', err);
        refs.status.textContent = 'Export failed. See console.';
        showToast('Export failed', TOAST_ERROR);
    }
}

function renderImportErrorBanner(
    refs: ModalRefs,
    headline: string,
    hint: string,
    onRetry?: () => void,
): void {
    // Reveal the live region BEFORE inserting content so assistive tech sees
    // the mutation on an already-visible role="alert" node. Screen readers
    // (NVDA/JAWS/VoiceOver) may skip announcements when a live region toggles
    // from hidden to visible in the same tick that its text appears.
    refs.errorBanner.textContent = '';
    refs.errorBanner.hidden = false;
    refs.errorBanner.style.display = 'block';
    const h = document.createElement('div');
    h.dataset.testid = 'library-import-error-headline';
    h.style.cssText = 'font-weight:600;margin-bottom:4px;';
    h.textContent = headline;
    const p = document.createElement('div');
    p.dataset.testid = 'library-import-error-hint';
    p.style.cssText = 'opacity:0.85;';
    p.textContent = hint;
    refs.errorBanner.appendChild(h);
    refs.errorBanner.appendChild(p);
    if (onRetry) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.textContent = 'Retry import';
        retryBtn.dataset.testid = 'library-import-retry';
        retryBtn.setAttribute(ATTR_ARIA_LABEL, 'Retry import with the same file');
        retryBtn.style.cssText = btnCss('#6b2c34', '#ffd7dc') + ';margin-top:8px;';
        retryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onRetry();
        });
        refs.errorBanner.appendChild(retryBtn);
    }
}

function clearImportErrorBanner(refs: ModalRefs): void {
    refs.errorBanner.textContent = '';
    refs.errorBanner.hidden = true;
    refs.errorBanner.style.display = 'none';
}

/**
 * Show per-entry error messages after a partially successful collection
 * import. `entryErrors` come from `performPromptImport` (DB write / revision
 * insert / roleFilter drop reasons) and `parseErrors` come from the JSON
 * parser (invalid-entry pointers). Rendered as a scrollable list so a large
 * partial failure stays contained and does not push the modal off screen.
 */
function buildPartialErrorsDetails(
    total: number,
    parseErrors: readonly string[],
    entryErrors: readonly string[],
): HTMLDetailsElement {
    const details = document.createElement('details');
    details.open = total <= 5;
    const summary = document.createElement('summary');
    summary.style.cssText = 'cursor:pointer;margin-bottom:6px;color:#f5b7b7;';
    summary.textContent = details.open ? 'Hide details' : 'Show details';
    details.addEventListener('toggle', () => {
        summary.textContent = details.open ? 'Hide details' : 'Show details';
    });
    details.appendChild(summary);

    const list = document.createElement('ul');
    list.dataset.testid = 'library-import-partial-errors-list';
    list.style.cssText = [
        'margin:0', 'padding:0 0 0 18px', 'max-height:180px',
        'overflow-y:auto', 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        'font-size:11.5px',
    ].join(';');
    const appendRow = (source: 'parse' | 'entry', message: string): void => {
        const li = document.createElement('li');
        li.style.cssText = 'margin:2px 0;white-space:pre-wrap;word-break:break-word;';
        li.dataset.source = source;
        const tag = document.createElement('span');
        tag.textContent = source === 'parse' ? '[parse] ' : '[entry] ';
        tag.style.cssText = 'color:#f5b7b7;font-weight:600;';
        li.appendChild(tag);
        li.appendChild(document.createTextNode(message));
        list.appendChild(li);
    };
    for (const m of parseErrors) appendRow('parse', m);
    for (const m of entryErrors) appendRow('entry', m);
    details.appendChild(list);
    return details;
}

function renderPartialImportErrors(
    refs: ModalRefs,
    entryErrors: readonly string[],
    parseErrors: readonly string[],
): void {
    const panel = refs.partialErrorsPanel;
    if (!panel) return;
    panel.textContent = '';
    const total = entryErrors.length + parseErrors.length;
    if (total === 0) {
        panel.hidden = true;
        panel.style.display = 'none';
        return;
    }
    const header = document.createElement('div');
    header.style.cssText = 'font-weight:600;margin-bottom:6px;';
    header.textContent = 'Partial import: ' + String(total) + ' entr' + (total === 1 ? 'y' : 'ies') + ' failed';
    panel.appendChild(header);

    const details = buildPartialErrorsDetails(total, parseErrors, entryErrors);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.dataset.testid = 'library-import-partial-errors-dismiss';
    dismiss.style.cssText = [
        'margin-top:8px', 'padding:4px 10px', 'background:#3a2530',
        'color:#f2c9c9', 'border:1px solid #6b2b3a', CSS_BORDER_RADIUS_6,
        CSS_CURSOR_POINTER, 'font-size:11.5px',
    ].join(';');
    dismiss.addEventListener('click', () => { clearPartialImportErrors(refs); });

    panel.appendChild(details);
    panel.appendChild(dismiss);
    panel.hidden = false;
    panel.style.display = 'block';
}

function clearPartialImportErrors(refs: ModalRefs): void {
    const panel = refs.partialErrorsPanel;
    if (!panel) return;
    panel.textContent = '';
    panel.hidden = true;
    panel.style.display = 'none';
}


/**
 * Pull a human-readable reason from an unknown thrown value. We prefer
 * `Error.message` when present, fall back to a stringified primitive, and
 * default to a generic label. The result is announced by the aria-live
 * banner, so it must be a short single-line string safe for screen readers.
 */
function extractImportErrorReason(err: unknown): string {
    if (err instanceof Error && err.message) return err.message.split('\n')[0]!.slice(0, 240);
    if (typeof err === 'string' && err.length > 0) return err.split('\n')[0]!.slice(0, 240);
    return 'Unknown error';
}

/**
 * Client-side file validation before any read/parse work. Rejects non-JSON
 * extensions/MIME types and files larger than IMPORT_MAX_BYTES. Returns
 * `null` on success or a `{headline, hint}` describing the failure so the
 * caller can render the inline error banner and short-circuit the import.
 */
const IMPORT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB: prompt libraries are tiny JSON.
function validateImportFile(file: File): { headline: string; hint: string } | null {
    if (file.size === 0) {
        return { headline: 'File is empty', hint: 'Choose a non-empty prompt library JSON file.' };
    }
    if (file.size > IMPORT_MAX_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        return {
            headline: 'File is too large (' + mb + ' MB)',
            hint: 'Maximum allowed is ' + (IMPORT_MAX_BYTES / (1024 * 1024)) + ' MB. Split the file or export a smaller subset.',
        };
    }
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    const extOk = name.endsWith('.json');
    const typeOk = type === '' || type === 'application/json' || type === 'text/json' || type.endsWith('+json');
    if (!extOk || !typeOk) {
        return {
            headline: 'Unsupported file type',
            hint: 'Choose a .json file exported from the Prompt Library.',
        };
    }
    return null;
}

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- linear import pipeline; splitting hides the try/catch/finally shape
async function handleImportFile(
    refs: ModalRefs,
    file: File,
    fileInput: HTMLInputElement,
    importBtn: HTMLButtonElement,
    origin: 'click' | 'drop' = 'click',
): Promise<void> {
    // Concurrency guard: disable the Import control (and the hidden picker)
    // for the full duration of this attempt so a rapid second file selection
    // (or drag-and-drop) cannot double-invoke performPromptImport.

    if (importBtn.disabled) return;
    // If the previous attempt failed, announce the retry via the polite
    // aria-live status region so screen-reader users hear that a new attempt
    // is under way (not just another "Importing ..." indistinguishable from
    // the failed one).
    const retrying = refs.lastImportFailed === true;
    const attemptPrefix = retrying ? 'Retrying import: ' : 'Importing ';
    // One-click retry: re-invoke the pipeline with the same file so users
    // don't have to open the picker or re-drag after a failure.
    const retry = (): void => { void handleImportFile(refs, file, fileInput, importBtn, 'click'); };
    // Client-side validation runs BEFORE we flip UI state so an invalid file
    // does not put the modal into an "in-flight" state that must be unwound.
    const invalid = validateImportFile(file);
    if (invalid) {
        refs.status.textContent = (retrying ? 'Retry rejected: ' : 'Import rejected: ') + invalid.headline;
        // Validation failures are deterministic for the same file, so no Retry
        // button is offered — retrying the same rejected file would just fail
        // again. Users must pick a different file.
        renderImportErrorBanner(refs, invalid.headline, invalid.hint);
        logLibraryImportFailure('validation', 'name=' + file.name + ' size=' + String(file.size) + ' type=' + file.type + ' headline=' + invalid.headline);
        showToast(IMPORT_FAILED_PREFIX + invalid.headline, TOAST_ERROR);
        refs.lastImportFailed = true;
        try { fileInput.value = ''; } catch { /* ignore */ }
        focusErrorBanner(refs);
        return;
    }
    importBtn.disabled = true;
    importBtn.setAttribute('aria-busy', 'true');
    fileInput.disabled = true;
    const originalLabel = importBtn.textContent ?? 'Import';
    showImportSpinner(importBtn);
    clearImportErrorBanner(refs);
    clearPartialImportErrors(refs);

    refs.status.textContent = attemptPrefix + file.name + ' ...';
    let focusAfter: 'import' | 'banner' | null = null;
    try {
        const text = await file.text();
        const parsed = parsePromptsText(text);
        if (parsed.errors.length > 0 && parsed.valid.length === 0) {
            const friendly = buildFriendlyImportError(parsed.errors, file.name);
            refs.status.textContent = 'Import parse failed: ' + friendly.headline;
            // Parse failures are also deterministic for the same file bytes, so
            // no Retry button here either.
            renderImportErrorBanner(refs, friendly.headline, friendly.hint);
            logLibraryImportFailure('parse', 'errors=' + String(parsed.errors.length) + ' name=' + file.name, parsed.errors);
            showToast(IMPORT_FAILED_PREFIX + friendly.headline, TOAST_ERROR);
            refs.lastImportFailed = true;
            focusAfter = 'banner';
            return;
        }
        const roleSel = refs.importRoleSelect?.value;
        const roleFilter = (roleSel === 'plan' || roleSel === 'next' || roleSel === 'generic') ? roleSel : undefined;
        const importOpts: Parameters<typeof performPromptImport>[1] = { overwrite: true };
        if (roleFilter) importOpts.roleFilter = roleFilter;
        if (parsed.revisions && parsed.revisions.length > 0) importOpts.revisions = parsed.revisions;
        if (parsed.promptOrder && parsed.promptOrder.length > 0) importOpts.promptOrder = parsed.promptOrder;
        showImportProgress(refs);
        importOpts.onProgress = (p) => updateImportProgress(refs, p);
        const results = await performPromptImport(parsed.valid, importOpts);
        const skipped = parsed.errors.length;
        const revBit = (results.revisionsImported ?? 0) > 0
            ? ', +' + String(results.revisionsImported) + ' revisions'
            : '';
        const summary = 'Import: +' + results.added + ' added, ' + results.updated
            + ' updated' + revBit + (skipped > 0 ? ', ' + skipped + ' skipped' : '')
            + (results.errors.length > 0 ? ', ' + results.errors.length + ' errors' : '');
        log('PromptLibraryModal: ' + summary, 'info');
        showToast(summary, results.errors.length > 0 ? 'warn' : 'success');
        await renderAllRoles(refs);
        refs.status.textContent = (retrying ? 'Retry succeeded. ' : '') + summary;
        refs.lastImportFailed = false;
        // Explicitly clear any lingering error-banner content from a previous
        // failed attempt so a successful retry does not leave the assertive
        // aria-live alert visible next to the success summary.
        clearImportErrorBanner(refs);
        // Surface per-entry error messages when the run partially failed so
        // the user sees which slugs/pointers failed instead of only a
        // "N errors" summary. Cleared automatically when there are none.
        renderPartialImportErrors(refs, results.errors, parsed.errors);

        // Drag-and-drop success has no origin button, so return focus to the
        // Import control so keyboard users land on a reachable target.
        if (origin === 'drop') focusAfter = 'import';
    } catch (err) {
        logLibraryImportFailure('thrown', 'threw during read/parse for name=' + file.name, err);
        const reason = extractImportErrorReason(err);
        refs.status.textContent = IMPORT_FAILED_PREFIX + reason;
        // Thrown failures (network/IDB/transient) are the case where a one-click
        // retry actually helps, so render the banner WITH the Retry button.
        renderImportErrorBanner(refs,
            IMPORT_FAILED_PREFIX + reason,
            'Check the browser console for details and try again.',
            retry);
        showToast(IMPORT_FAILED_PREFIX + reason, TOAST_ERROR);
        refs.lastImportFailed = true;
        // Move focus to the error banner so the failure is immediately
        // reachable by keyboard users instead of stranded on <body> or the
        // Import button (which sits above the banner in the tab order).
        focusAfter = 'banner';
    } finally {
        fileInput.value = '';
        fileInput.disabled = false;
        importBtn.disabled = false;
        importBtn.removeAttribute('aria-busy');
        hideImportSpinner(importBtn, originalLabel);
        hideImportProgress(refs);
        // Focus restoration MUST run after re-enabling: a disabled control
        // cannot receive programmatic focus in the browser.
        if (focusAfter === 'import') restoreFocusToImportButton(refs);
        else if (focusAfter === 'banner') focusErrorBanner(refs);
    }
}

/**
 * Swap the Import button label for an inline spinner + "Importing…" while the
 * async pipeline runs. The spinner is a pure CSS ring so no external asset or
 * icon library is required. Injected keyframes are idempotent per document.
 */
function showImportSpinner(importBtn: HTMLButtonElement): void {
    ensureSpinnerStyle(importBtn.ownerDocument);
    importBtn.textContent = '';
    const spinner = importBtn.ownerDocument.createElement('span');
    spinner.dataset.testid = 'library-import-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.style.cssText = [
        'display:inline-block',
        'width:10px',
        'height:10px',
        'border:2px solid #9aa7bd',
        'border-top-color:transparent',
        'border-radius:50%',
        'margin-right:6px',
        'vertical-align:-1px',
        'animation:mc-spin 0.7s linear infinite',
    ].join(';');
    importBtn.appendChild(spinner);
    importBtn.appendChild(importBtn.ownerDocument.createTextNode('Importing…'));
}

function hideImportSpinner(importBtn: HTMLButtonElement, originalLabel: string): void {
    importBtn.textContent = originalLabel;
}

function ensureSpinnerStyle(doc: Document): void {
    if (doc.getElementById('mc-spinner-style')) return;
    const style = doc.createElement('style');
    style.id = 'mc-spinner-style';
    style.textContent = '@keyframes mc-spin{to{transform:rotate(360deg)}}';
    doc.head.appendChild(style);
}

/**
 * v4.192.0: Build the collection-level import progress element. The wrap is
 * hidden by default and shown via `showImportProgress` when a run begins.
 * The progress bar is a pure CSS <div> with role="progressbar" so screen
 * readers can announce updates through `aria-valuenow` / `aria-valuetext`.
 */
function buildImportProgressElement(): {
    wrap: HTMLDivElement;
    label: HTMLSpanElement;
    bar: HTMLDivElement;
    counter: HTMLSpanElement;
} {
    const wrap = document.createElement('div');
    wrap.dataset.testid = 'library-import-progress';
    wrap.hidden = true;
    wrap.style.cssText = [
        CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, 'padding:8px 10px',
        CSS_BG_MUTED_1, CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6,
        'font-size:11px', 'color:#c9d3e6',
    ].join(';');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    const label = document.createElement('span');
    label.dataset.testid = 'library-import-progress-label';
    label.textContent = 'Preparing import…';
    label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const counter = document.createElement('span');
    counter.dataset.testid = 'library-import-progress-counter';
    counter.textContent = '0/0';
    counter.style.cssText = 'font-variant-numeric:tabular-nums;color:#9aa7bd;flex-shrink:0;';
    row.appendChild(label);
    row.appendChild(counter);

    const track = document.createElement('div');
    track.style.cssText = 'height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;';
    const bar = document.createElement('div');
    bar.dataset.testid = 'library-import-progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute(ATTR_ARIA_VALUENOW, '0');
    bar.style.cssText = 'height:100%;width:0%;background:#7cc4ff;transition:width 120ms ease-out;';
    track.appendChild(bar);

    wrap.appendChild(row);
    wrap.appendChild(track);
    return { wrap, label, bar, counter };
}

function showImportProgress(refs: ModalRefs): void {
    const p = refs.importProgress;
    if (!p) return;
    p.wrap.hidden = false;
    p.wrap.style.display = 'block';
    p.label.textContent = 'Preparing import…';
    p.counter.textContent = '0/0';
    p.bar.style.width = '0%';
    p.bar.setAttribute(ATTR_ARIA_VALUENOW, '0');
    p.bar.setAttribute(ATTR_ARIA_VALUETEXT, 'Preparing import');
}

function hideImportProgress(refs: ModalRefs): void {
    const p = refs.importProgress;
    if (!p) return;
    p.wrap.hidden = true;
    p.wrap.style.display = 'none';
}

function updateImportProgress(refs: ModalRefs, progress: ImportProgress): void {
    const p = refs.importProgress;
    if (!p) return;
    if (progress.phase === 'entries') {
        p.label.textContent = 'Committed ' + String(progress.entriesCommitted)
            + '/' + String(progress.totalEntries) + ' entries';
        p.counter.textContent = String(progress.entriesCommitted) + '/' + String(progress.totalEntries);
        // Entries are committed in one batch, so show a partial 25% until
        // the revision loop kicks in to complete the bar.
        const pct = progress.totalRevisions > 0 ? 15 : 100;
        p.bar.style.width = String(pct) + '%';
        p.bar.setAttribute(ATTR_ARIA_VALUENOW, String(pct));
        p.bar.setAttribute(ATTR_ARIA_VALUETEXT, p.label.textContent);
        return;
    }
    if (progress.phase === 'revisions') {
        const total = Math.max(1, progress.totalRevisions);
        const pct = Math.min(100, Math.round((progress.insertedRevisions / total) * 100));
        const slugSuffix = progress.slug ? ' (' + progress.slug + ')' : '';
        p.label.textContent = 'Inserting revisions' + slugSuffix;
        p.counter.textContent = String(progress.insertedRevisions) + '/' + String(progress.totalRevisions);
        p.bar.style.width = String(pct) + '%';
        p.bar.setAttribute(ATTR_ARIA_VALUENOW, String(pct));
        p.bar.setAttribute(
            ATTR_ARIA_VALUETEXT,
            'Inserted ' + String(progress.insertedRevisions) + ' of '
                + String(progress.totalRevisions) + ' revisions'
                + ' (' + String(progress.groupsDone) + '/' + String(progress.totalGroups) + ' prompts)',
        );
        return;
    }
    // done
    p.label.textContent = 'Import complete';
    p.counter.textContent = String(progress.insertedRevisions) + '/' + String(progress.totalRevisions);
    p.bar.style.width = '100%';
    p.bar.setAttribute(ATTR_ARIA_VALUENOW, '100');
    p.bar.setAttribute(ATTR_ARIA_VALUETEXT, 'Import complete');
}



/**
 * After a rejected import the modal stays open (nothing calls closeExisting).
 * Move focus back to the Import button so keyboard users land on the control
 * they just triggered and can re-open the picker immediately with Enter/Space.
 * Guarded against detached DOM in case the modal was closed mid-flight.
 */
function restoreFocusToImportButton(refs: ModalRefs): void {
    if (!refs.root.isConnected) return;
    const btn = refs.root.querySelector<HTMLButtonElement>('[data-testid="library-import"]');
    if (btn) btn.focus();
}

/**
 * Move keyboard focus to the assertive error banner so a failed import is
 * immediately reachable. The banner carries tabindex=-1 so it can receive
 * programmatic focus without joining the Tab order.
 */
function focusErrorBanner(refs: ModalRefs): void {
    if (!refs.root.isConnected) return;
    const banner = refs.errorBanner;
    if (!banner || banner.hidden) return;
    try { banner.focus(); } catch { /* ignore */ }
}


function handleModalKey(refs: ModalRefs, e: KeyboardEvent): void {
    // Guard against stale handlers from a previous modal instance (e.g. test resets).
    if (!refs.root.isConnected) {
        if (refs.keyHandler) document.removeEventListener('keydown', refs.keyHandler, true);
        return;
    }
    if (e.key === 'Escape') {
        if (refs.activeEditor) { e.preventDefault(); refs.activeEditor.cancel(); return; }
        e.preventDefault();
        closeExisting();
        return;
    }
    const saveCombo = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
    if (saveCombo && refs.activeEditor) {
        e.preventDefault();
        refs.activeEditor.save();
        return;
    }
    if (e.key === 'Tab') applyTabTrap(refs.root, e);
}

/** Plan-22 G7 a11y: Tab focus trap keeps keyboard focus within the modal. */
function applyTabTrap(root: HTMLElement, e: KeyboardEvent): void {
    const nodes = focusableNodesIn(root);
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    const insideModal = active !== null && root.contains(active);
    if (!insideModal) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); return; }
    if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

function buildControlsBar(refs: ModalRefs): HTMLElement {
    const bar = document.createElement('div');
    bar.dataset.testid = 'library-controls';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px;padding:6px 8px;background:#0f1522;border:1px solid #2b3648;border-radius:6px;';
    bar.appendChild(buildFilterChips(refs));
    bar.appendChild(buildSortSelect(refs));
    return bar;
}

function buildFilterChips(refs: ModalRefs): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';
    const label = document.createElement('span');
    label.textContent = 'Role:';
    label.style.cssText = 'font-size:10px;color:#7a8699;margin-right:2px;';
    wrap.appendChild(label);
    for (const role of ROLE_FILTERS) {
        const chip = document.createElement('button');
        chip.textContent = role;
        chip.dataset.role = role;
        chip.style.cssText = chipCss(refs.view.filterRole === role);
        chip.addEventListener('click', () => {
            refs.view.filterRole = role;
            for (const other of Array.from(wrap.querySelectorAll<HTMLButtonElement>('button[data-role]'))) {
                other.style.cssText = chipCss(other.dataset.role === role);
            }
            void renderAllRoles(refs);
        });
        wrap.appendChild(chip);
    }
    return wrap;
}

function buildSortSelect(refs: ModalRefs): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:4px;align-items:center;margin-left:8px;';
    const label = document.createElement('span');
    label.textContent = 'Sort:';
    label.style.cssText = 'font-size:10px;color:#7a8699;';
    const select = document.createElement('select');
    select.dataset.testid = 'library-sort';
    select.style.cssText = 'background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:4px;font-size:11px;padding:2px 4px;';
    for (const mode of SORT_MODES) {
        const opt = document.createElement('option');
        opt.value = mode;
        opt.textContent = mode;
        select.appendChild(opt);
    }
    select.value = refs.view.sortMode;
    select.addEventListener('change', () => {
        refs.view.sortMode = select.value as SortMode;
        void renderAllRoles(refs);
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    return wrap;
}

function chipCss(isActive: boolean): string {
    const bg = isActive ? '#3a2f6b' : '#243050';
    const fg = isActive ? '#ffe08a' : '#e6edf7';
    return [
        'background:' + bg, 'color:' + fg,
        'border:1px solid #3a465c', 'border-radius:999px',
        'padding:2px 8px', 'font-size:10px', CSS_CURSOR_POINTER,
    ].join(';');
}

function btnCss(bg: string, fg: string): string {
    return [
        'background:' + bg, 'color:' + fg,
        'border:1px solid #3a465c', CSS_BORDER_RADIUS_6,
        'padding:4px 10px', 'font-size:11px', CSS_CURSOR_POINTER,
        'margin-left:6px',
    ].join(';');
}

function rolesToRender(view: ViewState): PromptRole[] {
    if (view.filterRole === 'all') return ROLES;
    return [view.filterRole];
}

function sortRows(rows: readonly PromptRow[], mode: SortMode): PromptRow[] {
    const copy = rows.slice();
    if (mode === 'name') return copy.sort((a, b) => a.Name.localeCompare(b.Name));
    if (mode === 'length') return copy.sort((a, b) => b.Body.length - a.Body.length);
    return copy.sort((a, b) => (b.IsDefault - a.IsDefault) || a.Name.localeCompare(b.Name));
}

async function renderAllRoles(refs: ModalRefs): Promise<void> {
    refs.activeEditor = null;
    refs.body.replaceChildren(); // Plan-17 step 14: prefer DOM API over innerHTML='' pattern.
    refs.status.textContent = 'Loading...';
    try {
        const roles = rolesToRender(refs.view);
        for (const role of roles) {
            const section = await buildRoleSection(refs, role);
            refs.body.appendChild(section);
        }
        refs.status.textContent = 'Loaded (' + refs.view.filterRole + ', sort=' + refs.view.sortMode + ').';
    } catch (err) {
        logError(LOG_SCOPE, 'renderAllRoles failed', err);
        refs.status.textContent = 'Error loading prompts. See console.';
    }
}

async function buildRoleSection(refs: ModalRefs, role: PromptRole): Promise<HTMLElement> {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:10px 0 14px;border:1px solid #2b3648;border-radius:8px;padding:8px 10px;background:#0f1522;';
    const h = document.createElement('div');
    h.textContent = 'Role: ' + role;
    h.title = ROLE_TOOLTIPS[role];
    h.setAttribute(ATTR_ARIA_LABEL, 'Role: ' + role + '. ' + ROLE_TOOLTIPS[role]);
    h.style.cssText = 'font-size:12px;font-weight:600;color:#c9b7ff;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;cursor:help;';
    wrap.appendChild(h);

    const result = await listPromptsByRole(role);
    if (!result.ok || !result.value) {
        const err = document.createElement('div');
        err.textContent = 'Load error: ' + (result.error ?? 'unknown');
        err.style.cssText = 'color:#f5a3a3;font-size:11px;';
        wrap.appendChild(err);
        return wrap;
    }
    const rows = result.value;
    if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = '(no rows)';
        empty.style.cssText = 'color:#7a8699;font-size:11px;font-style:italic;';
        wrap.appendChild(empty);
        return wrap;
    }
    const sortedRows = sortRows(rows, refs.view.sortMode);
    for (const row of sortedRows) wrap.appendChild(buildRowContainer(refs, row));
    return wrap;
}

function buildRowContainer(refs: ModalRefs, row: PromptRow): HTMLElement {
    const container = document.createElement('div');
    container.dataset.promptContainer = String(row.Id);
    container.appendChild(buildRowEl(refs, row, container));
    if (refs.view.expandedIds.has(row.Id)) {
        container.appendChild(buildPreviewEl(row));
    }
    return container;
}

function buildPreviewEl(row: PromptRow): HTMLElement {
    const pre = document.createElement('pre');
    pre.dataset.testid = 'row-preview';
    pre.dataset.promptId = String(row.Id);
    const body = row.Body.length > PREVIEW_MAX_CHARS
        ? row.Body.slice(0, PREVIEW_MAX_CHARS) + ' ...(+' + (row.Body.length - PREVIEW_MAX_CHARS) + ' chars)'
        : row.Body;
    pre.textContent = body;
    pre.style.cssText = 'margin:0 4px 6px 4px;padding:6px 8px;background:#0b1220;color:#c9d5ea;border:1px solid #1c2536;border-radius:6px;font-family:ui-monospace,monospace;font-size:10px;white-space:pre-wrap;max-height:180px;overflow:auto;';
    return pre;
}

function buildRowLeft(refs: ModalRefs, row: PromptRow, container: HTMLElement): HTMLElement {
    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;padding-right:8px;cursor:pointer;';
    left.title = 'Click to toggle body preview';
    left.addEventListener('click', () => { togglePreview(refs, row, container); });
    const isExpanded = refs.view.expandedIds.has(row.Id);
    const caret = isExpanded ? '▾ ' : '▸ ';
    const name = document.createElement('div');
    name.textContent = caret + (row.IsDefault ? '★ ' : '') + row.Name;
    name.style.cssText = 'font-weight:' + (row.IsDefault ? '600' : '400') + ';color:' + (row.IsDefault ? '#ffe08a' : '#e6edf7') + ';';
    const slug = document.createElement('div');
    slug.textContent = row.Slug + '  ·  ' + row.Body.length + ' chars';
    slug.style.cssText = 'font-size:10px;color:#7a8699;margin-top:2px;';
    left.appendChild(name);
    left.appendChild(slug);
    return left;
}

function buildRowRight(refs: ModalRefs, row: PromptRow, rowEl: HTMLElement): HTMLElement {
    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-shrink:0;';

    const setDefaultBtn = document.createElement('button');
    setDefaultBtn.textContent = row.IsDefault ? 'Default' : 'Set default';
    setDefaultBtn.disabled = row.IsDefault === 1;
    setDefaultBtn.style.cssText = btnCss(row.IsDefault ? '#3a2f6b' : '#243050', '#e6edf7')
        + ';opacity:' + (row.IsDefault ? '0.6' : '1') + ';cursor:' + (row.IsDefault ? 'default' : 'pointer');
    setDefaultBtn.addEventListener('click', () => { void handleSetDefault(refs, row); });

    const dupBtn = document.createElement('button');
    dupBtn.textContent = 'Duplicate';
    dupBtn.style.cssText = btnCss('#243050', '#e6edf7');
    dupBtn.addEventListener('click', () => { void handleDuplicate(refs, row); });

    // Plan-23 step 7: the inline Edit affordance stays as "Edit" (inline
    // textarea + Save) so quick renames and body tweaks stay one click. The
    // secondary "Full editor" button opens the drift-guarded modal editor
    // shared with the chip gears / "Add new" flow.
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.title = 'Inline edit: rename or tweak body without leaving the library';
    editBtn.style.cssText = btnCss('#243050', '#e6edf7');
    editBtn.addEventListener('click', () => { openInlineEditor(refs, rowEl, row); });

    const quickEditBtn = document.createElement('button');
    quickEditBtn.textContent = 'Full editor';
    quickEditBtn.title = 'Open the full drift-guarded editor (shared with chip gears)';
    quickEditBtn.style.cssText = btnCss('#243050', '#e6edf7');
    quickEditBtn.addEventListener('click', () => {
        void openPromptEditor({ role: row.Role, promptId: row.Id });
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.style.cssText = btnCss('#4a2230', '#f5c9c9');
    delBtn.addEventListener('click', () => { void handleDelete(refs, row); });

    const seedBody = getSeedBodyForSlug(row.Slug);
    const canReset = seedBody !== null && seedBody !== row.Body;

    right.appendChild(setDefaultBtn);
    right.appendChild(editBtn);
    right.appendChild(quickEditBtn);
    right.appendChild(dupBtn);
    if (canReset) {
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↺ Reset';
        resetBtn.title = 'Restore this seeded prompt to its shipped default body';
        resetBtn.style.cssText = btnCss('#243050', '#ffe08a');
        resetBtn.addEventListener('click', () => { void handleResetToDefault(refs, row); });
        right.appendChild(resetBtn);
    }
    right.appendChild(delBtn);
    return right;
}

function buildRowEl(refs: ModalRefs, row: PromptRow, container: HTMLElement): HTMLElement {
    const rowEl = document.createElement('div');
    rowEl.dataset.promptId = String(row.Id);
    rowEl.dataset.promptSlug = row.Slug;
    rowEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-top:1px solid #1c2536;font-size:12px;';
    rowEl.appendChild(buildRowLeft(refs, row, container));
    rowEl.appendChild(buildRowRight(refs, row, rowEl));
    return rowEl;
}

/**
 * Plan-23 remaining-item #4: restore a seeded row's Body to the shipped
 * default without touching Name, Category, Tags, IsDefault, or ReplaceKey.
 * Requires explicit user confirmation because it discards the current Body.
 * All failures are logged AND surfaced in the modal status line (never silent).
 */
async function handleResetToDefault(refs: ModalRefs, row: PromptRow): Promise<void> {
    const seedBody = getSeedBodyForSlug(row.Slug);
    if (seedBody === null) {
        logError(LOG_SCOPE, 'reset-to-default called for non-seeded slug=' + row.Slug, new Error('no seed body'));
        refs.status.textContent = 'Reset unavailable: ' + row.Slug + ' is not a seeded prompt.';
        return;
    }
    if (seedBody === row.Body) {
        refs.status.textContent = 'Already at default: ' + row.Slug;
        return;
    }
    const ok = window.confirm('Reset "' + row.Name + '" (' + row.Slug + ') to its shipped default body?\n\nThis discards the current edits to the body.');
    if (!ok) return;
    refs.status.textContent = 'Resetting to default: ' + row.Slug + ' ...';
    try {
        const result = await upsertPrompt({
            id: row.Id, slug: row.Slug,
            name: row.Name, body: seedBody, role: row.Role,
            replaceKey: row.ReplaceKey, replaceValues: row.ReplaceValues,
            previousBody: row.Body, previousReplaceKey: row.ReplaceKey,
        });
        if (!result.ok) {
            logError(LOG_SCOPE, 'reset-to-default upsertPrompt failed for slug=' + row.Slug, new Error(result.error ?? 'unknown'));
            refs.status.textContent = 'Reset failed: ' + (result.error ?? 'unknown error');
            showToast('❌ Reset failed for ' + row.Slug, TOAST_ERROR);
            return;
        }
        log('PromptLibraryModal: reset-to-default slug=' + row.Slug, 'info');
        refs.status.textContent = 'Reset to default: ' + row.Slug;
        showToast('↺ Reset to default: ' + row.Name, 'success');
        await renderAllRoles(refs);
    } catch (err) {
        logError(LOG_SCOPE, 'reset-to-default threw for slug=' + row.Slug, err);
        refs.status.textContent = 'Reset failed: ' + String(err);
        showToast('❌ Reset failed for ' + row.Slug, TOAST_ERROR);
    }
}

function togglePreview(refs: ModalRefs, row: PromptRow, container: HTMLElement): void {
    const isOpen = refs.view.expandedIds.has(row.Id);
    if (isOpen) {
        refs.view.expandedIds.delete(row.Id);
    } else {
        refs.view.expandedIds.add(row.Id);
    }
    // Rebuild just this row's container in place to avoid a full reflow.
    const fresh = buildRowContainer(refs, row);
    container.replaceWith(fresh);
}

interface EditorEls {
    wrap: HTMLDivElement;
    nameInput: HTMLInputElement;
    bodyInput: HTMLTextAreaElement;
    tokenInput: HTMLInputElement;
    tokenPreview: HTMLSpanElement;
    tokenError: HTMLSpanElement;
    valuesInput: HTMLInputElement;
    valuesError: HTMLSpanElement;
    saveBtn: HTMLButtonElement;
    cancelBtn: HTMLButtonElement;
}

interface TokenRowEls { row: HTMLDivElement; input: HTMLInputElement; preview: HTMLSpanElement; error: HTMLSpanElement; }
function buildTokenRow(initialKey: string): TokenRowEls {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    const label = document.createElement('span');
    label.textContent = 'Token:';
    label.style.cssText = 'font-size:11px;color:#9aa4b2;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialKey;
    input.placeholder = REPLACE_KEY_DEFAULT;
    input.style.cssText = 'width:120px;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:3px 6px;font-family:ui-monospace,monospace;font-size:11px;';
    const preview = document.createElement('span');
    preview.style.cssText = 'font-family:ui-monospace,monospace;font-size:11px;color:#7dd3fc;background:#0f1a2b;border:1px solid #1e3a5f;border-radius:4px;padding:2px 6px;';
    const error = document.createElement('span');
    error.style.cssText = 'font-size:10px;color:#f87171;margin-left:auto;';
    const update = (): void => {
        const key = input.value.trim();
        const err = validateReplaceKey(key);
        preview.textContent = err ? '{{ ? }}' : '{{' + key + '}}';
        error.textContent = err ?? '';
    };
    input.addEventListener('input', update);
    update();
    row.appendChild(label); row.appendChild(input); row.appendChild(preview); row.appendChild(error);
    return { row, input, preview, error };
}

interface ValuesRowEls { row: HTMLDivElement; input: HTMLInputElement; error: HTMLSpanElement; }
function buildValuesRow(initialValues: string[]): ValuesRowEls {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    const label = document.createElement('span');
    label.textContent = 'N options:';
    label.style.cssText = 'font-size:11px;color:#9aa4b2;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValues.join(', ');
    input.placeholder = REPLACE_VALUES_DEFAULT.join(', ');
    input.style.cssText = 'flex:1;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:3px 6px;font-family:ui-monospace,monospace;font-size:11px;';
    const error = document.createElement('span');
    error.style.cssText = 'font-size:10px;color:#f87171;margin-left:auto;';
    const update = (): void => {
        const parsed = input.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        error.textContent = normalizeReplaceValues(parsed) === null ? 'Enter one or more comma-separated values' : '';
    };
    input.addEventListener('input', update);
    update();
    row.appendChild(label); row.appendChild(input); row.appendChild(error);
    return { row, input, error };
}

function buildEditorEl(row: PromptRow): EditorEls {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:8px 4px;border-top:1px solid #1c2536;background:#0b1220;';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = row.Name;
    nameInput.style.cssText = 'width:100%;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:4px 6px;font-size:12px;margin-bottom:6px;';
    const tokenEls = buildTokenRow((row as PromptRow & { ReplaceKey?: string }).ReplaceKey ?? REPLACE_KEY_DEFAULT);
    const initialValues = (row as PromptRow & { ReplaceValues?: string[] }).ReplaceValues ?? [...REPLACE_VALUES_DEFAULT];
    const valuesEls = buildValuesRow(initialValues);
    const bodyInput = document.createElement('textarea');
    bodyInput.value = row.Body;
    bodyInput.rows = 10;
    bodyInput.style.cssText = 'width:100%;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:6px;font-family:ui-monospace,monospace;font-size:11px;white-space:pre;';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = btnCss('#2b3648', '#e6edf7');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = btnCss('#2f4a2f', '#d6f5d6');
    bar.appendChild(cancelBtn); bar.appendChild(saveBtn);
    wrap.appendChild(nameInput); wrap.appendChild(tokenEls.row); wrap.appendChild(valuesEls.row); wrap.appendChild(bodyInput); wrap.appendChild(bar);
    return {
        wrap, nameInput, bodyInput,
        tokenInput: tokenEls.input, tokenPreview: tokenEls.preview, tokenError: tokenEls.error,
        valuesInput: valuesEls.input, valuesError: valuesEls.error,
        saveBtn, cancelBtn,
    };
}


function openInlineEditor(refs: ModalRefs, rowEl: HTMLElement, row: PromptRow): void {
    const ed = buildEditorEl(row);
    rowEl.replaceWith(ed.wrap);
    const cancel = (): void => { refs.activeEditor = null; void renderAllRoles(refs); };
    const save = (): void => {
        // Task 10: block save on invalid token key.
        if (ed.tokenError.textContent) {
            refs.status.textContent = 'Invalid Token: ' + ed.tokenError.textContent;
            ed.tokenInput.focus();
            return;
        }
        // Task 11: block save on invalid N options.
        if (ed.valuesError.textContent) {
            refs.status.textContent = 'Invalid N options: ' + ed.valuesError.textContent;
            ed.valuesInput.focus();
            return;
        }
        const parsedValues = ed.valuesInput.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        void handleEditSave(refs, row, {
            name: ed.nameInput.value,
            body: ed.bodyInput.value,
            replaceKey: ed.tokenInput.value.trim(),
            replaceValues: parsedValues,
        });
    };
    ed.cancelBtn.addEventListener('click', cancel);
    ed.saveBtn.addEventListener('click', save);
    refs.activeEditor = { row, save, cancel };
    ed.bodyInput.focus();
}

interface EditSavePayload {
    name: string;
    body: string;
    replaceKey: string;
    replaceValues: string[];
}

async function handleEditSave(refs: ModalRefs, row: PromptRow, payload: EditSavePayload): Promise<void> {
    refs.status.textContent = 'Saving: ' + row.Slug + ' ...';
    try {
        const res = await upsertPrompt({
            id: row.Id, slug: row.Slug,
            name: payload.name, body: payload.body,
            role: row.Role,
            previousBody: row.Body,
            previousReplaceKey: row.ReplaceKey,
            replaceKey: payload.replaceKey,
            replaceValues: payload.replaceValues,
        });
        if (!res.ok) {
            refs.status.textContent = 'Save failed: ' + (res.error ?? 'unknown');
            logError(LOG_SCOPE, 'edit save failed', res);
            return;
        }
        log('PromptLibraryModal: edited id=' + row.Id + ' slug=' + row.Slug
            + ' key=' + payload.replaceKey + ' values=' + payload.replaceValues.length, 'info');
        await renderAllRoles(refs);
    } catch (err) {
        logError(LOG_SCOPE, 'edit save threw', err);
        refs.status.textContent = 'Save threw. See console.';
    }
}

async function handleSetDefault(refs: ModalRefs, row: PromptRow): Promise<void> {
    refs.status.textContent = 'Setting default: ' + row.Slug + ' ...';
    try {
        const res = await setDefaultPromptForRole(row.Id, row.Role);
        if (!res.ok) {
            refs.status.textContent = 'Set-default failed: ' + (res.error ?? 'unknown');
            logError(LOG_SCOPE, 'setDefault failed', res);
            return;
        }
        log('PromptLibraryModal: set default id=' + row.Id + ' role=' + row.Role, 'info');
        await renderAllRoles(refs);
    } catch (err) {
        logError(LOG_SCOPE, 'setDefault threw', err);
        refs.status.textContent = 'Set-default threw. See console.';
    }
}

async function handleDuplicate(refs: ModalRefs, row: PromptRow): Promise<void> {
    refs.status.textContent = 'Duplicating: ' + row.Slug + ' ...';
    try {
        const dupSlug = uniqueDupSlug(row.Slug);
        const res = await upsertPrompt({
            slug: dupSlug,
            name: row.Name + ' (copy)',
            body: row.Body,
            role: row.Role,
        });
        if (!res.ok) {
            refs.status.textContent = 'Duplicate failed: ' + (res.error ?? 'unknown');
            logError(LOG_SCOPE, 'duplicate failed', res);
            return;
        }
        log('PromptLibraryModal: duplicated ' + row.Slug + ' -> ' + dupSlug, 'info');
        await renderAllRoles(refs);
    } catch (err) {
        logError(LOG_SCOPE, 'duplicate threw', err);
        refs.status.textContent = 'Duplicate threw. See console.';
    }
}

async function handleDelete(refs: ModalRefs, row: PromptRow): Promise<void> {
    const ok = window.confirm('Delete prompt "' + row.Name + '" (' + row.Slug + ')?');
    if (!ok) return;
    refs.status.textContent = 'Deleting: ' + row.Slug + ' ...';
    try {
        const res = await deletePromptById(row.Id);
        if (!res.ok) {
            const reason = res.error ?? 'unknown';
            const msgText = 'Cannot delete "' + row.Name + '": ' + reason;
            refs.status.textContent = 'Delete blocked: ' + reason;
            logError(LOG_SCOPE, 'delete blocked', res);
            try { showToast(msgText, 'error'); } catch { /* jsdom: no-op */ }
            try { window.alert(msgText); } catch { /* jsdom: no-op */ }
            return;
        }
        log('PromptLibraryModal: deleted id=' + row.Id + ' slug=' + row.Slug, 'info');
        refs.status.textContent = 'Deleted: ' + row.Slug + '.';
        try { showToast('Deleted prompt "' + row.Slug + '"', 'success'); } catch { /* jsdom: no-op */ }
        await renderAllRoles(refs);
        void (async (): Promise<void> => {
            try {
                const loader = await import('./prompt-loader');
                loader.invalidatePromptCache();
                loader.rerenderPromptsDropdown();
            } catch (cacheErr) {
                logError(LOG_SCOPE, 'post-delete cache refresh failed', cacheErr);
            }
        })();

    } catch (err) {
        logError(LOG_SCOPE, 'delete threw', err);
        const detail = err instanceof Error ? err.message : String(err);
        refs.status.textContent = 'Delete failed: ' + detail;
        try { showToast('Delete failed: ' + detail, 'error'); } catch { /* jsdom: no-op */ }
    }
}


/**
 * Generate a `<original>-copy`, `<original>-copy-2`, ... slug. Slug
 * uniqueness at the DB layer is enforced by the UNIQUE index; this is
 * best-effort UX so the user rarely sees a duplicate-key error.
 */
export function uniqueDupSlug(baseSlug: string, existing: readonly string[] = []): string {
    const base = baseSlug.endsWith('-copy') || baseSlug.includes('-copy-') ? baseSlug : baseSlug + '-copy';
    if (!existing.includes(base)) return base;
    for (let i = 2; i < 1000; i++) {
        const candidate = baseSlug + '-copy-' + i;
        if (!existing.includes(candidate)) return candidate;
    }
    return baseSlug + '-copy-' + Date.now();
}
