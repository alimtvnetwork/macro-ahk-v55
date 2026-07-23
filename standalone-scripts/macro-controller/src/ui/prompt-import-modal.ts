/**
 * Prompts Import modal (plan 12 steps 13-14).
 *
 * Six-stage state machine per SS-04:
 *   idle       -> drop zone, "click to choose" fallback
 *   parsing    -> spinner + filename + detected format
 *   preview    -> table of incoming entries with conflict column (step 14)
 *   committing -> disabled buttons + progress line
 *   done       -> success summary, auto-closes after 1.2 s
 *   error      -> red panel with details, retry link back to `idle`
 *
 * Conflict resolution (step 15) and bulk actions (step 16) plug into the
 * `preview` stage in later versions. This module owns the shell + table
 * so those tickets have somewhere concrete to render.
 *
 * All errors surface with file+function context via `showToast`+ the
 * inline error panel. Nothing is swallowed.
 */

import type { PromptEntry } from '../types/ui-types';
import type { PromptsBundleFormat, PromptsBundleV1 } from './prompt-bundle-types';
import type { CachedPromptEntry } from './prompt-cache';
import type { ImportAuditActionRecord, ImportAuditFormat } from './prompt-import-audit';
import { log } from '../logger';
import { makeUniqueSlug, slugKey } from './prompt-slug-utils';
import { throwDiagnostic } from '../errors/diagnostic-error';

type Stage = 'idle' | 'parsing' | 'preview' | 'committing' | 'done' | 'error';

// Step 15: per-row action, selectable in the preview table.
//   add           = brand-new slug, always inserted
//   overwrite     = conflict, replace the existing cache entry
//   skip          = do nothing (identical rows default here)
//   rename        = import under a unique slug, keep existing untouched
export type RowAction = 'add' | 'overwrite' | 'skip' | 'rename';

export interface PreviewRow {
  slug: string;
  name: string;
  conflict: 'new' | 'update' | 'identical' | 'duplicate';
  action: RowAction;
  incoming: PromptEntry;
}

export type ConflictState = PreviewRow['conflict'];

interface ModalState {
  stage: Stage;
  filename: string;
  format: PromptsBundleFormat | null;
  bundle: PromptsBundleV1 | null;
  rows: PreviewRow[];
  errorMessage: string;
  errorDetails: string;
  errorCode: string;
  errorHint: string;
  errorAuditId: string;
}

interface ModalRefs {
  root: HTMLElement;
  body: HTMLElement;
  primaryBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  onCommit: () => Promise<void>;
}

const MODAL_ATTR = 'data-marco-import-modal';

/* ------------------------------------------------------------------ */
/*  Styling helpers                                                    */
/* ------------------------------------------------------------------ */

function applyStyle(element: HTMLElement, css: string): void {
  element.style.cssText = css;
}

function makeBtn(label: string, variant: 'primary' | 'ghost'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  const base = 'padding:6px 14px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.12);';
  const primary = 'background:rgba(124,58,237,0.85);color:#fff;';
  const ghost = 'background:rgba(255,255,255,0.06);color:#ddd;';
  applyStyle(btn, base + (variant === 'primary' ? primary : ghost));
  return btn;
}

/* ------------------------------------------------------------------ */
/*  Preview table (step 14)                                            */
/* ------------------------------------------------------------------ */

