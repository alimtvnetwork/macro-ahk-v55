/**
 * Project History Panel — plan 13 step 9 (DOM shell).
 *
 * Renders the "Project history" section for a single project:
 *   - Header line with total row count for the project.
 *   - Latest N entries (default 20) with source badge, timestamp,
 *     char count, and single-line preview of the captured text.
 *   - Per-row "Open" (expand preview) and "Delete" actions.
 *   - "Export JSON" button that reuses the plan-13 history service
 *     (`exportProjectHistoryAsJson`) and streams the envelope as a
 *     download via Blob + object URL.
 *
 * Headless service (data + delete + export) lives in
 * `capture/chat-submit-history.ts`. This module is deliberately DOM-
 * only so the two layers stay independently testable.
 *
 * Error handling: every service call is guarded and routes through
 * `logError('ProjectHistoryPanel', ...)`. The panel never swallows
 * failures silently — a status line surfaces the last error and the
 * caller can inspect it via the returned handle.
 */

import { logError } from '../error-utils';
import {
  getProjectHistory,
  exportProjectHistoryAsJson,
  deleteHistoryEntry,
  type HistoryEntry,
  type HistoryExport,
  type DeleteHistoryResult,
} from '../capture/chat-submit-history';

const SCOPE = 'ProjectHistoryPanel';
const DEFAULT_ROW_LIMIT = 20;

export interface ProjectHistoryPanelDeps {
  loadHistory?: (projectId: string, limit: number) => Promise<HistoryEntry[]>;
  exportHistory?: (projectId: string) => Promise<HistoryExport>;
  deleteEntry?: (projectId: string, id: number, fileId: string) => Promise<DeleteHistoryResult>;
  triggerDownload?: (filename: string, payload: string) => void;
}

export interface ProjectHistoryPanelOptions {
  rowLimit?: number;
  deps?: ProjectHistoryPanelDeps;
}

export interface ProjectHistoryPanelHandle {
  root: HTMLElement;
  refresh: () => Promise<void>;
  getLastError: () => string | null;
}

function fmtTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function firstLine(text: string | null): string {
  if (!text) return '(empty)';
  const line = text.split(/\r?\n/, 1)[0] ?? '';
  return line.length > 160 ? line.slice(0, 157) + '...' : line;
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const elem = document.createElement(tag);
  if (className) elem.className = className;
  if (textContent !== undefined) elem.textContent = textContent;
  return elem;
}

function defaultDownload(filename: string, payload: string): void {
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveDeps(deps?: ProjectHistoryPanelDeps): Required<ProjectHistoryPanelDeps> {
  return {
    loadHistory: deps?.loadHistory ?? getProjectHistory,
    exportHistory: deps?.exportHistory ?? exportProjectHistoryAsJson,
    deleteEntry: deps?.deleteEntry ?? deleteHistoryEntry,
    triggerDownload: deps?.triggerDownload ?? defaultDownload,
  };
}

function renderRow(
  entry: HistoryEntry,
  onDelete: (entry: HistoryEntry) => void,
): HTMLLIElement {
  const item = makeEl('li', 'phist-row');
  item.dataset.entryId = String(entry.id);

  const meta = makeEl('div', 'phist-meta');
  meta.appendChild(makeEl('span', 'phist-source', entry.source));
  meta.appendChild(makeEl('span', 'phist-time', fmtTimestamp(entry.createdAt)));
  meta.appendChild(makeEl('span', 'phist-chars', `${entry.charCount} ch`));

  const preview = makeEl('div', 'phist-preview', firstLine(entry.body));

  const actions = makeEl('div', 'phist-actions');
  const deleteBtn = makeEl('button', 'phist-delete', 'Delete');
  deleteBtn.type = 'button';
  deleteBtn.addEventListener('click', () => onDelete(entry));
  actions.appendChild(deleteBtn);

  item.appendChild(meta);
  item.appendChild(preview);
  item.appendChild(actions);
  return item;
}

interface PanelChrome {
  root: HTMLElement;
  count: HTMLElement;
  exportBtn: HTMLButtonElement;
  list: HTMLElement;
  status: HTMLElement;
}

function buildPanelChrome(projectId: string): PanelChrome {
  const root = makeEl('section', 'phist-panel');
  root.dataset.projectId = projectId;

  const header = makeEl('header', 'phist-header');
  const title = makeEl('h3', 'phist-title', 'Project history');
  const count = makeEl('span', 'phist-count', '0 entries');
  const exportBtn = makeEl('button', 'phist-export', 'Export JSON') as HTMLButtonElement;
  exportBtn.type = 'button';
  header.appendChild(title);
  header.appendChild(count);
  header.appendChild(exportBtn);

  const list = makeEl('ul', 'phist-list');
  const status = makeEl('div', 'phist-status');
  status.setAttribute('role', 'status');

  root.appendChild(header);
  root.appendChild(list);
  root.appendChild(status);
  return { root, count, exportBtn, list, status };
}

// eslint-disable-next-line max-lines-per-function -- inner refresh/delete/export closures share panel scope; splitting further would leak state
export function openProjectHistoryPanel(
  mountRoot: HTMLElement,
  projectId: string,
  options: ProjectHistoryPanelOptions = {},
): ProjectHistoryPanelHandle {
  const rowLimit = options.rowLimit ?? DEFAULT_ROW_LIMIT;
  const deps = resolveDeps(options.deps);

  const { root, count, exportBtn, list, status } = buildPanelChrome(projectId);
  mountRoot.appendChild(root);

  let lastError: string | null = null;

  function setStatus(message: string, isError: boolean): void {
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
    if (isError) lastError = message;
  }

  async function refresh(): Promise<void> {
    try {
      const entries = await deps.loadHistory(projectId, rowLimit);
      list.textContent = '';
      const noun = entries.length === 1 ? 'entry' : 'entries';
      count.textContent = `${entries.length} ${noun}`;
      for (const entry of entries) {
        list.appendChild(renderRow(entry, handleDelete));
      }
      setStatus(`Loaded ${entries.length} rows`, false);
    } catch (err) {
      logError(SCOPE, `refresh failed (projectId=${projectId})`, err);
      setStatus('Failed to load history', true);
    }
  }

  async function handleDelete(entry: HistoryEntry): Promise<void> {
    try {
      const result = await deps.deleteEntry(projectId, entry.id, entry.fileId);
      if (!result.isDeleted) {
        setStatus(`Delete failed (row=${entry.id})`, true);
        return;
      }
      await refresh();
    } catch (err) {
      logError(SCOPE, `delete failed (projectId=${projectId}, id=${entry.id})`, err);
      setStatus(`Delete threw for row=${entry.id}`, true);
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const envelope = await deps.exportHistory(projectId);
      const json = JSON.stringify(envelope, null, 2);
      deps.triggerDownload(`project-history-${projectId}.json`, json);
      setStatus(`Exported ${envelope.entryCount} rows`, false);
    } catch (err) {
      logError(SCOPE, `export failed (projectId=${projectId})`, err);
      setStatus('Export failed', true);
    }
  }

  exportBtn.addEventListener('click', () => {
    void handleExport();
  });

  void refresh();

  return {
    root,
    refresh,
    getLastError: () => lastError,
  };
}
