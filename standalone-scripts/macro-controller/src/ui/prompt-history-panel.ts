/**
 * prompt-history-panel.ts - Restore-from-revision UI for Plan/Next prompts.
 *
 * Root problem this solves: v4.173.0 shipped the `PromptRevision` table and
 * `recordPromptRevision` snapshot on every `upsertPrompt`, but nothing in the
 * UI reads those rows yet. Users can accumulate history but cannot see or
 * restore it. This module renders a floating panel listing the last N
 * revisions for a given slug and lets the user restore any one of them.
 *
 * Restore contract
 * ----------------
 * "Restore" is implemented as a normal `upsertPrompt` call with the revision
 * `Body` (and ReplaceKey / ReplaceValues). Because `upsertPrompt` itself
 * snapshots the pre-image before writing, the restore is also undoable via
 * a subsequent restore from history. No new write path, no bypass of the
 * token drift guard or Rule-0 validator.
 */

import { listPromptRevisions, insertImportedRevisions, getMaxRevisionId, deleteImportedRevisionsAfter, type PromptRevisionRow, type ImportedRevisionInput } from '../db/prompt-revision-db';
import { deletePromptById, getDefaultPromptForRole, listPromptsByRole, upsertPrompt, type PromptRow } from '../db/prompt-db';
import type { PromptRole } from '../types/prompt-role';
import { logDiagnosticFromCode } from '../error-utils';
import type { DiagnosticContext } from '../errors/diagnostic-error';
import { showToast } from '../toast';
import { showUndoToast } from './prompt-utils';
import { writePendingRestoreUndo, clearPendingRestoreUndo } from './pending-restore-undo';
import { PLAN_NEXT_SEED_ROWS } from '../seed/plan-next-prompts';

export interface OpenPromptHistoryInput {
    role: PromptRole;
    /** Slug to load history for. If omitted, resolves the default row for the role. */
    slug?: string;
}

/** Test seam: allow unit tests to inject a fake document without touching the real DOM. */
export interface HistoryPanelDeps {
    doc?: Document;
    listRevisions?: typeof listPromptRevisions;
    listByRole?: typeof listPromptsByRole;
    getDefault?: typeof getDefaultPromptForRole;
    upsert?: typeof upsertPrompt;
    deletePrompt?: typeof deletePromptById;
    toast?: (message: string, kind?: 'info' | 'success' | 'error') => void;
    /**
     * Injectable undo-toast (v4.185.0). Defaults to `showUndoToast` from
     * `prompt-utils`. Split out from `toast` so unit tests can verify the
     * restore path attaches an undo action without stubbing the DOM.
     */
    undoToast?: (message: string, onUndo: () => void | Promise<void>, opts?: { undoLabel?: string; timeoutMs?: number; restoredId?: number | string }) => void;
    confirmFn?: (message: string) => boolean;
}

/**
 * Plan 26 step 10 (was v4.185.0 / v4.197.0 dedupe): route History-panel
 * failures through the coded-diagnostic registry with a per-code dedupe +
 * hourly rate cap. `logHistoryDiagnostic` calls `logDiagnosticFromCode`
 * exactly once per emission window; `reportHistoryFailure` layers a toast
 * on top with the `[code=X]` suffix so users can quote it in bug reports.
 *
 * Dedupe key is the error code alone. That is intentional: the panel's
 * codes are already scoped by action (`HISTORY_LIST_E001`,
 * `HISTORY_IMPORT_E001`, etc.), so byte-identical failures from repeated
 * clicks collapse into a single telemetry line per window.
 */
const PANEL_LOG_DEDUPE_WINDOW_MS = 60_000;
const PANEL_LOG_RATE_WINDOW_MS = 60 * 60_000;
const PANEL_LOG_MAX_EMISSIONS_PER_HOUR = 5;

interface DedupeEntry {
    lastAt: number;
    suppressed: number;
    windowStart: number;
    emittedInWindow: number;
}
const _panelLogDedupe = new Map<string, DedupeEntry>();

/** Exported for unit tests only. Not part of the module contract. */
export function _resetImportFailureDedupeForTests(): void {
    _panelLogDedupe.clear();
}

function logHistoryDiagnostic(
    code: string,
    context: DiagnosticContext,
    cause?: unknown,
): void {
    // Dedupe key = code + optional stage discriminator so distinct rejection
    // causes under the same code (e.g. oversized vs wrong-type on
    // HISTORY_IMPORT_E001) still emit within the same window.
    const stage = typeof context.stage === 'string' ? context.stage : '';
    const key = stage ? code + ':' + stage : code;
    const now = Date.now();
    const prev = _panelLogDedupe.get(key);
    const windowStart = prev && (now - prev.windowStart) < PANEL_LOG_RATE_WINDOW_MS
        ? prev.windowStart
        : now;
    const emittedInWindow = prev && windowStart === prev.windowStart ? prev.emittedInWindow : 0;
    const carriedSuppressed = prev ? prev.suppressed : 0;

    if (prev && (now - prev.lastAt) < PANEL_LOG_DEDUPE_WINDOW_MS) {
        _panelLogDedupe.set(key, {
            lastAt: now,
            suppressed: prev.suppressed + 1,
            windowStart,
            emittedInWindow,
        });
        return;
    }

    if (emittedInWindow >= PANEL_LOG_MAX_EMISSIONS_PER_HOUR) {
        _panelLogDedupe.set(key, {
            lastAt: now,
            suppressed: carriedSuppressed + 1,
            windowStart,
            emittedInWindow,
        });
        return;
    }

    const suppressed = carriedSuppressed;
    const enrichedContext = suppressed > 0
        ? { ...context, dedupSuppressed: suppressed, dedupWindowMs: PANEL_LOG_DEDUPE_WINDOW_MS }
        : context;
    logDiagnosticFromCode(code, enrichedContext, cause);
    _panelLogDedupe.set(key, {
        lastAt: now,
        suppressed: 0,
        windowStart,
        emittedInWindow: emittedInWindow + 1,
    });
}

function reportHistoryFailure(
    code: string,
    context: DiagnosticContext,
    userSentence: string,
    opts: { cause?: unknown; toast?: (m: string, k?: 'info' | 'success' | 'error') => void } = {},
): void {
    logHistoryDiagnostic(code, context, opts.cause);
    (opts.toast ?? showToast)(userSentence + '  [code=' + code + ']', 'error');
}