function buildPreviewTable(rows: PreviewRow[], onChange: () => void): HTMLElement {
  const wrap = document.createElement('div');
  applyStyle(wrap, 'max-height:280px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:5px;');
  const table = document.createElement('table');
  applyStyle(table, 'width:100%;border-collapse:collapse;font-size:11px;color:#ddd;');
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr style="background:rgba(124,58,237,0.25);position:sticky;top:0;">'
    + '<th style="text-align:left;padding:6px 8px;">Slug</th>'
    + '<th style="text-align:left;padding:6px 8px;">Name</th>'
    + '<th style="text-align:left;padding:6px 8px;">Conflict</th>'
    + '<th style="text-align:left;padding:6px 8px;">Action</th>'
    + '</tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" style="padding:10px;text-align:center;color:#888;">No entries to import</td>';
    tbody.appendChild(tr);
  }
  rows.forEach((r, i) => tbody.appendChild(buildPreviewRow(r, i, onChange)));
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function conflictBadge(state: PreviewRow['conflict']): string {
  const colors: Record<PreviewRow['conflict'], string> = {
    new: '#22c55e',
    update: '#f59e0b',
    identical: '#6b7280',
    duplicate: '#ef4444',
  };
  const color = colors[state];
  return '<span style="display:inline-block;padding:2px 6px;border-radius:3px;background:' + color
    + ';color:#000;font-weight:700;font-size:10px;">' + state + '</span>';
}

export function defaultActionFor(conflict: PreviewRow['conflict']): RowAction {
  if (conflict === 'new') return 'add';
  if (conflict === 'update') return 'overwrite';
  if (conflict === 'identical') return 'skip';
  return 'skip';
}

export function allowedActionsFor(conflict: PreviewRow['conflict']): RowAction[] {
  // A brand-new slug can only be added (nothing to overwrite) or skipped.
  if (conflict === 'new') return ['add', 'skip'];
  // Everything else has an existing counterpart; user picks the resolution.
  return ['overwrite', 'skip', 'rename'];
}

function actionLabel(action: RowAction): string {
  if (action === 'add') return 'Add';
  if (action === 'overwrite') return 'Overwrite';
  if (action === 'skip') return 'Skip';
  return 'Rename';
}

function buildPreviewRow(row: PreviewRow, index: number, onChange: () => void): HTMLElement {
  const tr = document.createElement('tr');
  const bg = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
  tr.style.cssText = 'background:' + bg + ';border-top:1px solid rgba(255,255,255,0.05);';
  const slugCell = document.createElement('td');
  slugCell.style.cssText = 'padding:5px 8px;font-family:monospace;color:#8ab4f8;';
  slugCell.textContent = row.slug;
  const nameCell = document.createElement('td');
  nameCell.style.cssText = 'padding:5px 8px;';
  nameCell.textContent = row.name;
  const conflictCell = document.createElement('td');
  conflictCell.style.cssText = 'padding:5px 8px;';
  conflictCell.innerHTML = conflictBadge(row.conflict);
  const actionCell = document.createElement('td');
  actionCell.style.cssText = 'padding:5px 8px;';

  const select = document.createElement('select');
  select.style.cssText = 'background:#2a2540;color:#eee;border:1px solid rgba(255,255,255,0.15);border-radius:3px;font-size:10px;padding:2px 4px;cursor:pointer;';
  allowedActionsFor(row.conflict).forEach((act) => {
    const opt = document.createElement('option');
    opt.value = act;
    opt.textContent = actionLabel(act);
    if (act === row.action) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => {
    row.action = select.value as RowAction;
    onChange();
  };
  actionCell.appendChild(select);

  tr.appendChild(slugCell);
  tr.appendChild(nameCell);
  tr.appendChild(conflictCell);
  tr.appendChild(actionCell);
  return tr;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));
}

/* ------------------------------------------------------------------ */
/*  Conflict diff (initial pass; SS-05 will extend in step 15)         */
/*  Step 21: slugKey / makeUniqueSlug moved to prompt-slug-utils.ts.   */
/* ------------------------------------------------------------------ */



function isDeepEqual(a: PromptEntry, b: PromptEntry): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

async function diffAgainstCache(entries: PromptEntry[]): Promise<PreviewRow[]> {
  const cache = await import('./prompt-cache');
  const record = await cache.readJsonCopy();
  const existingList: CachedPromptEntry[] = record && record.entries ? record.entries : [];
  const byKey = new Map<string, CachedPromptEntry>();
  existingList.forEach((e) => byKey.set(slugKey(e), e));
  return entries.map((incoming) => classifyRow(incoming, byKey.get(slugKey(incoming))));
}

