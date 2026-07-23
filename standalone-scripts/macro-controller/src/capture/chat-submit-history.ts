/**
 * Chat Submit History Service — plan 13 step 9 (data layer).
 *
 * Headless service that powers the upcoming "Project history" panel.
 * Delivers three things the panel needs and nothing else:
 *
 *   1. `getProjectHistory(projectId, limit?)` — recent rows with body
 *      pre-loaded from OPFS so the panel does not need to know the
 *      storage split.
 *   2. `exportProjectHistoryAsJson(projectId)` — a stable, schema-
 *      versioned JSON envelope suitable for clipboard or file save.
 *   3. `deleteHistoryEntry(projectId, id, fileId)` — atomic pair-delete
 *      (SQLite row + OPFS blob) with honest partial-failure reporting.
 *
 * The DOM shell that renders these + wires the export button lives in
 * a separate follow-up so this module stays testable in JSDOM without
 * touching the extension menu.
 *
 * All failures route through `logError('ChatSubmitHistory', ...)`.
 */

import { logError } from '../error-utils';
import {
  listRecentChatSubmits,
  deleteChatSubmit,
  type ChatSubmitRow,
} from '../db/project-chat-submit-db';
import { readEntry, deleteEntry as deleteOpfsEntry } from '../storage/chat-submit-opfs-store';

const SCOPE = 'ChatSubmitHistory';

export const HISTORY_EXPORT_SCHEMA_VERSION = 1;
export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 500;

export interface HistoryEntry {
  id: number;
  projectId: string;
  projectName: string | null;
  source: string;
  fileId: string;
  charCount: number;
  createdAt: number;
  metaJson: string | null;
  body: string | null; // null if OPFS read failed or blob missing
}

export interface HistoryExport {
  schemaVersion: number;
  projectId: string;
  exportedAt: number;
  entryCount: number;
  entries: HistoryEntry[];
}

export interface DeleteHistoryResult {
  isDeleted: boolean;
  opfsRemoved: boolean;
  rowRemoved: boolean;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  const floored = Math.floor(limit);
  if (floored < 1) return 1;
  if (floored > MAX_HISTORY_LIMIT) return MAX_HISTORY_LIMIT;
  return floored;
}

async function hydrateBodies(projectId: string, rows: ChatSubmitRow[]): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];
  for (const row of rows) {
    let body: string | null;
    try {
      body = await readEntry(projectId, row.FileId);
    } catch (err) {
      logError(SCOPE, `hydrateBodies read failed (projectId=${projectId}, fileId=${row.FileId})`, err);
      body = null;
    }
    entries.push({
      id: row.Id,
      projectId: row.ProjectId,
      projectName: row.ProjectName,
      source: row.Source,
      fileId: row.FileId,
      charCount: row.CharCount,
      createdAt: row.CreatedAt,
      metaJson: row.MetaJson,
      body,
    });
  }
  return entries;
}

export async function getProjectHistory(
  projectId: string,
  limit?: number,
): Promise<HistoryEntry[]> {
  const rows = await listRecentChatSubmits(projectId, clampLimit(limit));
  return hydrateBodies(projectId, rows);
}

export async function exportProjectHistoryAsJson(projectId: string): Promise<HistoryExport> {
  const entries = await getProjectHistory(projectId, MAX_HISTORY_LIMIT);
  return {
    schemaVersion: HISTORY_EXPORT_SCHEMA_VERSION,
    projectId,
    exportedAt: Date.now(),
    entryCount: entries.length,
    entries,
  };
}

export async function deleteHistoryEntry(
  projectId: string,
  id: number,
  fileId: string,
): Promise<DeleteHistoryResult> {
  // OPFS first (same reason as the window enforcer: rows can be
  // re-linked by FileId, orphan blobs cannot).
  const opfsRemoved = await deleteOpfsEntry(projectId, fileId);
  if (!opfsRemoved) {
    return { isDeleted: false, opfsRemoved: false, rowRemoved: false };
  }
  const rowRemoved = await deleteChatSubmit(id);
  return { isDeleted: rowRemoved, opfsRemoved, rowRemoved };
}