/**
 * Back-compat wrapper for the pre-v4.197.0 helper. Retains the
 * `handleImportFile[<key>]` prefix so grep-based dashboards keep working.
 *
 * Also captures the message + timestamp of the most recent import-path
 * failure so the History panel can surface a small "Last import error"
 * area (v4.197.0). Rate-limiting/dedup in `logPanelError` suppresses
 * telemetry spam, but the UI slot still updates on every call so the
 * user always sees the freshest reason (not a stale one from an hour
 * ago that survived the rate cap).
 */
interface LastImportError { key: string; detail: string; at: number; }
let _lastImportError: LastImportError | null = null;
let _lastImportErrorEl: HTMLElement | null = null;

/** Exported for unit tests only. */
export function _resetLastImportErrorForTests(): void {
    _lastImportError = null;
    _lastImportErrorEl = null;
}

/** Exported for unit tests only. */
export function _getLastImportErrorForTests(): LastImportError | null {
    return _lastImportError;
}

/**
 * Records the last import failure for the small "Last import error" UI
 * slot. Coded diagnostic logging is done separately by the caller via
 * `reportHistoryFailure` so we do NOT double-log here.
 */
function captureLastImportFailure(key: string, detail: string): void {
    _lastImportError = { key, detail, at: Date.now() };
    renderLastImportError();
}

function renderLastImportError(): void {
    const host = _lastImportErrorEl;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    const err = _lastImportError;
    if (!err) {
        host.style.display = 'none';
        return;
    }
    const doc = host.ownerDocument ?? document;
    host.style.display = 'flex';
    const label = doc.createElement('span');
    label.textContent = '⚠ Last import error:';
    label.style.cssText = 'color:#f87171;font-weight:600;flex-shrink:0;';
    const message = doc.createElement('span');
    message.setAttribute('data-role', 'last-import-error-message');
    message.textContent = err.key + ': ' + err.detail;
    message.title = err.key + ': ' + err.detail;
    message.style.cssText = 'color:#fca5a5;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    const when = doc.createElement('span');
    when.setAttribute('data-role', 'last-import-error-when');
    when.textContent = formatWhen(err.at);
    when.style.cssText = 'color:#f87171;font-variant-numeric:tabular-nums;flex-shrink:0;';
    const clear = doc.createElement('button');
    clear.textContent = '✕';
    clear.setAttribute(ATTR_DATA_ACTION, 'clear-last-import-error');
    clear.setAttribute(ATTR_ARIA_LABEL, 'Dismiss last import error');
    clear.setAttribute('type', 'button');
    clear.style.cssText = 'background:transparent;border:1px solid #7f1d1d;color:#fca5a5;font-size:10px;padding:0 6px;border-radius:3px;cursor:pointer;flex-shrink:0;';
    clear.onclick = () => { _lastImportError = null; renderLastImportError(); };
    host.appendChild(label);
    host.appendChild(message);
    host.appendChild(when);
    host.appendChild(clear);
}


const PANEL_ID = 'marco-prompt-history-panel';
const ATTR_DATA_ACTION = 'data-action';
const ATTR_ARIA_LABEL = 'aria-label';
const UNDO_RESTORE_LABEL = 'Undo restore';

/**
 * Import byte-size cap (v4.184.0). Mirrors the Prompt Library modal's
 * `IMPORT_MAX_BYTES` guard (see `prompt-library-modal.ts`). A revision
 * archive is tiny JSON in practice (bounded by `PROMPT_REVISION_LIMIT_PER_SLUG`
 * = 20 rows). Anything larger is either a mis-selected file or a
 * memory-exhaustion attempt: reject with logError telemetry before we
 * even call `file.text()`.
 */
const HISTORY_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Sentinel used by `insertImportedRevisions` to mark rows that came from
 * an off-device archive (`PromptId = 0`, since the source database's Ids
 * do not exist here). The history panel displays a badge for these rows
 * so users can audit provenance at a glance (v4.184.0).
 */
const IMPORTED_REVISION_PROMPT_ID = 0;

export async function openPromptHistoryPanel(
    input: OpenPromptHistoryInput,
    deps: HistoryPanelDeps = {},
): Promise<void> {
    const doc = deps.doc ?? document;
    const listRev = deps.listRevisions ?? listPromptRevisions;
    const listRole = deps.listByRole ?? listPromptsByRole;
    const getDef = deps.getDefault ?? getDefaultPromptForRole;
    const toast = deps.toast ?? showToast;

    const roleLabel = input.role === 'plan' ? 'Plan' : input.role === 'next' ? 'Next' : String(input.role);
    const slug = await resolveSlug(input, getDef, listRole);
    if (slug === null) {
        toast(
            '❌ History (last 20 edits): no ' + roleLabel + ' prompt found in database yet. '
            + 'Open the ' + roleLabel + ' chip gear → "Edit default ' + roleLabel + ' prompt" once to seed it, then retry.',
            'error',
        );
        return;
    }

    const revResult = await listRev(slug);
    if (!revResult.ok || !revResult.value) {
        const reason = revResult.error ?? 'unknown';
        reportHistoryFailure(
            'HISTORY_LIST_E001',
            { slug, role: input.role, reason },
            '❌ History (last 20 edits) failed to load for "' + slug + '": ' + reason,
            { cause: revResult.error, toast },
        );
        return;
    }

    removeExistingPanel(doc);
    const panel = buildPanel(doc, slug, revResult.value, input.role, deps);
    doc.body.appendChild(panel);
}

async function resolveSlug(
    input: OpenPromptHistoryInput,
    getDef: NonNullable<HistoryPanelDeps['getDefault']>,
    listRole: NonNullable<HistoryPanelDeps['listByRole']>,
): Promise<string | null> {
    if (typeof input.slug === 'string' && input.slug.length > 0) return input.slug;
    const def = await getDef(input.role);
    if (def.ok && def.value) return def.value.Slug;
    // Fallback 1: any existing row for this role (default flag may have been lost).
    const listed = await listRole(input.role);
    if (listed.ok && Array.isArray(listed.value) && listed.value.length > 0) {
        const first = listed.value[0];
        if (first && typeof first.Slug === 'string' && first.Slug.length > 0) return first.Slug;
    }
    // Fallback 2: canonical seed slug so History still works before first save.
    const seed = PLAN_NEXT_SEED_ROWS.find(r => r.role === input.role && r.isDefault);
    if (seed) return seed.slug;
    logHistoryDiagnostic(
        'HISTORY_RESOLVE_E001',
        {
            requestedSlug: input.slug ?? '',
            role: input.role,
            fallbackChain: 'getDefault->listByRole->seed',
        },
        def.ok ? undefined : def.error,
    );
    return null;
}