export function classifyRow(incoming: PromptEntry, existing: CachedPromptEntry | undefined): PreviewRow {
  const slug = incoming.slug ?? incoming.name;
  const name = incoming.name;
  const conflict: PreviewRow['conflict'] = !existing
    ? 'new'
    : isDeepEqual(incoming, existing as unknown as PromptEntry) ? 'identical' : 'update';
  return { slug, name, conflict, action: defaultActionFor(conflict), incoming };
}

/* ------------------------------------------------------------------ */
/*  Stage renderers                                                    */
/* ------------------------------------------------------------------ */

function renderIdle(body: HTMLElement, onFile: (file: File) => void): void {
  body.innerHTML = '';
  const drop = document.createElement('div');
  applyStyle(drop, 'border:2px dashed rgba(255,255,255,0.18);border-radius:8px;padding:32px;text-align:center;color:#aaa;cursor:pointer;transition:background 0.15s;');
  drop.innerHTML = '<div style="font-size:32px;margin-bottom:8px;">📥</div>'
    + '<div style="font-size:13px;color:#ddd;margin-bottom:4px;">Drop a .json, .zip, or .sqlite file here</div>'
    + '<div style="font-size:11px;color:#888;">or click to choose a file</div>';
  drop.ondragover = (ev) => { ev.preventDefault(); drop.style.background = 'rgba(124,58,237,0.12)'; };
  drop.ondragleave = () => { drop.style.background = 'transparent'; };
  drop.ondrop = (ev) => {
    ev.preventDefault();
    drop.style.background = 'transparent';
    const file = ev.dataTransfer && ev.dataTransfer.files[0];
    if (file) onFile(file);
  };
  drop.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,.sqlite,.db';
    input.onchange = () => { const f = input.files && input.files[0]; if (f) onFile(f); };
    input.click();
  };
  body.appendChild(drop);
}

function renderParsing(body: HTMLElement, filename: string): void {
  body.innerHTML = '';
  const box = document.createElement('div');
  applyStyle(box, 'padding:32px;text-align:center;color:#ddd;');
  box.innerHTML = '<div style="font-size:24px;margin-bottom:8px;">⏳</div>'
    + '<div style="font-size:12px;">Parsing <b>' + escapeHtml(filename) + '</b>…</div>';
  body.appendChild(box);
}

function renderPreview(body: HTMLElement, state: ModalState, rerender: () => void): void {
  body.innerHTML = '';
  const header = document.createElement('div');
  applyStyle(header, 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:11px;color:#bbb;');
  const format = state.format ?? 'json';
  const counts = countByAction(state.rows);
  header.innerHTML = '<span>Format: <b style="color:#fff;">' + format.toUpperCase() + '</b> &middot; Source: <b style="color:#fff;">'
    + escapeHtml(state.filename) + '</b></span>'
    + '<span>' + state.rows.length + ' entries &middot; '
    + '<span style="color:#22c55e;">+' + counts.add + '</span> / '
    + '<span style="color:#f59e0b;">~' + counts.overwrite + '</span> / '
    + '<span style="color:#a78bfa;">R' + counts.rename + '</span> / '
    + '<span style="color:#6b7280;">S' + counts.skip + '</span></span>';
  body.appendChild(header);

  // Step 16: bulk conflict actions.
  const bulk = buildBulkActionsBar(state.rows, rerender);
  body.appendChild(bulk);

  body.appendChild(buildPreviewTable(state.rows, rerender));
}

function countByAction(rows: PreviewRow[]): { add: number; overwrite: number; skip: number; rename: number } {
  const c = { add: 0, overwrite: 0, skip: 0, rename: 0 };
  rows.forEach((r) => { c[r.action] += 1; });
  return c;
}

function buildBulkActionsBar(rows: PreviewRow[], onChange: () => void): HTMLElement {
  const bar = document.createElement('div');
  applyStyle(bar, 'display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:10px;color:#888;');
  const label = document.createElement('span');
  label.textContent = 'Bulk for conflicts:';
  bar.appendChild(label);

  const mkBtn = (text: string, action: RowAction): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    applyStyle(b, 'padding:3px 8px;border-radius:3px;font-size:10px;font-weight:600;cursor:pointer;'
      + 'border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#ddd;');
    b.onclick = () => {
      rows.forEach((r) => {
        if (r.conflict === 'new') return; // "new" is not a conflict; leave alone
        if (allowedActionsFor(r.conflict).indexOf(action) !== -1) r.action = action;
      });
      onChange();
    };
    return b;
  };

  bar.appendChild(mkBtn('Overwrite all', 'overwrite'));
  bar.appendChild(mkBtn('Skip all', 'skip'));
  bar.appendChild(mkBtn('Rename all', 'rename'));
  return bar;
}

