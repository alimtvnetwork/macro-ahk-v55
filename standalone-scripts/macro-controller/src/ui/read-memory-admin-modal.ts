/**
 * Read Memory Admin Modal
 *
 * Lightweight admin screen listing every prompt row that looks like a
 * Read Memory variant. Surfaces Slug, Name, IsDefault status, and a
 * one-click "Deactivate" action that flips `IsDefault = 0` and prefixes
 * `Name` with `[duplicate] ` so the row stops surfacing in dropdowns.
 *
 * Entry point: header pill `🛡 Read Memory Admin` in the prompt dropdown.
 * Data path: SQLite `Prompt` table via `sendToExtension('PROJECT_API', ...)`.
 * Cache: IndexedDB `JsonCopy` is invalidated after every deactivate so the
 * dropdown re-materializes from SQLite on next open.
 */

import { sendToExtension } from './extension-relay';
import { log } from '../logger';
import { logDiagnosticFromCode } from '../error-utils';
import { DB_NAME } from '../db/db-name';

const CANONICAL_SLUG = 'read-memory-enhanced';
const DUPLICATE_PREFIX = '[duplicate] ';
const MODAL_ID = 'marco-read-memory-admin-modal';

interface ReadMemoryRow { Id: number; Slug: string; Name: string; IsDefault: number }

function isReadMemoryRow(value: unknown): value is ReadMemoryRow {
  const raw = value as { Id?: unknown; Slug?: unknown; Name?: unknown; IsDefault?: unknown };
  return typeof raw?.Id === 'number' && typeof raw?.Slug === 'string' && typeof raw?.Name === 'string';
}

function coerceRows(rows: readonly unknown[]): ReadMemoryRow[] {
  const out: ReadMemoryRow[] = [];
  for (const raw of rows) {
    if (!isReadMemoryRow(raw)) continue;
    const flag = typeof raw.IsDefault === 'number' ? raw.IsDefault : Number(raw.IsDefault);
    out.push({ Id: raw.Id, Slug: raw.Slug, Name: raw.Name, IsDefault: Number.isFinite(flag) ? flag : 0 });
  }
  return out;
}

async function fetchReadMemoryRows(): Promise<ReadMemoryRow[]> {
  const sql =
    'SELECT Id, Slug, Name, IsDefault FROM Prompt '
    + "WHERE Slug LIKE 'read-memory%' OR Slug LIKE 'rejog%' "
    + "OR Name LIKE 'Read Memory%' OR Name LIKE 'Rejog%' "
    + "OR Name LIKE '" + DUPLICATE_PREFIX + "%' "
    + 'ORDER BY IsDefault DESC, Slug ASC';
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME, method: 'QUERY', endpoint: 'rawSql', params: { sql },
  });
  if (!resp?.isOk || !Array.isArray(resp.rows)) return [];
  return coerceRows(resp.rows as unknown[]);
}

async function invalidateJsonCopy(): Promise<void> {
  try {
    const { clearPromptCache } = await import('./prompt-cache');
    await clearPromptCache();
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'read-memory-admin-cache',
      reason: err instanceof Error ? err.message : String(err),
    }, err);
  }
}

async function deactivateRow(row: ReadMemoryRow): Promise<boolean> {
  const now = Date.now();
  const prefixed = row.Name.startsWith(DUPLICATE_PREFIX)
    ? row.Name
    : DUPLICATE_PREFIX + row.Name;
  const escaped = prefixed.replace(/'/g, "''");
  const sql =
    "UPDATE Prompt SET IsDefault = 0, Name = '" + escaped + "', "
    + 'UpdatedAt = ' + now + ' WHERE Id = ' + row.Id;
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME, method: 'SCHEMA', endpoint: 'rawSql', params: { sql },
  });
  if (!resp?.isOk) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'read-memory-admin-deactivate',
      reason: resp?.errorMessage ?? 'unknown error',
    });
    return false;
  }
  await invalidateJsonCopy();
  return true;
}

function styleCell(cell: HTMLElement, extra = ''): void {
  cell.style.cssText =
    'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.1);'
    + 'font-size:11px;color:#e5e7eb;vertical-align:middle;' + extra;
}

function buildStatusBadge(row: ReadMemoryRow): HTMLElement {
  const badge = document.createElement('span');
  const isCanonical = row.Slug === CANONICAL_SLUG;
  const active = row.IsDefault === 1;
  const label = isCanonical ? 'Canonical' : (active ? 'Active' : 'Disabled');
  const bg = isCanonical ? '#7c3aed' : (active ? '#dc2626' : '#4b5563');
  badge.textContent = label;
  badge.style.cssText =
    'display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;'
    + 'font-weight:600;color:#fff;background:' + bg + ';';
  return badge;
}

function buildDeactivateButton(row: ReadMemoryRow, onDone: () => void): HTMLElement {
  const btn = document.createElement('button');
  const isCanonical = row.Slug === CANONICAL_SLUG;
  const disabled = isCanonical || row.IsDefault === 0;
  btn.type = 'button';
  btn.textContent = disabled ? '—' : 'Deactivate';
  btn.disabled = disabled;
  btn.style.cssText =
    'padding:4px 10px;border-radius:4px;font-size:10px;font-weight:600;'
    + 'border:1px solid rgba(255,255,255,0.15);cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';'
    + 'color:#fff;background:' + (disabled ? 'rgba(75,85,99,0.4)' : '#dc2626') + ';';
  if (isCanonical) btn.title = 'Cannot deactivate the canonical Read Memory prompt';
  btn.onclick = () => { void handleDeactivateClick(row, btn, onDone); };
  return btn;
}