function removeExistingPanel(doc: Document): void {
    const existing = doc.getElementById(PANEL_ID);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    _lastImportErrorEl = null;
}



function buildHeaderActions(
    doc: Document,
    slug: string,
    role: PromptRole,
    revisions: PromptRevisionRow[],
    deps: HistoryPanelDeps,
): HTMLElement {
    const actionsGroup = doc.createElement('div');
    actionsGroup.style.cssText = 'display:flex;gap:6px;';
    const exportBtn = doc.createElement('button');
    exportBtn.textContent = '↓ Export JSON';
    exportBtn.setAttribute(ATTR_DATA_ACTION, 'export-history');
    exportBtn.setAttribute(ATTR_ARIA_LABEL, 'Export revision history as JSON');
    exportBtn.style.cssText = 'background:#1f2937;border:1px solid #475569;color:#e5e7eb;font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;';
    exportBtn.onclick = () => downloadRevisionExport(doc, slug, role, revisions);
    actionsGroup.appendChild(exportBtn);

    const importInput = doc.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.style.cssText = 'display:none;';
    importInput.setAttribute('data-testid', 'history-import-input');
    const importBtn = doc.createElement('button');
    importBtn.textContent = '↑ Import JSON';
    importBtn.setAttribute(ATTR_DATA_ACTION, 'import-history');
    importBtn.setAttribute(ATTR_ARIA_LABEL, 'Import revision history from JSON');
    importBtn.style.cssText = 'background:#1f2937;border:1px solid #475569;color:#e5e7eb;font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;';
    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => handleImportFile(importInput, slug, role, deps);
    actionsGroup.appendChild(importBtn);
    actionsGroup.appendChild(importInput);

    const closeBtn = doc.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute(ATTR_ARIA_LABEL, 'Close history panel');
    closeBtn.style.cssText = 'background:transparent;border:1px solid #475569;color:#e5e7eb;padding:2px 8px;border-radius:4px;cursor:pointer;';
    closeBtn.onclick = () => removeExistingPanel(doc);
    actionsGroup.appendChild(closeBtn);
    return actionsGroup;
}

function buildPanelHeader(
    doc: Document,
    slug: string,
    role: PromptRole,
    revisions: PromptRevisionRow[],
    deps: HistoryPanelDeps,
): HTMLElement {
    const header = doc.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
    const title = doc.createElement('div');
    title.textContent = '↺ History  ' + slug;
    title.style.cssText = 'font-size:14px;font-weight:700;color:#a78bfa;';
    header.appendChild(title);
    header.appendChild(buildHeaderActions(doc, slug, role, revisions, deps));
    return header;
}

function buildLastErrorArea(doc: Document): HTMLElement {
    const lastErr = doc.createElement('div');
    lastErr.setAttribute('data-role', 'last-import-error');
    lastErr.setAttribute('aria-live', 'polite');
    lastErr.style.cssText = 'display:none;align-items:center;gap:8px;font-size:11px;background:#1a0e0e;border:1px solid #7f1d1d;border-radius:4px;padding:4px 8px;';
    return lastErr;
}

