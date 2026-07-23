/**
 * Prompt Dropdown IO helpers (Plan-17 steps 23 & 24)
 *
 * Extracted from `ui/prompt-dropdown.ts` to keep that file under the
 * standalone-scripts 500-line guideline. Hosts the Export / Import pill
 * builders plus their internal parser dispatchers.
 *
 * The Import path needs to re-run `renderPromptsDropdown` after a
 * successful import. Rather than importing back into `prompt-dropdown.ts`
 * (which would form a cycle picked up by our madge preflight), callers
 * pass a `rerender` callback that closes over their own `ctx` +
 * `taskNextDeps`.
 */

import type { PromptContext } from './prompt-loader';
import type { TaskNextDeps } from './task-next-ui';
import type { CachedPromptEntry } from './prompt-cache';
import {
  clearLoadedPrompts,
  loadPromptsFromJson,
} from './prompt-loader';
import { clearUISnapshot } from './prompt-cache';
import { showPasteToast } from './prompt-utils';
import { dispatchPromptsChanged } from './prompts-changed-event';

export type Rerender = () => void;

/**
 * Shape returned by `readUserAddedEntries()`. `entries` is ALWAYS present
 * (never optional / undefined) so callers can destructure without a guard.
 * `defaultsSkipped` is always a finite non-negative integer.
 */
export interface UserAddedEntriesState {
  entries: CachedPromptEntry[];
  defaultsSkipped: number;
}

function validateUserAddedEntriesState(raw: {
  kept?: CachedPromptEntry[];
  defaultsSkipped?: number;
}): UserAddedEntriesState {
  const entries = Array.isArray(raw.kept) ? raw.kept : [];
  const skipped = Number.isFinite(raw.defaultsSkipped) && (raw.defaultsSkipped as number) >= 0
    ? (raw.defaultsSkipped as number)
    : 0;
  return { entries, defaultsSkipped: skipped };
}

