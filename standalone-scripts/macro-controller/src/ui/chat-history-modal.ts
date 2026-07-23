/**
 * Chat History Modal — plan 13 step 9 (DOM shell).
 *
 * Thin view over the headless service in
 * `../capture/chat-submit-history.ts`. Renders recent chat submissions
 * for the current project, offers a "Copy JSON" export, and lets the
 * user delete individual entries (SQLite row + OPFS blob).
 *
 * Zero direct DB or OPFS access. This module only calls
 * `getProjectHistory`, `exportProjectHistoryAsJson`, and
 * `deleteHistoryEntry`. All failures route through
 * `logError('ChatHistoryModal', ...)`.
 *
 * Follows the same overlay pattern as `about-modal.ts` so the menu
 * feel is consistent.
 */

import { log } from '../logger';
import { logError } from '../error-utils';
import { extractProjectIdFromUrl } from '../workspace-detection';
import {
  getProjectHistory,
  exportProjectHistoryAsJson,
  deleteHistoryEntry,
  type HistoryEntry,
} from '../capture/chat-submit-history';

const SCOPE = 'ChatHistoryModal';
const MODAL_ID = 'macroloop-chat-history-modal';
const STYLES_ID = 'marco-chat-history-styles';
const PREVIEW_MAX_CHARS = 240;

function injectStyles(): void {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = `
    .marco-history-modal {
      background: #1a1a1a; color: #e5e5e5;
      border: 1px solid #333; border-radius: 12px;
      padding: 20px; max-width: 720px; width: 90vw;
      max-height: 80vh; display: flex; flex-direction: column;
      font-family: -apple-system, system-ui, sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    }
    .marco-history-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .marco-history-title { font-size: 16px; font-weight: 600; }
    .marco-history-close { cursor: pointer; opacity: 0.7; font-size: 18px; padding: 0 6px; }
    .marco-history-close:hover { opacity: 1; }
    .marco-history-toolbar { display:flex; gap:8px; margin-bottom:12px; }
    .marco-history-btn { background:#2a2a2a; color:#e5e5e5; border:1px solid #444; border-radius:6px; padding:6px 12px; font-size:12px; cursor:pointer; }
    .marco-history-btn:hover { background:#333; }
    .marco-history-btn-danger { border-color:#663333; }
    .marco-history-list { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
    .marco-history-row { background:#222; border:1px solid #2f2f2f; border-radius:8px; padding:10px 12px; }
    .marco-history-row-head { display:flex; justify-content:space-between; font-size:11px; color:#8a8a8a; margin-bottom:6px; }
    .marco-history-source { color:#8ab4f8; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .marco-history-body { font-size:12.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word; color:#d0d0d0; }
    .marco-history-body-empty { color:#666; font-style:italic; }
    .marco-history-row-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
    .marco-history-empty { padding:32px; text-align:center; color:#888; }
    .marco-history-status { font-size:11px; color:#8a8a8a; margin-top:8px; min-height:14px; }
  `;
  document.head.appendChild(style);
}

function formatTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch { return String(ms); }
}

function previewBody(entry: HistoryEntry): string {
  if (entry.body === null) return '(body unavailable — OPFS read failed or blob was pruned)';
  if (entry.body.length === 0) return '(empty)';
  if (entry.body.length <= PREVIEW_MAX_CHARS) return entry.body;
  return `${entry.body.slice(0, PREVIEW_MAX_CHARS)}…`;
}