function buildPanel(
    doc: Document,
    slug: string,
    revisions: PromptRevisionRow[],
    role: PromptRole,
    deps: HistoryPanelDeps,
): HTMLElement {
    const overlay = doc.createElement('div');
    overlay.id = PANEL_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute(ATTR_ARIA_LABEL, 'Prompt history for ' + slug);
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;color-scheme:dark;';

    const card = doc.createElement('div');
    card.style.cssText = 'background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;width:min(720px,92vw);max-height:82vh;display:flex;flex-direction:column;gap:10px;font-family:system-ui,sans-serif;color:#e5e7eb;';
    overlay.appendChild(card);

    card.appendChild(buildPanelHeader(doc, slug, role, revisions, deps));

    const subtitle = doc.createElement('div');
    subtitle.setAttribute('data-role', 'history-subtitle');
    subtitle.style.cssText = 'font-size:11px;color:#94a3b8;';
    card.appendChild(subtitle);

    const lastErr = buildLastErrorArea(doc);
    card.appendChild(lastErr);
    _lastImportErrorEl = lastErr;
    renderLastImportError();

    const state: HistoryViewState = {
        sortKey: 'date',
        sortDir: 'desc',
        selectedReasons: new Set<string>(),
        importedFilter: 'all',
    };

    const toolbar = doc.createElement('div');
    toolbar.setAttribute('data-role', 'history-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute(ATTR_ARIA_LABEL, 'History sort and filter controls');
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:#cbd5e1;';
    card.appendChild(toolbar);

    const list = doc.createElement('div');
    list.setAttribute('data-role', 'revision-list');
    list.style.cssText = 'overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px;';
    card.appendChild(list);

    const renderList = (): void => {
        const view = filterRevisions(sortRevisions(revisions, state.sortKey, state.sortDir), {
            reasons: state.selectedReasons,
            imported: state.importedFilter,
        });
        while (list.firstChild) list.removeChild(list.firstChild);
        for (const rev of view) list.appendChild(buildRevisionRow(doc, rev, role, deps));
        subtitle.textContent = buildSubtitleText(revisions.length, view.length);
        renderToolbar(doc, toolbar, revisions, state, renderList);
    };
    renderList();

    overlay.onclick = (e: MouseEvent) => {
        if (e.target === overlay) removeExistingPanel(doc);
    };
    return overlay;
}

function buildSubtitleText(total: number, visible: number): string {
    if (total === 0) return 'No revisions yet. Edit this prompt and the previous body will be saved here.';
    if (visible === total) return String(total) + ' revision(s), newest first. Click Restore to bring one back.';
    return 'Showing ' + String(visible) + ' of ' + String(total) + ' revision(s). Click Restore to bring one back.';
}

/** Sortable columns exposed in the history toolbar (v4.192.0). */
export type HistorySortKey = 'date' | 'reason';
export type HistorySortDir = 'asc' | 'desc';
/**
 * Imported-provenance filter cycle:
 * - `all`: show both native and imported rows.
 * - `only`: show only rows written by `insertImportedRevisions` (PromptId=0).
 * - `exclude`: hide those rows entirely.
 */
export type HistoryImportedFilter = 'all' | 'only' | 'exclude';

interface HistoryViewState {
    sortKey: HistorySortKey;
    sortDir: HistorySortDir;
    selectedReasons: Set<string>;
    importedFilter: HistoryImportedFilter;
}

/**
 * Pure sort: newest-first date order by default; reason sort is alphabetical
 * with a stable tie-break on CreatedAt DESC then Id DESC so imports of the
 * same reason keep a deterministic order.
 */
export function sortRevisions(
    rows: readonly PromptRevisionRow[],
    key: HistorySortKey,
    dir: HistorySortDir,
): PromptRevisionRow[] {
    const factor = dir === 'asc' ? 1 : -1;
    const copy = rows.slice();
    copy.sort((a, b) => {
        if (key === 'reason') {
            const cmp = a.Reason.localeCompare(b.Reason);
            if (cmp !== 0) return factor * cmp;
        } else {
            const cmp = a.CreatedAt - b.CreatedAt;
            if (cmp !== 0) return factor * cmp;
        }
        // Deterministic tie-break: newest CreatedAt, then highest Id.
        if (a.CreatedAt !== b.CreatedAt) return b.CreatedAt - a.CreatedAt;
        return b.Id - a.Id;
    });
    return copy;
}

/**
 * Pure filter: keep rows whose `Reason` is in `reasons` (empty set = keep
 * all reasons) AND whose imported provenance matches `imported`.
 */
export function filterRevisions(
    rows: readonly PromptRevisionRow[],
    filter: { reasons: ReadonlySet<string>; imported: HistoryImportedFilter },
): PromptRevisionRow[] {
    return rows.filter((r) => {
        if (filter.reasons.size > 0 && !filter.reasons.has(r.Reason)) return false;
        const isImported = r.PromptId === IMPORTED_REVISION_PROMPT_ID;
        if (filter.imported === 'only' && !isImported) return false;
        if (filter.imported === 'exclude' && isImported) return false;
        return true;
    });
}

function collectReasons(rows: readonly PromptRevisionRow[]): string[] {
    const seen = new Set<string>();
    for (const r of rows) if (typeof r.Reason === 'string' && r.Reason.length > 0) seen.add(r.Reason);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function renderReasonChips(
    doc: Document,
    toolbar: HTMLElement,
    rows: readonly PromptRevisionRow[],
    state: HistoryViewState,
    rerender: () => void,
): void {
    for (const reason of collectReasons(rows)) {
        const active = state.selectedReasons.has(reason);
        const chip = buildChip(doc, reason, active, 'reason-chip');
        chip.setAttribute('data-reason', reason);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
        chip.setAttribute(ATTR_ARIA_LABEL, 'Filter by reason ' + reason + (active ? ' (active)' : ''));
        chip.onclick = () => {
            if (active) state.selectedReasons.delete(reason);
            else state.selectedReasons.add(reason);
            rerender();
        };
        toolbar.appendChild(chip);
    }
}

function buildImportedChip(
    doc: Document,
    state: HistoryViewState,
    rerender: () => void,
): HTMLElement {
    const importedLabel = state.importedFilter === 'all'
        ? 'imported: all'
        : state.importedFilter === 'only' ? 'imported: only' : 'imported: hide';
    const importedActive = state.importedFilter !== 'all';
    const importedChip = buildChip(doc, importedLabel, importedActive, 'imported-chip');
    importedChip.setAttribute('data-imported-filter', state.importedFilter);
    importedChip.setAttribute('title', 'Cycle: all → only → hide → all');
    importedChip.setAttribute(ATTR_ARIA_LABEL,
        'Imported provenance filter, currently ' + state.importedFilter
        + '. Activate to cycle through all, only, hide.');
    importedChip.setAttribute('aria-pressed', importedActive ? 'true' : 'false');
    importedChip.onclick = () => {
        state.importedFilter = state.importedFilter === 'all'
            ? 'only'
            : state.importedFilter === 'only' ? 'exclude' : 'all';
        rerender();
    };
    return importedChip;
}

function buildClearFiltersButton(
    doc: Document,
    state: HistoryViewState,
    rerender: () => void,
): HTMLElement {
    const clear = doc.createElement('button');
    clear.textContent = 'Clear';
    clear.setAttribute(ATTR_DATA_ACTION, 'clear-filters');
    clear.setAttribute(ATTR_ARIA_LABEL, 'Clear all history filters');
    clear.setAttribute('type', 'button');
    clear.style.cssText = 'background:transparent;border:1px solid #475569;color:#e5e7eb;font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;margin-left:2px;';
    clear.onclick = () => {
        state.selectedReasons.clear();
        state.importedFilter = 'all';
        rerender();
    };
    return clear;
}

function renderToolbar(
    doc: Document,
    toolbar: HTMLElement,
    rows: readonly PromptRevisionRow[],
    state: HistoryViewState,
    rerender: () => void,
): void {
    while (toolbar.firstChild) toolbar.removeChild(toolbar.firstChild);

    const sortLabel = doc.createElement('span');
    sortLabel.textContent = 'Sort:';
    sortLabel.setAttribute('aria-hidden', 'true');
    sortLabel.style.cssText = 'color:#94a3b8;';
    toolbar.appendChild(sortLabel);

    const arrow = state.sortDir === 'asc' ? ' ↑' : ' ↓';
    toolbar.appendChild(buildSortButton(doc, 'Date', 'date', state, rerender, arrow));
    toolbar.appendChild(buildSortButton(doc, 'Reason', 'reason', state, rerender, arrow));

    const sep = doc.createElement('span');
    sep.textContent = '│';
    sep.setAttribute('aria-hidden', 'true');
    sep.style.cssText = 'color:#334155;margin:0 4px;';
    toolbar.appendChild(sep);

    const filterLabel = doc.createElement('span');
    filterLabel.textContent = 'Filter:';
    filterLabel.setAttribute('aria-hidden', 'true');
    filterLabel.style.cssText = 'color:#94a3b8;';
    toolbar.appendChild(filterLabel);

    renderReasonChips(doc, toolbar, rows, state, rerender);
    toolbar.appendChild(buildImportedChip(doc, state, rerender));

    if (state.selectedReasons.size > 0 || state.importedFilter !== 'all') {
        toolbar.appendChild(buildClearFiltersButton(doc, state, rerender));
    }

    installRovingTabindex(toolbar);
}

/**
 * Roving tabindex + arrow-key navigation for the toolbar (WAI-ARIA APG
 * toolbar pattern). The active control has tabindex=0; siblings are -1.
 * ArrowLeft/ArrowRight cycle horizontally; Home/End jump to the ends.
 * Keeps focus inside the toolbar without stealing it from the rest of
 * the panel.
 */
function installRovingTabindex(toolbar: HTMLElement): void {
    const controls = Array.from(
        toolbar.querySelectorAll<HTMLButtonElement>('button'),
    );
    if (controls.length === 0) return;
    for (let i = 0; i < controls.length; i += 1) {
        const btn = controls[i];
        if (!btn) continue;
        btn.setAttribute('type', 'button');
        btn.tabIndex = i === 0 ? 0 : -1;
        btn.addEventListener('keydown', (ev: KeyboardEvent) => {
            const key = ev.key;
            const isHoriz = key === 'ArrowRight' || key === 'ArrowLeft';
            const isEdge = key === 'Home' || key === 'End';
            if (!isHoriz && !isEdge) return;
            ev.preventDefault();
            const currentIdx = controls.indexOf(btn);
            let nextIdx = currentIdx;
            if (key === 'ArrowRight') nextIdx = (currentIdx + 1) % controls.length;
            else if (key === 'ArrowLeft') nextIdx = (currentIdx - 1 + controls.length) % controls.length;
            else if (key === 'Home') nextIdx = 0;
            else if (key === 'End') nextIdx = controls.length - 1;
            const next = controls[nextIdx];
            if (!next) return;
            for (const c of controls) c.tabIndex = -1;
            next.tabIndex = 0;
            next.focus();
        });
    }
}

function buildSortButton(
    doc: Document,
    label: string,
    key: HistorySortKey,
    state: HistoryViewState,
    rerender: () => void,
    arrow: string,
): HTMLButtonElement {
    const active = state.sortKey === key;
    const btn = doc.createElement('button');
    btn.textContent = label + (active ? arrow : '');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-role', 'sort-button');
    btn.setAttribute('data-sort-key', key);
    if (active) btn.setAttribute('data-sort-dir', state.sortDir);
    const dirText = state.sortDir === 'asc' ? 'ascending' : 'descending';
    btn.setAttribute(ATTR_ARIA_LABEL,
        'Sort by ' + label + (active ? ', currently ' + dirText + '. Activate to reverse.' : '. Activate to sort.'));
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) btn.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
    const base = 'font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer;font-weight:600;';
    btn.style.cssText = active
        ? base + 'background:#312e81;border:1px solid #6366f1;color:#e0e7ff;'
        : base + 'background:#1f2937;border:1px solid #334155;color:#cbd5e1;';
    btn.onclick = () => {
        if (state.sortKey === key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortKey = key;
            state.sortDir = 'desc';
        }
        rerender();
    };
    return btn;
}

function buildChip(doc: Document, label: string, active: boolean, dataRole: string): HTMLButtonElement {
    const chip = doc.createElement('button');
    chip.textContent = label;
    chip.setAttribute('type', 'button');
    chip.setAttribute('data-role', dataRole);
    const base = 'font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;font-weight:600;letter-spacing:0.02em;';
    chip.style.cssText = active
        ? base + 'background:#1e293b;border:1px solid #facc15;color:#facc15;'
        : base + 'background:#111827;border:1px solid #334155;color:#94a3b8;';
    return chip;
}


function buildRevisionRow(
    doc: Document,
    rev: PromptRevisionRow,
    role: PromptRole,
    deps: HistoryPanelDeps,
): HTMLElement {
    const row = doc.createElement('div');
    row.setAttribute('data-role', 'revision-row');
    row.setAttribute('data-revision-id', String(rev.Id));
    row.style.cssText = 'border:1px solid #334155;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px;background:#111827;';

    const meta = doc.createElement('div');
    meta.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:11px;color:#94a3b8;';
    const when = doc.createElement('span');
    when.textContent = formatWhen(rev.CreatedAt);
    const reason = doc.createElement('span');
    reason.textContent = 'reason: ' + rev.Reason;
    reason.style.cssText = 'color:#a78bfa;';
    const name = doc.createElement('span');
    name.textContent = rev.Name;
    name.style.cssText = 'color:#e5e7eb;font-weight:600;';
    meta.appendChild(name);
    meta.appendChild(when);
    meta.appendChild(reason);
    if (rev.PromptId === IMPORTED_REVISION_PROMPT_ID) {
        const imported = doc.createElement('span');
        imported.textContent = 'imported';
        imported.setAttribute('data-role', 'imported-badge');
        imported.setAttribute('title', 'Restored from an off-device history archive (PromptId=0 sentinel).');
        imported.style.cssText = 'background:#1e293b;border:1px solid #475569;color:#facc15;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:600;letter-spacing:0.02em;';
        meta.appendChild(imported);
    }
    row.appendChild(meta);

    const preview = doc.createElement('pre');
    preview.textContent = truncateBody(rev.Body);
    preview.style.cssText = 'margin:0;font-size:11px;color:#cbd5e1;background:#0b1220;border:1px solid #1f2937;border-radius:4px;padding:6px;max-height:120px;overflow:auto;white-space:pre-wrap;font-family:ui-monospace,monospace;';
    row.appendChild(preview);

    const actions = doc.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;';
    const restoreBtn = doc.createElement('button');
    restoreBtn.textContent = '↺ Restore this version';
    restoreBtn.setAttribute(ATTR_DATA_ACTION, 'restore-revision');
    restoreBtn.style.cssText = 'background:#7c3aed;border:none;color:#fff;font-size:11px;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600;';
    restoreBtn.onclick = () => {
        void handleRestore(rev, role, deps);
    };
    actions.appendChild(restoreBtn);
    row.appendChild(actions);
    return row;
}

interface RestorePreImage {
    id: number;
    body: string;
    replaceKey: string;
    replaceValues: string[];
}

function buildPreImage(currentRow: PromptRow | undefined): RestorePreImage | null {
    if (!currentRow) return null;
    return {
        id: currentRow.Id,
        body: currentRow.Body,
        replaceKey: currentRow.ReplaceKey,
        replaceValues: Array.isArray(currentRow.ReplaceValues)
            ? [...currentRow.ReplaceValues]
            : parseReplaceValues(
                (currentRow as unknown as { ReplaceValues?: string }).ReplaceValues ?? '[]',
            ),
    };
}

async function handleRestoreUpdate(
    rev: PromptRevisionRow,
    preImage: RestorePreImage,
    upsert: NonNullable<HistoryPanelDeps['upsert']>,
    undoToast: NonNullable<HistoryPanelDeps['undoToast']>,
    toast: NonNullable<HistoryPanelDeps['toast']>,
    successMsg: string,
    undoTimeoutMs: number,
    now: number,
): Promise<void> {
    writePendingRestoreUndo({
        payload: {
            kind: 'update',
            restoredId: preImage.id,
            restoredBody: rev.Body,
            restoredReplaceKey: rev.ReplaceKey,
            slug: rev.Slug,
            name: rev.Name,
            role: rev.Role,
            preBody: preImage.body,
            preReplaceKey: preImage.replaceKey,
            preReplaceValues: preImage.replaceValues,
        },
        message: successMsg,
        undoLabel: UNDO_RESTORE_LABEL,
        createdAt: now,
        expiresAt: now + undoTimeoutMs,
    });
    undoToast(successMsg, async () => {
        clearPendingRestoreUndo();
        const revert = await upsert({
            id: preImage.id,
            previousBody: rev.Body,
            previousReplaceKey: rev.ReplaceKey,
            slug: rev.Slug,
            name: rev.Name,
            body: preImage.body,
            role: rev.Role,
            replaceKey: preImage.replaceKey,
            replaceValues: preImage.replaceValues,
        });
        if (!revert.ok) {
            const reason = revert.error ?? 'unknown';
            reportHistoryFailure(
                'HISTORY_UNDO_E001',
                { slug: rev.Slug, undoKind: 'restore-update', reason, revisionId: rev.Id },
                '❌ Undo failed: ' + reason,
                { cause: revert.error, toast },
            );
            return;
        }
        toast('↺ Reverted to previous body', 'success');
    }, { undoLabel: UNDO_RESTORE_LABEL, timeoutMs: undoTimeoutMs, restoredId: preImage.id });
    setTimeout(clearPendingRestoreUndo, undoTimeoutMs + 500);
}

function handleRestoreInsert(
    newId: number,
    slug: string,
    revisionId: number,
    deleteFn: NonNullable<HistoryPanelDeps['deletePrompt']>,
    undoToast: NonNullable<HistoryPanelDeps['undoToast']>,
    toast: NonNullable<HistoryPanelDeps['toast']>,
    successMsg: string,
    undoTimeoutMs: number,
    now: number,
): void {
    writePendingRestoreUndo({
        payload: { kind: 'insert', newId },
        message: successMsg,
        undoLabel: UNDO_RESTORE_LABEL,
        createdAt: now,
        expiresAt: now + undoTimeoutMs,
    });
    undoToast(successMsg, async () => {
        clearPendingRestoreUndo();
        const del = await deleteFn(newId);
        if (!del.ok) {
            const reason = del.error ?? 'unknown';
            reportHistoryFailure(
                'HISTORY_UNDO_E001',
                { slug, undoKind: 'restore-insert', reason, revisionId },
                '❌ Undo failed: ' + reason,
                { cause: del.error, toast },
            );
            return;
        }
        toast('↺ Removed restored row', 'success');
    }, { undoLabel: UNDO_RESTORE_LABEL, timeoutMs: undoTimeoutMs, restoredId: newId });
    setTimeout(clearPendingRestoreUndo, undoTimeoutMs + 500);
}

// eslint-disable-next-line max-lines-per-function -- restore flow is a single linear ceremony
async function handleRestore(
    rev: PromptRevisionRow,
    role: PromptRole,
    deps: HistoryPanelDeps,
): Promise<void> {
    const doc = deps.doc ?? document;
    const upsert = deps.upsert ?? upsertPrompt;
    const deleteFn = deps.deletePrompt ?? deletePromptById;
    const listByRole = deps.listByRole ?? listPromptsByRole;
    const toast = deps.toast ?? showToast;
    const undoToast = deps.undoToast ?? showUndoToast;
    const confirmFn = deps.confirmFn ?? ((m: string) => window.confirm(m));

    const proceed = confirmFn(
        'Restore "' + rev.Name + '" from ' + formatWhen(rev.CreatedAt) + '?\n\n'
        + 'The current body will itself be recorded as a new revision, so you can undo this restore later from the same history panel.',
    );
    if (!proceed) return;

    const listResult = await listByRole(role);
    if (!listResult.ok || !listResult.value) {
        const reason = listResult.error ?? 'unknown';
        reportHistoryFailure(
            'HISTORY_RESTORE_E001',
            { slug: rev.Slug, revisionId: rev.Id, phase: 'list-role', reason },
            '❌ Restore failed: could not read current row (' + reason + ')',
            { cause: listResult.error, toast },
        );
        return;
    }
    const currentRow = listResult.value.find((p) => p.Slug === rev.Slug);
    const replaceValues = parseReplaceValues(rev.ReplaceValues);
    const preImage = buildPreImage(currentRow);

    const upsertResult = await upsert({
        ...(currentRow ? { id: currentRow.Id, previousBody: currentRow.Body, previousReplaceKey: currentRow.ReplaceKey } : {}),
        slug: rev.Slug,
        name: rev.Name,
        body: rev.Body,
        role: rev.Role,
        replaceKey: rev.ReplaceKey,
        replaceValues,
    });
    if (!upsertResult.ok) {
        const reason = upsertResult.error ?? 'unknown';
        reportHistoryFailure(
            'HISTORY_RESTORE_E001',
            { slug: rev.Slug, revisionId: rev.Id, phase: 'upsert', reason },
            '❌ Restore failed: ' + reason,
            { cause: upsertResult.error, toast },
        );
        return;
    }
    const successMsg = '✅ Restored "' + rev.Name + '" from ' + formatWhen(rev.CreatedAt);
    const undoTimeoutMs = 10_000;
    const now = Date.now();
    if (preImage) {
        await handleRestoreUpdate(rev, preImage, upsert, undoToast, toast, successMsg, undoTimeoutMs, now);
    } else {
        const newId = upsertResult.value;
        if (typeof newId !== 'number') {
            removeExistingPanel(doc);
            return;
        }
        handleRestoreInsert(newId, rev.Slug, rev.Id, deleteFn, undoToast, toast, successMsg, undoTimeoutMs, now);
    }
    removeExistingPanel(doc);
}

function parseReplaceValues(raw: string): string[] {
    if (typeof raw !== 'string' || raw.length === 0) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
        return [];
    } catch (err) {
        logHistoryDiagnostic('HISTORY_INTERNAL_E001', { stage: 'parse-replace-values', reason: 'invalid JSON, defaulting to []' }, err);
        return [];
    }
}

