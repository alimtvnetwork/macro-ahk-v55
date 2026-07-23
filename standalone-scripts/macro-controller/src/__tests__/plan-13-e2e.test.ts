/**
 * Plan 13 end-to-end integration test (step 10).
 *
 * Wires the REAL higher-level modules together and verifies the full
 * flow: capture → rolling-window prune → history read → JSON export
 * → delete. IO leaves are replaced with in-memory fakes:
 *
 *   - `db/project-chat-submit-db`: in-memory row array with the same
 *     public API (list/insert/count/delete/rename).
 *   - `storage/chat-submit-opfs-store`: in-memory Map<projectId, Map<fileId, text>>.
 *   - `workspace-detection`, `logging`: return a stable id/name pair.
 *
 * This proves that the capture pipeline (paste/repeat/next/plan hooks
 * → `captureChatSubmit` → `enforceChatSubmitWindow` →
 * `installChatSubmitRenameBackfill`) stays coherent with the history
 * service (`getProjectHistory` / `exportProjectHistoryAsJson` /
 * `deleteHistoryEntry`) — a regression in any single seam surfaces
 * here as a failing assertion, not a silent divergence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── in-memory DB ────────────────────────────────────────────────────
interface Row {
  Id: number; ProjectId: string; ProjectName: string | null;
  Source: string; FileId: string; CharCount: number;
  CreatedAt: number; MetaJson: string | null;
}
let rows: Row[] = [];
let nextId = 1;

vi.mock('../db/project-chat-submit-db', () => ({
  insertChatSubmit: vi.fn(async (input: {
    projectId: string; projectName: string | null; source: string;
    fileId: string; charCount: number; createdAt: number; metaJson: string | null;
  }) => {
    rows.push({
      Id: nextId++, ProjectId: input.projectId, ProjectName: input.projectName,
      Source: input.source, FileId: input.fileId, CharCount: input.charCount,
      CreatedAt: input.createdAt, MetaJson: input.metaJson,
    });
    return true;
  }),
  countChatSubmits: vi.fn(async (pid: string) => rows.filter((r) => r.ProjectId === pid).length),
  listRecentChatSubmits: vi.fn(async (pid: string, limit: number) =>
    rows.filter((r) => r.ProjectId === pid).sort((a, b) => b.CreatedAt - a.CreatedAt).slice(0, limit),
  ),
  listOldestChatSubmits: vi.fn(async (pid: string, limit: number) =>
    rows.filter((r) => r.ProjectId === pid).sort((a, b) => a.CreatedAt - b.CreatedAt).slice(0, limit),
  ),
  deleteChatSubmit: vi.fn(async (id: number) => {
    const before = rows.length;
    rows = rows.filter((r) => r.Id !== id);
    return rows.length < before;
  }),
  renameProjectChatSubmits: vi.fn(async (pid: string, newName: string) => {
    let touched = 0;
    for (const r of rows) if (r.ProjectId === pid) { r.ProjectName = newName; touched += 1; }
    return touched > 0;
  }),
}));

// ── in-memory OPFS ──────────────────────────────────────────────────
const opfsFiles: Map<string, Map<string, string>> = new Map();
let opfsFileIdCounter = 1;

vi.mock('../storage/chat-submit-opfs-store', () => ({
  saveEntry: vi.fn(async (pid: string, text: string) => {
    if (!opfsFiles.has(pid)) opfsFiles.set(pid, new Map());
    const fileId = `f${opfsFileIdCounter++}`;
    opfsFiles.get(pid)!.set(fileId, text);
    return fileId;
  }),
  readEntry: vi.fn(async (pid: string, fid: string) => opfsFiles.get(pid)?.get(fid) ?? null),
  deleteEntry: vi.fn(async (pid: string, fid: string) => {
    const dir = opfsFiles.get(pid);
    if (!dir || !dir.has(fid)) return false;
    dir.delete(fid);
    return true;
  }),
  listProject: vi.fn(async (pid: string) => Array.from(opfsFiles.get(pid)?.keys() ?? [])),
  deleteProject: vi.fn(async (pid: string) => opfsFiles.delete(pid)),
}));

// ── project identity ────────────────────────────────────────────────
let stubbedName: string | null = 'Alpha Project';
vi.mock('../workspace-detection', () => ({
  extractProjectIdFromUrl: vi.fn(() => 'proj-uuid-1111'),
}));
vi.mock('../logging', () => ({
  log: vi.fn(),
  getDisplayProjectName: vi.fn(() => stubbedName),
}));
vi.mock('../error-utils', () => ({
  logError: vi.fn(),
  toErrorMessage: vi.fn((e: unknown) => String(e)),
}));

// ── System under test (real modules) ────────────────────────────────
import { captureChatSubmit } from '../capture/chat-submit-capture';
import { enforceChatSubmitWindow } from '../capture/chat-submit-window';
import {
  getProjectHistory,
  exportProjectHistoryAsJson,
  deleteHistoryEntry,
} from '../capture/chat-submit-history';
import { _resetProjectIdentityStateForTests } from '../util/project-id-from-url';
import { _resetChatSubmitRenameBackfillForTests } from '../capture/chat-submit-rename-backfill';
import * as db from '../db/project-chat-submit-db';

const PROJECT_ID = 'proj-uuid-1111';

beforeEach(() => {
  rows = [];
  nextId = 1;
  opfsFiles.clear();
  opfsFileIdCounter = 1;
  stubbedName = 'Alpha Project';
  _resetProjectIdentityStateForTests();
  _resetChatSubmitRenameBackfillForTests();
  vi.clearAllMocks();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

describe('plan 13 end-to-end', () => {
  it('captures a submission and makes it visible through history + export', async () => {
    const r = await captureChatSubmit({ source: 'paste', text: 'hello world', isVerbose: true });
    await settle();
    expect(r.isCaptured).toBe(true);
    expect(r.projectId).toBe(PROJECT_ID);

    const entries = await getProjectHistory(PROJECT_ID);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: 'paste', charCount: 11, projectName: 'Alpha Project', body: 'hello world',
    });

    const envelope = await exportProjectHistoryAsJson(PROJECT_ID);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.entryCount).toBe(1);
    expect(envelope.entries[0].body).toBe('hello world');
  });

  it('redacts body when isVerbose is false but keeps CharCount honest', async () => {
    await captureChatSubmit({ source: 'repeat', text: 'secret payload', isVerbose: false });
    await settle();
    const [e] = await getProjectHistory(PROJECT_ID);
    expect(e.charCount).toBe('secret payload'.length);
    expect(e.body).not.toBe('secret payload');
    expect(e.body).toContain('redacted');
  });

  it('enforces the rolling window: excess oldest rows + blobs are pruned', async () => {
    // Cap is clamped to [MIN=10, MAX=5000]. Write 15 rows and enforce
    // with cap=10 → expect 5 oldest pruned from BOTH stores.
    for (let i = 0; i < 15; i += 1) {
      await captureChatSubmit({ source: 'paste', text: `msg-${i}`, isVerbose: true });
      await new Promise((r) => setTimeout(r, 2));
    }
    await settle();
    await enforceChatSubmitWindow(PROJECT_ID, 10);

    const remaining = await getProjectHistory(PROJECT_ID);
    expect(remaining).toHaveLength(10);
    // The 10 newest messages must survive; msg-0..msg-4 must be gone.
    const bodies = remaining.map((e) => e.body);
    for (let i = 5; i < 15; i += 1) expect(bodies).toContain(`msg-${i}`);
    for (let i = 0; i < 5; i += 1) expect(bodies).not.toContain(`msg-${i}`);
    expect(opfsFiles.get(PROJECT_ID)!.size).toBe(10);
  });

  it('rename-backfill updates ProjectName on rows written before the rename', async () => {
    await captureChatSubmit({ source: 'paste', text: 'first', isVerbose: true });
    await settle();
    stubbedName = 'Renamed Project';
    await captureChatSubmit({ source: 'paste', text: 'second', isVerbose: true });
    await settle();
    const entries = await getProjectHistory(PROJECT_ID);
    expect(entries).toHaveLength(2);
    // Both rows should now carry the new name — backfill fired.
    expect(entries.every((e) => e.projectName === 'Renamed Project')).toBe(true);
    expect(db.renameProjectChatSubmits).toHaveBeenCalledWith(PROJECT_ID, 'Renamed Project');
  });

  it('deleteHistoryEntry removes both the row and the OPFS blob', async () => {
    await captureChatSubmit({ source: 'next-chip', text: 'to-delete', isVerbose: true });
    await settle();
    const [entry] = await getProjectHistory(PROJECT_ID);
    const r = await deleteHistoryEntry(PROJECT_ID, entry.id, entry.fileId);
    expect(r).toEqual({ isDeleted: true, opfsRemoved: true, rowRemoved: true });
    expect(await getProjectHistory(PROJECT_ID)).toHaveLength(0);
    expect(opfsFiles.get(PROJECT_ID)?.size ?? 0).toBe(0);
  });
});