/** Small pill button used for Export / Import in the dropdown header. */
export function buildHeaderPill(label: string, title: string, onClick: (e: Event) => void): HTMLElement {
  const pill = document.createElement('span');
  pill.textContent = label;
  pill.title = title;
  pill.style.cssText = 'cursor:pointer;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;color:#fff;background:rgba(124,58,237,0.55);border:1px solid rgba(255,255,255,0.1);';
  pill.onmouseover = function() { pill.style.background = 'rgba(124,58,237,0.85)'; };
  pill.onmouseout = function() { pill.style.background = 'rgba(124,58,237,0.55)'; };
  pill.onclick = onClick;
  return pill;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(function() { anchor.remove(); URL.revokeObjectURL(url); }, 100);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * v4.400.0: ZIP + SQLite export share the same "user-added only" scope as
 * the JSON path in `exportPromptsToJson`. Defaults are managed by re-seed
 * and never appear in an export blob.
 */
async function readUserAddedEntries(): Promise<{ entries: CachedPromptEntry[]; defaultsSkipped: number }> {
  const io = await import('./prompt-io');
  const raw = await io.collectAllExportEntries();
  const { kept, defaultsSkipped } = io.filterUserAddedEntries(raw);
  return { entries: kept, defaultsSkipped };
}

async function exportAsJson(): Promise<void> {
  const io = await import('./prompt-io');
  await io.exportPromptsToJson();
}

async function exportAsZip(): Promise<void> {
  const { entries, defaultsSkipped } = await readUserAddedEntries();
  if (entries.length === 0) { showPasteToast('No user prompts to export', true); return; }
  const zip = await import('./prompt-io-zip');
  const state = await import('../shared-state');
  const result = zip.buildPromptsZip(entries, state.VERSION);
  triggerDownload(result.blob, 'prompts-export-' + todayIso() + '.zip');
  const suffix = defaultsSkipped > 0 ? ' (' + defaultsSkipped + ' defaults skipped)' : '';
  showPasteToast('📦 Exported ' + result.bundle.entryCount + ' user prompts to ZIP' + suffix, false);
}

async function exportAsSqlite(): Promise<void> {
  const { entries, defaultsSkipped } = await readUserAddedEntries();
  if (entries.length === 0) { showPasteToast('No user prompts to export', true); return; }
  const sqlite = await import('./prompt-io-sqlite');
  const state = await import('../shared-state');
  const result = await sqlite.buildPromptsSqlite(entries, state.VERSION);
  const blob = new Blob([result.bytes as BlobPart], { type: 'application/vnd.sqlite3' });
  triggerDownload(blob, 'prompts-export-' + todayIso() + '.sqlite');
  const suffix = defaultsSkipped > 0 ? ' (' + defaultsSkipped + ' defaults skipped)' : '';
  showPasteToast('🗄️ Exported ' + result.bundle.entryCount + ' user prompts to SQLite' + suffix, false);
}

function makeExportOption(pop: HTMLElement, label: string, run: () => Promise<void>): HTMLElement {
  const option = document.createElement('span');
  option.textContent = label;
  option.style.cssText = 'cursor:pointer;padding:5px 12px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:rgba(124,58,237,0.55);white-space:nowrap;';
  option.onmouseover = function() { option.style.background = 'rgba(124,58,237,0.85)'; };
  option.onmouseout = function() { option.style.background = 'rgba(124,58,237,0.55)'; };
  option.onclick = function(ev) {
    ev.stopPropagation();
    pop.remove();
    run().catch(function(err: unknown) {
      showPasteToast('❌ Export failed: ' + String(err), true);
    });
  };
  return option;
}

function buildExportPopover(anchor: HTMLElement): HTMLElement {
  const pop = document.createElement('div');
  pop.setAttribute('data-marco-export-popover', '1');
  pop.style.cssText = 'position:absolute;z-index:2147483647;display:flex;flex-direction:column;gap:4px;padding:6px;background:#1e1b2e;border:1px solid rgba(255,255,255,0.15);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
  const rect = anchor.getBoundingClientRect();
  pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (rect.left + window.scrollX) + 'px';
  pop.appendChild(makeExportOption(pop, '📄 JSON file', exportAsJson));
  pop.appendChild(makeExportOption(pop, '📦 ZIP bundle', exportAsZip));
  pop.appendChild(makeExportOption(pop, '🗄️ SQLite DB', exportAsSqlite));
  return pop;
}

function attachPopoverToggle(
  e: Event,
  popoverSelector: string,
  buildPopover: (anchor: HTMLElement) => HTMLElement,
): void {
  e.stopPropagation();
  const target = e.currentTarget as HTMLElement;
  const existing = document.querySelector(popoverSelector);
  if (existing) { existing.remove(); return; }
  const pop = buildPopover(target);
  document.body.appendChild(pop);
  const dismiss = function(ev: Event): void {
    if (pop.contains(ev.target as Node)) return;
    pop.remove();
    document.removeEventListener('click', dismiss, true);
  };
  setTimeout(function() { document.addEventListener('click', dismiss, true); }, 0);
}

/** Export pill: opens a three-option popover (JSON / ZIP / SQLite). */
export function buildExportButton(): HTMLElement {
  return buildHeaderPill('📤 Export', 'Export user-added prompts (JSON, ZIP, or SQLite). Defaults are managed by re-seed and never included.', function(e: Event) {
    attachPopoverToggle(e, '[data-marco-export-popover]', buildExportPopover);
  });
}

/** Import pill: opens the six-stage import modal. */
export function buildImportButton(_ctx: PromptContext, _taskNextDeps: TaskNextDeps, rerender: Rerender): HTMLElement {
  return buildHeaderPill('📥 Import', 'Import user-added prompts (JSON, ZIP, or SQLite). Default prompts are protected and never overwritten.', function(e: Event) {
    e.stopPropagation();
    void import('./prompt-import-modal').then((mod) => {
      mod.openPromptImportModal({
        onCommitted: async () => {
          clearLoadedPrompts();
          clearUISnapshot();
          await loadPromptsFromJson();
          rerender();
          dispatchPromptsChanged({ reason: 'import-commit' });
        },
      });
    }).catch((err: unknown) => {
      showPasteToast('❌ Import modal failed to open: ' + String(err), true);
    });
  });
}

/**
 * v4.402.0: Consolidated single-button Import / Export surface.
 *
 * Replaces the three separate header pills (📤 Export, 📥 Import, 📥 IO) with
 * a single dropdown popover. Keeps every existing path reachable — the
 * legacy pills stay exported for tests and for downstream code that opens
 * them directly — but the user-facing header now shows one entry point.
 */
function makeIoSectionHeader(text: string): HTMLElement {
  const h = document.createElement('div');
  h.textContent = text;
  h.style.cssText = 'font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#c4b5fd;padding:2px 6px;margin-top:2px;';
  return h;
}

function makeIoOptionRow(pop: HTMLElement, label: string, run: () => Promise<void> | void): HTMLElement {
  const row = document.createElement('span');
  row.textContent = label;
  row.style.cssText = 'cursor:pointer;padding:5px 12px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:rgba(124,58,237,0.55);white-space:nowrap;';
  row.onmouseover = function() { row.style.background = 'rgba(124,58,237,0.85)'; };
  row.onmouseout = function() { row.style.background = 'rgba(124,58,237,0.55)'; };
  row.onclick = function(ev) {
    ev.stopPropagation();
    pop.remove();
    try {
      const r = run();
      if (r && typeof (r as Promise<void>).catch === 'function') {
        (r as Promise<void>).catch(function(err: unknown) {
          showPasteToast('❌ ' + label + ' failed: ' + String(err), true);
        });
      }
    } catch (err) {
      showPasteToast('❌ ' + label + ' failed: ' + String(err), true);
    }
  };
  return row;
}

function openImportModalFromPill(rerender: Rerender): void {
  void import('./prompt-import-modal').then((mod) => {
    mod.openPromptImportModal({
      onCommitted: async () => {
        clearLoadedPrompts();
        clearUISnapshot();
        await loadPromptsFromJson();
        rerender();
        dispatchPromptsChanged({ reason: 'import-commit' });
      },
    });
  }).catch((err: unknown) => {
    showPasteToast('❌ Import modal failed to open: ' + String(err), true);
  });
}

function openLegacyIoDialog(): void {
  void import('./prompt-io-dialog').then(function(mod) {
    (mod as { renderPromptIODialog: () => void }).renderPromptIODialog();
  }).catch(function(err: unknown) {
    showPasteToast('❌ IO dialog failed to open: ' + String(err), true);
  });
}

function buildImportExportPopover(anchor: HTMLElement, rerender: Rerender): HTMLElement {
  const pop = document.createElement('div');
  pop.setAttribute('data-marco-io-popover', '1');
  pop.style.cssText = 'position:absolute;z-index:2147483647;display:flex;flex-direction:column;gap:3px;padding:6px;background:#1e1b2e;border:1px solid rgba(255,255,255,0.15);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.6);min-width:180px;';
  const rect = anchor.getBoundingClientRect();
  pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (rect.left + window.scrollX) + 'px';

  pop.appendChild(makeIoSectionHeader('Export (user prompts)'));
  pop.appendChild(makeIoOptionRow(pop, '📄 JSON file', exportAsJson));
  pop.appendChild(makeIoOptionRow(pop, '📦 ZIP bundle', exportAsZip));
  pop.appendChild(makeIoOptionRow(pop, '🗄️ SQLite DB', exportAsSqlite));

  pop.appendChild(makeIoSectionHeader('Import'));
  pop.appendChild(makeIoOptionRow(pop, '📥 Import file…', function() { openImportModalFromPill(rerender); }));
  pop.appendChild(makeIoOptionRow(pop, '🛠 Advanced IO dialog', openLegacyIoDialog));
  return pop;
}

/**
 * Single consolidated "Prompts I/O" pill. Replaces the three separate header
 * pills (Export / Import / IO) with a submenu so the header is not cluttered.
 */
export function buildImportExportButton(rerender: Rerender): HTMLElement {
  return buildHeaderPill(
    '📤 Prompts I/O ▾',
    'Import or export prompts. Defaults are managed by re-seed and never included in exports; imports never overwrite defaults.',
    function(e: Event) {
      attachPopoverToggle(e, '[data-marco-io-popover]', function(anchor) {
        return buildImportExportPopover(anchor, rerender);
      });
    },
  );
}

async function finalizeImport(valid: CachedPromptEntry[], label: string, rerender: Rerender): Promise<void> {
  if (valid.length === 0) { showPasteToast('❌ ' + label + ' contained no valid entries', true); return; }
  const io = await import('./prompt-io');
  const results = await io.performPromptImport(valid, { overwrite: true });
  showPasteToast(label + ': ' + results.added + ' new, ' + results.updated + ' updated', false);
  clearLoadedPrompts();
  clearUISnapshot();
  await loadPromptsFromJson();
  rerender();
}

async function runZipImport(bytes: Uint8Array, rerender: Rerender): Promise<void> {
  const reader = await import('./prompt-io-zip-reader');
  const parsed = reader.parsePromptsBundleZip(bytes);
  const io = await import('./prompt-io');
  const valid = parsed.bundle.entries.map((entry) => io.validatePromptEntry(entry)).filter((entry): entry is CachedPromptEntry => entry !== null);
  await finalizeImport(valid, '📦 ZIP imported', rerender);
}

async function runSqliteImport(bytes: Uint8Array, rerender: Rerender): Promise<void> {
  const reader = await import('./prompt-io-sqlite-reader');
  const parsed = await reader.parsePromptsBundleSqlite(bytes);
  const io = await import('./prompt-io');
  const valid = parsed.bundle.entries.map((entry) => io.validatePromptEntry(entry)).filter((entry): entry is CachedPromptEntry => entry !== null);
  await finalizeImport(valid, '🗄️ SQLite imported', rerender);
}

async function runPromptImport(text: string, rerender: Rerender): Promise<void> {
  try {
    const io = await import('./prompt-io');
    const parsed = (io as { parsePromptsText: (t: string) => { valid: CachedPromptEntry[]; errors: string[] } }).parsePromptsText(text);
    if (parsed.errors.length && parsed.valid.length === 0) {
      showPasteToast('❌ Import failed: ' + parsed.errors[0], true);
      return;
    }
    const results = await (io as { performPromptImport: (p: CachedPromptEntry[], o?: { overwrite?: boolean }) => Promise<{ added: number; updated: number }> })
      .performPromptImport(parsed.valid, { overwrite: true });
    showPasteToast('📥 Imported: ' + results.added + ' new, ' + results.updated + ' updated', false);
    clearLoadedPrompts();
    clearUISnapshot();
    await loadPromptsFromJson();
    rerender();
  } catch (err) {
    showPasteToast('❌ Import failed: ' + String(err), true);
  }
}

/** Route the picked file to the correct parser by extension. */
export async function dispatchImportFile(file: File, rerender: Rerender): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detector = await import('./prompt-io-format-detect');
    const detection = detector.detectBundleFormat(bytes);
    if (detection.format === 'zip') { await runZipImport(bytes, rerender); return; }
    if (detection.format === 'sqlite') { await runSqliteImport(bytes, rerender); return; }
    const text = new TextDecoder('utf-8').decode(bytes);
    await runPromptImport(text, rerender);
  } catch (err) {
    showPasteToast('❌ Import failed: ' + String(err), true);
  }
}