function truncateBody(body: string): string {
    if (typeof body !== 'string') return '';
    if (body.length <= 400) return body;
    return body.slice(0, 400) + '\n… (' + String(body.length - 400) + ' more chars)';
}

function formatWhen(ts: number): string {
    if (!Number.isFinite(ts) || ts <= 0) return 'unknown time';
    try {
        return new Date(ts).toLocaleString();
    } catch (err) {
        logHistoryDiagnostic('HISTORY_INTERNAL_E001', { stage: 'format-when', reason: 'toLocaleString failed' }, err);
        return String(ts);
    }
}

/**
 * Serializable payload emitted by the "↓ Export JSON" button. Kept as a pure
 * function so it can be unit-tested without a DOM and reused later by a
 * cross-machine migration tool.
 */
export interface RevisionExportPayload {
    readonly schemaVersion: 1;
    readonly slug: string;
    readonly role: PromptRole;
    readonly exportedAt: number;
    readonly revisionCount: number;
    readonly revisions: PromptRevisionRow[];
}

export function buildRevisionExportPayload(
    slug: string,
    role: PromptRole,
    revisions: PromptRevisionRow[],
    now: number = Date.now(),
): RevisionExportPayload {
    return {
        schemaVersion: 1,
        slug,
        role,
        exportedAt: now,
        revisionCount: revisions.length,
        revisions,
    };
}