function renderCommitting(body: HTMLElement, count: number): void {
  body.innerHTML = '';
  const box = document.createElement('div');
  applyStyle(box, 'padding:32px;text-align:center;color:#ddd;');
  box.innerHTML = '<div style="font-size:24px;margin-bottom:8px;">📝</div>'
    + '<div style="font-size:12px;">Importing ' + count + ' prompts…</div>';
  body.appendChild(box);
}

function renderDone(body: HTMLElement, added: number, updated: number): void {
  body.innerHTML = '';
  const box = document.createElement('div');
  applyStyle(box, 'padding:32px;text-align:center;color:#22c55e;');
  box.innerHTML = '<div style="font-size:32px;margin-bottom:8px;">✅</div>'
    + '<div style="font-size:13px;color:#ddd;">Imported <b>' + added + '</b> new, <b>' + updated + '</b> updated</div>';
  body.appendChild(box);
}

interface RenderErrorInput {
  message: string;
  details: string;
  code: string;
  hint: string;
  auditId: string;
  onRetry: () => void;
  onViewAudit: () => void;
}

function renderError(body: HTMLElement, input: RenderErrorInput): void {
  body.innerHTML = '';
  const panel = document.createElement('div');
  applyStyle(panel, 'border:1px solid #ef4444;background:rgba(239,68,68,0.08);border-radius:6px;padding:12px;color:#fecaca;');

  // Code badge + heading row.
  const headRow = document.createElement('div');
  applyStyle(headRow, 'display:flex;align-items:center;gap:8px;margin-bottom:6px;');
  if (input.code) {
    const badge = document.createElement('span');
    applyStyle(badge, 'font-family:monospace;font-size:10px;font-weight:700;background:#7f1d1d;color:#fecaca;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;');
    badge.textContent = input.code;
    headRow.appendChild(badge);
  }
  const heading = document.createElement('div');
  applyStyle(heading, 'font-weight:700;');
  heading.textContent = 'Import failed: ' + input.message;
  headRow.appendChild(heading);
  panel.appendChild(headRow);

  // Actionable hint (short, plain-language).
  if (input.hint) {
    const hintEl = document.createElement('div');
    applyStyle(hintEl, 'font-size:11px;color:#fde68a;margin-bottom:8px;');
    hintEl.textContent = input.hint;
    panel.appendChild(hintEl);
  }

  // Details block (raw error).
  if (input.details) {
    const detailsEl = document.createElement('pre');
    applyStyle(detailsEl, 'font-family:monospace;font-size:10px;color:#fca5a5;margin:0;white-space:pre-wrap;max-height:150px;overflow:auto;');
    detailsEl.textContent = input.details;
    panel.appendChild(detailsEl);
  }

  // Action row: retry + audit deep-link.
  const actions = document.createElement('div');
  applyStyle(actions, 'display:flex;gap:12px;align-items:center;margin-top:8px;');
  const retry = document.createElement('a');
  applyStyle(retry, 'color:#93c5fd;cursor:pointer;font-size:11px;');
  retry.textContent = 'Try another file';
  retry.onclick = (ev) => { ev.preventDefault(); input.onRetry(); };
  actions.appendChild(retry);

  if (input.auditId) {
    const audit = document.createElement('a');
    applyStyle(audit, 'color:#93c5fd;cursor:pointer;font-size:11px;font-family:monospace;');
    audit.textContent = 'View audit entry (' + input.auditId.slice(0, 24) + '...)';
    audit.title = 'Audit id: ' + input.auditId;
    audit.onclick = (ev) => { ev.preventDefault(); input.onViewAudit(); };
    actions.appendChild(audit);
  }
  panel.appendChild(actions);

  body.appendChild(panel);
}