async function handleDeactivateClick(row: ReadMemoryRow, btn: HTMLButtonElement, onDone: () => void): Promise<void> {
  btn.disabled = true;
  btn.textContent = '⏳';
  const ok = await deactivateRow(row);
  if (ok) {
    log('[ReadMemoryAdmin] Deactivated ' + row.Slug + ' (Id=' + row.Id + ')', 'success');
    onDone();
    return;
  }
  btn.disabled = false;
  btn.textContent = 'Retry';
}

function buildTableHeader(): HTMLElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.style.cssText = 'background:rgba(124,58,237,0.25);text-align:left;';
  for (const label of ['Slug', 'Name', 'Status', 'Action']) {
    const th = document.createElement('th');
    th.textContent = label;
    styleCell(th, 'font-weight:700;color:#fff;');
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function appendCell(tr: HTMLElement, content: string | HTMLElement, mono = false): void {
  const td = document.createElement('td');
  styleCell(td, mono ? 'font-family:ui-monospace,monospace;' : '');
  if (typeof content === 'string') td.textContent = content;
  else td.appendChild(content);
  tr.appendChild(td);
}

function buildRow(row: ReadMemoryRow, onDone: () => void): HTMLElement {
  const tr = document.createElement('tr');
  appendCell(tr, row.Slug, true);
  appendCell(tr, row.Name);
  appendCell(tr, buildStatusBadge(row));
  appendCell(tr, buildDeactivateButton(row, onDone));
  return tr;
}

function buildEmptyState(): HTMLElement {
  const empty = document.createElement('div');
  empty.textContent = 'No Read Memory prompts found in the database.';
  empty.style.cssText = 'padding:16px;text-align:center;color:#9ca3af;font-size:12px;';
  return empty;
}

function buildLoadingState(): HTMLElement {
  const loading = document.createElement('div');
  loading.textContent = 'Loading Read Memory prompts…';
  loading.style.cssText = 'padding:16px;text-align:center;color:#9ca3af;font-size:12px;';
  return loading;
}

function buildTable(rows: readonly ReadMemoryRow[], onDone: () => void): HTMLElement {
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;background:transparent;';
  table.appendChild(buildTableHeader());
  const tbody = document.createElement('tbody');
  for (const row of rows) tbody.appendChild(buildRow(row, onDone));
  table.appendChild(tbody);
  return table;
}

function buildHeader(onClose: () => void): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;'
    + 'padding:10px 14px;border-bottom:1px solid rgba(124,58,237,0.4);'
    + 'background:linear-gradient(135deg,#1a0b2e,#2d1b4e);';
  const title = document.createElement('div');
  title.textContent = '🛡 Read Memory Admin';
  title.style.cssText = 'font-size:13px;font-weight:700;color:#fff;';
  const close = document.createElement('span');
  close.textContent = '✕';
  close.style.cssText = 'cursor:pointer;color:#fff;font-size:16px;padding:0 6px;';
  close.onclick = onClose;
  header.appendChild(title);
  header.appendChild(close);
  return header;
}

function buildSubtitle(count: number): HTMLElement {
  const sub = document.createElement('div');
  const canonicalNote = 'The canonical `' + CANONICAL_SLUG + '` slug cannot be deactivated. ';
  sub.textContent = canonicalNote
    + count + ' row(s) matched. Deactivating flips IsDefault=0 and prefixes Name with `' + DUPLICATE_PREFIX + '`.';
  sub.style.cssText = 'padding:8px 14px;font-size:11px;color:#c4b5fd;background:rgba(124,58,237,0.08);';
  return sub;
}

function mountBackdrop(panel: HTMLElement, onClose: () => void): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,0.55);'
    + 'display:flex;align-items:center;justify-content:center;';
  backdrop.onclick = (evt) => { if (evt.target === backdrop) onClose(); };
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  return backdrop;
}

function buildPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'width:min(760px,92vw);max-height:80vh;overflow:auto;'
    + 'background:#0f0620;border:1px solid rgba(124,58,237,0.6);'
    + 'border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.6);color:#e5e7eb;';
  return panel;
}

async function renderBody(panel: HTMLElement, refresh: () => Promise<void>): Promise<void> {
  const body = panel.querySelector<HTMLElement>('[data-role="body"]');
  if (!body) return;
  body.replaceChildren(buildLoadingState());
  const rows = await fetchReadMemoryRows();
  const parts: HTMLElement[] = [buildSubtitle(rows.length)];
  parts.push(rows.length === 0 ? buildEmptyState() : buildTable(rows, () => { void refresh(); }));
  body.replaceChildren(...parts);
}

/** Open the Read Memory admin modal. Idempotent: no-op if already open. */
export async function openReadMemoryAdminModal(): Promise<void> {
  if (document.getElementById(MODAL_ID)) return;
  const panel = buildPanel();
  const close = (): void => { document.getElementById(MODAL_ID)?.remove(); };
  panel.appendChild(buildHeader(close));
  const body = document.createElement('div');
  body.setAttribute('data-role', 'body');
  panel.appendChild(body);
  mountBackdrop(panel, close);
  const refresh = async (): Promise<void> => { await renderBody(panel, refresh); };
  await refresh();
}

export const READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST = MODAL_ID;
export const READ_MEMORY_ADMIN_DUPLICATE_PREFIX_FOR_TEST = DUPLICATE_PREFIX;
export const READ_MEMORY_ADMIN_CANONICAL_SLUG_FOR_TEST = CANONICAL_SLUG;