function downloadRevisionExport(
    doc: Document,
    slug: string,
    role: PromptRole,
    revisions: PromptRevisionRow[],
): void {
    try {
        const payload = buildRevisionExportPayload(slug, role, revisions);
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = doc.createElement('a');
        anchor.href = url;
        anchor.download = 'prompt-history-' + slug + '-' + String(payload.exportedAt) + '.json';
        anchor.setAttribute('data-testid', 'history-export-anchor');
        doc.body.appendChild(anchor);
        anchor.click();
        if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
        // Release the object URL after the click has been dispatched.
        setTimeout(() => {
            try { URL.revokeObjectURL(url); }
            catch (err) { logHistoryDiagnostic('HISTORY_INTERNAL_E001', { stage: 'revoke-url', reason: 'revokeObjectURL failed' }, err); }
        }, 1000);
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        reportHistoryFailure(
            'HISTORY_EXPORT_E001',
            { slug, role, reason },
            '❌ Export failed: ' + reason,
            { cause: err },
        );
    }
}

/**
 * Pure parser: validates an exported JSON blob and normalizes it into a
 * list of importable revision rows for the given target slug. Rejects
 * schema-version mismatches, wrong role, and missing required fields with
 * an explicit `error` string (never throws).
 *
 * Introduced in v4.183.0 as the round-trip companion to
 * `buildRevisionExportPayload`.
 */