/* ------------------------------------------------------------------ */
/*  Modal shell                                                        */
/* ------------------------------------------------------------------ */

function buildShell(onClose: () => void): { root: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  const overlay = document.createElement('div');
  overlay.setAttribute(MODAL_ATTR, '1');
  applyStyle(overlay, 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;');
  overlay.onclick = (ev) => { if (ev.target === overlay) onClose(); };

  const panel = document.createElement('div');
  applyStyle(panel, 'width:640px;max-width:92vw;background:#1e1b2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.7);color:#eee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;');

  const header = document.createElement('div');
  applyStyle(header, 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);');
  const title = document.createElement('div');
  title.textContent = 'Import Prompts';
  applyStyle(title, 'font-weight:700;font-size:14px;');
  const close = document.createElement('span');
  close.textContent = '×';
  applyStyle(close, 'cursor:pointer;font-size:20px;color:#aaa;');
  close.onclick = onClose;
  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement('div');
  applyStyle(body, 'padding:16px;min-height:180px;');

  const footer = document.createElement('div');
  applyStyle(footer, 'display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08);');

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  return { root: overlay, body, footer };
}

/* ------------------------------------------------------------------ */
/*  Orchestration                                                      */
/* ------------------------------------------------------------------ */

export interface ImportModalDeps {
  onCommitted: () => Promise<void>;
}

interface BucketedRows {
  toImport: CachedPromptEntry[];
  auditActions: ImportAuditActionRecord[];
  renamedCount: number;
  skippedCount: number;
}

function bucketPreviewRows(
  rows: ModalState['rows'],
  existingKeys: Set<string>,
  validate: (entry: unknown) => CachedPromptEntry | null,
): BucketedRows {
  const toImport: CachedPromptEntry[] = [];
  const auditActions: ImportAuditActionRecord[] = [];
  let renamedCount = 0;
  let skippedCount = 0;
  rows.forEach((row) => {
    if (row.action === 'skip') {
      skippedCount += 1;
      auditActions.push({ slug: row.slug, action: 'skip' });
      return;
    }
    const validated = validate(row.incoming);
    if (!validated) {
      skippedCount += 1;
      auditActions.push({ slug: row.slug, action: 'skip' });
      return;
    }
    if (row.action === 'rename') {
      const baseSlug = validated.slug || validated.name;
      const uniqueSlug = makeUniqueSlug(baseSlug, existingKeys);
      existingKeys.add(uniqueSlug.toLowerCase());
      toImport.push({ ...validated, slug: uniqueSlug });
      renamedCount += 1;
      auditActions.push({ slug: row.slug, action: 'rename', renamedTo: uniqueSlug });
      return;
    }
    toImport.push(validated);
    auditActions.push({ slug: row.slug, action: row.action });
  });
  return { toImport, auditActions, renamedCount, skippedCount };
}

async function handleCommitError(err: unknown, state: ModalState): Promise<void> {
  const errors = await import('./prompt-import-errors');
  const asCommit = err instanceof errors.ImportCommitError ? err : null;
  const classified = asCommit
    ? { code: asCommit.code, message: asCommit.message, hint: asCommit.hint }
    : (() => {
        const c = errors.classifyImportError(err, 'commit');
        return { code: c.code, message: c.message, hint: c.hint };
      })();
  state.errorMessage = 'Commit failed (changes rolled back)';
  state.errorDetails = err instanceof Error && err.stack ? err.stack : String(err);
  state.errorCode = classified.code;
  state.errorHint = classified.hint;
  state.errorAuditId = asCommit ? asCommit.auditId : '';
  errors.logStructured({
    namespace: 'ImportModal', code: classified.code, level: 'error',
    fields: { auditId: state.errorAuditId, phase: 'commit', message: classified.message },
  });
}

async function performImportCommit(
  state: ModalState,
  refs: ModalRefs,
  deps: ImportModalDeps,
  transition: (next: Stage) => void,
  close: () => void,
): Promise<void> {
  if (!state.bundle) return;
  transition('committing');
  try {
    const io = await import('./prompt-io');
    const cache = await import('./prompt-cache');
    const commitMod = await import('./prompt-import-commit');
    const existing = (await cache.readJsonCopy())?.entries ?? [];
    const existingKeys = new Set<string>(existing.map((e) => (e.slug || e.name).toLowerCase()));
    const bucketed = bucketPreviewRows(state.rows, existingKeys, io.validatePromptEntry);
    const outcome = await commitMod.commitPromptImportAtomic({
      entries: bucketed.toImport,
      actions: bucketed.auditActions,
      filename: state.filename,
      format: (state.format ?? 'json') as ImportAuditFormat,
      skippedCount: bucketed.skippedCount,
      renamedCount: bucketed.renamedCount,
    });
    log('[ImportModal] Committed auditId=' + outcome.auditId
      + ' added=' + outcome.counts.added
      + ' updated=' + outcome.counts.updated
      + ' renamed=' + outcome.counts.renamed
      + ' skipped=' + outcome.counts.skipped, 'info');
    renderDone(refs.body, outcome.counts.added, outcome.counts.updated);
    state.stage = 'done';
    refs.primaryBtn.style.display = 'none';
    refs.cancelBtn.textContent = 'Close';
    await deps.onCommitted();
    setTimeout(close, 1200);
  } catch (err) {
    await handleCommitError(err, state);
    transition('error');
  }
}

export function openPromptImportModal(deps: ImportModalDeps): void {
  const existing = document.querySelector('[' + MODAL_ATTR + ']');
  if (existing) existing.remove();

  const state: ModalState = {
    stage: 'idle', filename: '', format: null, bundle: null, rows: [],
    errorMessage: '', errorDetails: '', errorCode: '', errorHint: '', errorAuditId: '',
  };

  const close = (): void => { refs.root.remove(); };
  const { root, body, footer } = buildShell(close);
  const cancelBtn = makeBtn('Cancel', 'ghost');
  const primaryBtn = makeBtn('Import', 'primary');
  cancelBtn.onclick = close;
  footer.appendChild(cancelBtn);
  footer.appendChild(primaryBtn);

  const refs: ModalRefs = { root, body, primaryBtn, cancelBtn, onCommit: async () => { /* set below */ } };
  const rerender = (): void => renderStage(state, refs, deps, transition);
  const transition = (next: Stage): void => { state.stage = next; rerender(); };
  refs.onCommit = () => performImportCommit(state, refs, deps, transition, close);

  document.body.appendChild(root);
  rerender();
}


function renderStage(state: ModalState, refs: ModalRefs, deps: ImportModalDeps, transition: (next: Stage) => void): void {
  const { body, primaryBtn, cancelBtn } = refs;
  primaryBtn.style.display = '';
  cancelBtn.textContent = 'Cancel';
  primaryBtn.disabled = false;
  cancelBtn.disabled = false;

  if (state.stage === 'idle') {
    primaryBtn.style.display = 'none';
    renderIdle(body, (file) => void startParse(file, state, refs, deps, transition));
    return;
  }
  if (state.stage === 'parsing') {
    primaryBtn.disabled = true;
    renderParsing(body, state.filename);
    return;
  }
  if (state.stage === 'preview') {
    const importCount = state.rows.filter((r) => r.action !== 'skip').length;
    primaryBtn.textContent = 'Import ' + importCount;
    primaryBtn.disabled = importCount === 0;
    primaryBtn.onclick = () => void refs.onCommit();
    renderPreview(body, state, () => renderStage(state, refs, deps, transition));
    return;
  }
  if (state.stage === 'committing') {
    primaryBtn.disabled = true;
    cancelBtn.disabled = true;
    renderCommitting(body, state.rows.length);
    return;
  }
  if (state.stage === 'error') {
    primaryBtn.style.display = 'none';
    renderError(body, {
      message: state.errorMessage,
      details: state.errorDetails,
      code: state.errorCode,
      hint: state.errorHint,
      auditId: state.errorAuditId,
      onRetry: () => transition('idle'),
      onViewAudit: () => {
        // Deep-link: dump the audit entry to the console so power users
        // can inspect. Step 27's E2E asserts on this log line.
        void import('./prompt-import-audit').then((mod) => {
          const entry = mod.readImportAudit().find((e) => e.id === state.errorAuditId);
          void import('./prompt-import-errors').then((errMod) => {
            errMod.logStructured({
              namespace: 'ImportModal', code: 'AUDIT_ENTRY_VIEW', level: 'info',
              fields: {
                auditId: state.errorAuditId,
                found: !!entry,
                status: entry?.status,
                actions: entry ? entry.actions.length : 0,
              },
            });
            if (entry) console.log('[ImportModal] Audit entry:', entry);
          });
        });
      },
    });
    return;
  }
}

async function startParse(
  file: File,
  state: ModalState,
  _refs: ModalRefs,
  _deps: ImportModalDeps,
  transition: (next: Stage) => void,
): Promise<void> {
  state.filename = file.name;
  transition('parsing');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detector = await import('./prompt-io-format-detect');
    const detection = detector.detectBundleFormat(bytes);
    state.format = detection.format;
    const bundle = await parseByFormat(bytes, detection.format);
    state.bundle = bundle;
    state.rows = await diffAgainstCache(bundle.entries);
    transition('preview');
  } catch (err) {
    const errors = await import('./prompt-import-errors');
    const classified = errors.classifyImportError(err, 'parse');
    state.errorMessage = 'Failed to parse file';
    state.errorDetails = err instanceof Error && err.stack ? err.stack : String(err);
    state.errorCode = classified.code;
    state.errorHint = classified.hint;
    state.errorAuditId = '';
    errors.logStructured({
      namespace: 'ImportModal', code: classified.code, level: 'error',
      fields: { phase: 'parse', filename: file.name, message: classified.message },
    });
    transition('error');
  }
}