function renderRow(entry: HistoryEntry, onDelete: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'marco-history-row';
  row.dataset.entryId = String(entry.id);

  const head = document.createElement('div');
  head.className = 'marco-history-row-head';
  const left = document.createElement('span');
  left.innerHTML = `<span class="marco-history-source">${entry.source}</span> · ${entry.charCount} chars`;
  const right = document.createElement('span');
  right.textContent = formatTimestamp(entry.createdAt);
  head.appendChild(left);
  head.appendChild(right);

  const body = document.createElement('div');
  const bodyText = previewBody(entry);
  body.className = entry.body === null || entry.body === '' ? 'marco-history-body marco-history-body-empty' : 'marco-history-body';
  body.textContent = bodyText;

  const actions = document.createElement('div');
  actions.className = 'marco-history-row-actions';
  const del = document.createElement('button');
  del.className = 'marco-history-btn marco-history-btn-danger';
  del.textContent = 'Delete';
  del.onclick = onDelete;
  actions.appendChild(del);

  row.appendChild(head);
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

async function copyExportToClipboard(projectId: string, statusEl: HTMLElement): Promise<void> {
  try {
    const envelope = await exportProjectHistoryAsJson(projectId);
    const json = JSON.stringify(envelope, null, 2);
    await navigator.clipboard.writeText(json);
    statusEl.textContent = `Copied ${envelope.entryCount} entries to clipboard.`;
    log(`[${SCOPE}] exported ${envelope.entryCount} entries for ${projectId}`, 'info');
  } catch (err) {
    logError(SCOPE, `copyExportToClipboard failed (projectId=${projectId})`, err);
    statusEl.textContent = 'Copy failed — see console.';
  }
}

async function reloadList(projectId: string, listEl: HTMLElement, statusEl: HTMLElement): Promise<void> {
  listEl.innerHTML = '';
  statusEl.textContent = 'Loading…';
  try {
    const entries = await getProjectHistory(projectId);
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'marco-history-empty';
      empty.textContent = 'No chat submissions captured for this project yet.';
      listEl.appendChild(empty);
      statusEl.textContent = '';
      return;
    }
    for (const entry of entries) {
      const row = renderRow(entry, async () => {
        statusEl.textContent = `Deleting entry ${entry.id}…`;
        const r = await deleteHistoryEntry(projectId, entry.id, entry.fileId);
        if (r.isDeleted) {
          row.remove();
          statusEl.textContent = `Deleted entry ${entry.id}.`;
        } else {
          statusEl.textContent = `Delete failed (opfs=${r.opfsRemoved}, row=${r.rowRemoved}).`;
          logError(SCOPE, `deleteHistoryEntry partial failure id=${entry.id} opfs=${r.opfsRemoved} row=${r.rowRemoved}`);
        }
      });
      listEl.appendChild(row);
    }
    statusEl.textContent = `Showing ${entries.length} recent submissions.`;
  } catch (err) {
    logError(SCOPE, `reloadList failed (projectId=${projectId})`, err);
    statusEl.textContent = 'Load failed — see console.';
  }
}

export function showChatHistoryModal(): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) { existing.remove(); return; }

  injectStyles();

  const container = document.createElement('div');
  container.id = MODAL_ID;
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  container.onclick = (e) => { if (e.target === container) container.remove(); };

  const modal = document.createElement('div');
  modal.className = 'marco-history-modal';

  const head = document.createElement('div');
  head.className = 'marco-history-head';
  const title = document.createElement('div');
  title.className = 'marco-history-title';
  title.textContent = '📖 Chat History (this project)';
  const close = document.createElement('span');
  close.className = 'marco-history-close';
  close.textContent = '✕';
  close.onclick = () => container.remove();
  head.appendChild(title);
  head.appendChild(close);

  const toolbar = document.createElement('div');
  toolbar.className = 'marco-history-toolbar';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'marco-history-btn';
  copyBtn.textContent = 'Copy JSON';
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'marco-history-btn';
  refreshBtn.textContent = 'Refresh';
  toolbar.appendChild(copyBtn);
  toolbar.appendChild(refreshBtn);

  const list = document.createElement('div');
  list.className = 'marco-history-list';
  const status = document.createElement('div');
  status.className = 'marco-history-status';

  modal.appendChild(head);
  modal.appendChild(toolbar);
  modal.appendChild(list);
  modal.appendChild(status);
  container.appendChild(modal);
  document.body.appendChild(container);

  const projectId = extractProjectIdFromUrl();
  if (!projectId) {
    status.textContent = 'No Lovable project detected in the current URL.';
    logError(SCOPE, 'showChatHistoryModal: no projectId in URL');
    return;
  }

  copyBtn.onclick = () => { void copyExportToClipboard(projectId, status); };
  refreshBtn.onclick = () => { void reloadList(projectId, list, status); };
  void reloadList(projectId, list, status);
  log(`[${SCOPE}] opened for projectId=${projectId}`, 'info');
}