export interface RevisionImportResult {
    readonly ok: boolean;
    readonly rows?: ImportedRevisionInput[];
    readonly error?: string;
    readonly sourceSlug?: string;
    readonly sourceRole?: PromptRole;
}

function validateImportEnvelope(
    parsed: unknown,
    expectedSlug: string,
    expectedRole: PromptRole,
): { ok: true; envelope: Record<string, unknown>; revisions: unknown[] } | { ok: false; error: string } {
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Payload is not an object' };
    }
    const p = parsed as Record<string, unknown>;
    if (p['schemaVersion'] !== 1) {
        return { ok: false, error: 'Unsupported schemaVersion (expected 1, got ' + String(p['schemaVersion']) + ')' };
    }
    const pSlug = p['slug'];
    if (typeof pSlug !== 'string' || pSlug.trim() === '') {
        return { ok: false, error: 'Missing or invalid slug' };
    }
    if (pSlug !== expectedSlug) {
        return { ok: false, error: 'Slug mismatch: file is for "' + pSlug + '", panel is open on "' + expectedSlug + '"' };
    }
    const pRole = p['role'];
    if (pRole !== expectedRole) {
        return { ok: false, error: 'Role mismatch: file is "' + String(pRole) + '", panel is "' + expectedRole + '"' };
    }
    const pRevisions = p['revisions'];
    if (!Array.isArray(pRevisions)) {
        return { ok: false, error: 'revisions is not an array' };
    }
    return { ok: true, envelope: p, revisions: pRevisions };
}

function coerceImportRow(
    rawItem: unknown,
    index: number,
    expectedSlug: string,
    expectedRole: PromptRole,
): { ok: true; row: ImportedRevisionInput } | { ok: false; error: string } {
    if (!rawItem || typeof rawItem !== 'object') {
        return { ok: false, error: 'revisions[' + String(index) + '] is not an object' };
    }
    const raw = rawItem as Record<string, unknown>;
    const rawBody = raw['Body'];
    const rawName = raw['Name'];
    const rawSlug = raw['Slug'];
    if (typeof rawBody !== 'string' || typeof rawName !== 'string' || typeof rawSlug !== 'string') {
        return { ok: false, error: 'revisions[' + String(index) + '] missing required fields' };
    }
    if (rawSlug !== expectedSlug) {
        return { ok: false, error: 'revisions[' + String(index) + '] slug mismatch' };
    }
    const rawRole = raw['Role'];
    const rawReplaceKey = raw['ReplaceKey'];
    const rawReplaceValues = raw['ReplaceValues'];
    const rawCreatedAt = raw['CreatedAt'];
    const rawReason = raw['Reason'];
    return {
        ok: true,
        row: {
            Slug: rawSlug,
            Name: rawName,
            Body: rawBody,
            Role: (typeof rawRole === 'string' ? rawRole : expectedRole) as PromptRole,
            ReplaceKey: typeof rawReplaceKey === 'string' ? rawReplaceKey : '',
            ReplaceValues: typeof rawReplaceValues === 'string' ? rawReplaceValues : '[]',
            CreatedAt: typeof rawCreatedAt === 'number' ? rawCreatedAt : Date.now(),
            Reason: typeof rawReason === 'string' ? rawReason : 'import',
        },
    };
}