async function parseByFormat(bytes: Uint8Array, format: PromptsBundleFormat): Promise<PromptsBundleV1> {
  if (format === 'zip') {
    const reader = await import('./prompt-io-zip-reader');
    return reader.parsePromptsBundleZip(bytes).bundle;
  }
  if (format === 'sqlite') {
    const reader = await import('./prompt-io-sqlite-reader');
    return (await reader.parsePromptsBundleSqlite(bytes)).bundle;
  }
  const bundleTypes = await import('./prompt-bundle-types');
  const text = new TextDecoder('utf-8').decode(bytes);
  const raw = JSON.parse(text) as unknown;
  const isEnvelope = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    && 'schemaVersion' in (raw as Record<string, unknown>);
  if (isEnvelope) {
    const result = bundleTypes.validatePromptsBundle(raw);
    if (!result.isValid || !result.bundle) throwDiagnostic('PROMPT_IO_ENVELOPE_E001', { errorList: result.errors.join('; ') });
    return result.bundle;
  }
  // Legacy bare-array JSON — synthesize an envelope.
  const items = Array.isArray(raw) ? raw : [raw];
  const io = await import('./prompt-io');
  const entries = items
    .map((item) => io.validatePromptEntry(item))
    .filter((e): e is CachedPromptEntry => e !== null) as unknown as PromptEntry[];
  return bundleTypes.buildPromptsBundle(entries, '0.0.0', { format: 'json', includeExcluded: true });
}