export function parseRevisionImportPayload(
    jsonText: string,
    expectedSlug: string,
    expectedRole: PromptRole,
): RevisionImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch (err) {
        return { ok: false, error: 'Invalid JSON: ' + (err instanceof Error ? err.message : String(err)) };
    }
    const envelope = validateImportEnvelope(parsed, expectedSlug, expectedRole);
    if (!envelope.ok) return { ok: false, error: envelope.error };
    const rows: ImportedRevisionInput[] = [];
    for (let i = 0; i < envelope.revisions.length; i += 1) {
        const coerced = coerceImportRow(envelope.revisions[i], i, expectedSlug, expectedRole);
        if (!coerced.ok) return { ok: false, error: coerced.error };
        rows.push(coerced.row);
    }
    return { ok: true, rows, sourceSlug: expectedSlug, sourceRole: expectedRole };
}

function validateImportFile(
    file: File,
    slug: string,
    role: PromptRole,
    toast: NonNullable<HistoryPanelDeps['toast']>,
): boolean {
    if (file.size > HISTORY_IMPORT_MAX_BYTES) {
        const maxMb = HISTORY_IMPORT_MAX_BYTES / (1024 * 1024);
        const detail = 'file "' + file.name + '" is ' + String(file.size)
            + ' bytes, cap is ' + String(HISTORY_IMPORT_MAX_BYTES)
            + ' (' + String(maxMb) + ' MB) for slug ' + slug + ' role ' + role;
        captureLastImportFailure('oversized', 'rejected oversized file: ' + detail);
        reportHistoryFailure(
            'HISTORY_IMPORT_E001',
            { slug, role, stage: 'oversized', reason: detail },
            '❌ Import failed: file exceeds ' + String(maxMb) + ' MB cap. Split the archive or export a smaller subset.',
            { toast },
        );
        return false;
    }
    const looksLikeJson = /\.json$/i.test(file.name)
        || file.type === 'application/json'
        || file.type === '';
    if (!looksLikeJson) {
        const detail = 'name=' + file.name + ' type=' + file.type;
        captureLastImportFailure('wrong-type', 'rejected non-JSON file: ' + detail + ' slug=' + slug + ' role=' + role);
        reportHistoryFailure(
            'HISTORY_IMPORT_E001',
            { slug, role, stage: 'wrong-type', reason: detail },
            '❌ Import failed: expected a .json file (got "' + (file.type || 'unknown type') + '")',
            { toast },
        );
        return false;
    }
    return true;
}

async function writeImportedRevisions(
    slug: string,
    rows: readonly ImportedRevisionInput[],
    deps: HistoryPanelDeps,
    toast: NonNullable<HistoryPanelDeps['toast']>,
): Promise<void> {
    const snapshotResult = await getMaxRevisionId();
    const sinceId = snapshotResult.ok && typeof snapshotResult.value === 'number' ? snapshotResult.value : 0;
    if (!snapshotResult.ok) {
        logHistoryDiagnostic(
            'HISTORY_INTERNAL_E001',
            { stage: 'max-rev-id', reason: 'getMaxRevisionId failed before import: ' + (snapshotResult.error ?? '?') },
        );
    }
    const write = await insertImportedRevisions(slug, rows);
    if (!write.ok) {
        const reason = write.error ?? '?';
        reportHistoryFailure(
            'HISTORY_IMPORT_E002',
            { slug, reason },
            '❌ Import DB write failed: ' + reason,
            { cause: write.error, toast },
        );
        return;
    }
    const count = write.value ?? 0;
    const successMsg = '✓ Imported ' + String(count) + ' revision(s). Reopen History to see them.';
    const undoToast = deps.undoToast ?? showUndoToast;
    if (snapshotResult.ok && count > 0) {
        undoToast(successMsg, async () => {
            const del = await deleteImportedRevisionsAfter(slug, sinceId);
            if (!del.ok) {
                const reason = del.error ?? 'unknown';
                reportHistoryFailure(
                    'HISTORY_UNDO_E001',
                    { slug, undoKind: 'import', reason },
                    '❌ Undo failed: ' + reason,
                    { cause: del.error, toast },
                );
                return;
            }
            toast('↺ Reverted import (' + String(count) + ' row(s) removed)', 'success');
        }, { undoLabel: 'Undo import', timeoutMs: 10_000 });
    } else {
        toast(successMsg, 'success');
    }
}

async function handleImportFile(
    input: HTMLInputElement,
    slug: string,
    role: PromptRole,
    deps: HistoryPanelDeps,
): Promise<void> {
    const file = input.files && input.files[0];
    if (!file) return;
    const toast = deps.toast ?? showToast;
    if (!validateImportFile(file, slug, role, toast)) {
        input.value = '';
        return;
    }
    try {
        const text = await file.text();
        const parsed = parseRevisionImportPayload(text, slug, role);
        if (!parsed.ok || !parsed.rows) {
            const reason = parsed.error ?? 'unknown';
            captureLastImportFailure('parse', 'parse rejected: ' + reason);
            reportHistoryFailure(
                'HISTORY_IMPORT_E001',
                { slug, role, stage: 'parse', reason },
                '❌ Import failed: ' + reason,
                { toast },
            );
            return;
        }
        await writeImportedRevisions(slug, parsed.rows, deps, toast);
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        captureLastImportFailure('thrown', 'threw during read/parse: ' + reason);
        reportHistoryFailure(
            'HISTORY_IMPORT_E001',
            { slug, role, stage: 'thrown', reason },
            '❌ Import failed: ' + reason,
            { cause: err, toast },
        );
    } finally {
        input.value = '';
    }
}
