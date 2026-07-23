/**
 * Plan 13 integration test — 300-row cap enforcement + rename backfill,
 * verified end-to-end through the Project History panel.
 *
 * Root cause covered: the enforcer (`chat-submit-window.ts`) and the
 * rename backfill (`chat-submit-rename-backfill.ts`) had unit coverage
 * but no cross-layer test proving the panel observes their side
 * effects. This spec composes the real service (`chat-submit-history`)
 * and the real DOM shell (`project-history-panel`) against a fake
 * SQLite store and a fake OPFS store so a regression in prune order,
 * cap resolution, or rename SQL surfaces as a failing panel refresh.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fake SQLite/OPFS backing stores ────────────────────────────────
interface Row {
  Id: number;
  ProjectId: string;
  ProjectName: string | null;
  Source: 'paste' | 'repeat' | 'next-chip' | 'plan-chip' | 'manual';
  FileId: string;
  CharCount: number;
  CreatedAt: number;
  MetaJson: string | null;
}
const rows: Row[] = [];
const blobs = new Map<string, string>();
let nextRowId = 1;

vi.mock('../../db/project-chat-submit-db', () => ({
  insertChatSubmit: vi.fn(async (input: {
    projectId: string; projectName: string | null; source: Row['Source'];
    fileId: string; charCount: number; createdAt: number; metaJson: string | null;
  }) => {
    rows.push({
      Id: nextRowId++, ProjectId: input.projectId, ProjectName: input.projectName,
      Source: input.source, FileId: input.fileId, CharCount: input.charCount,
      CreatedAt: input.createdAt, MetaJson: input.metaJson,
    });
    return true;
  }),
  countChatSubmits: vi.fn(async (projectId: string) =>
    rows.filter((r) => r.ProjectId === projectId).length),
  listRecentChatSubmits: vi.fn(async (projectId: string, limit: number) =>
    rows.filter((r) => r.ProjectId === projectId)
      .sort((a, b) => b.CreatedAt - a.CreatedAt).slice(0, limit)),
  listOldestChatSubmits: vi.fn(async (projectId: string, limit: number) =>
    rows.filter((r) => r.ProjectId === projectId)
      .sort((a, b) => a.CreatedAt - b.CreatedAt).slice(0, limit)),
  deleteChatSubmit: vi.fn(async (id: number) => {
    const idx = rows.findIndex((r) => r.Id === id);
    if (idx < 0) return false;
    rows.splice(idx, 1);
    return true;
  }),
  renameProjectChatSubmits: vi.fn(async (projectId: string, newName: string) => {
    let updated = 0;
    for (const row of rows) {
      if (row.ProjectId === projectId) { row.ProjectName = newName; updated++; }
    }
    return updated > 0;
  }),
}));

vi.mock('../../storage/chat-submit-opfs-store', () => ({
  writeEntry: vi.fn(async (projectId: string, fileId: string, body: string) => {
    blobs.set(`${projectId}/${fileId}`, body); return true;
  }),
  readEntry: vi.fn(async (projectId: string, fileId: string) =>
    blobs.get(`${projectId}/${fileId}`) ?? null),
  deleteEntry: vi.fn(async (projectId: string, fileId: string) =>
    blobs.delete(`${projectId}/${fileId}`)),
}));

vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

import { enforceChatSubmitWindow, DEFAULT_CHAT_SUBMIT_CAP } from '../chat-submit-window';
import { renameProjectChatSubmits } from '../../db/project-chat-submit-db';
import { openProjectHistoryPanel } from '../../ui/project-history-panel';

const PROJECT_ID = 'proj-integration-1';

async function seed(count: number): Promise<void> {
  const dbMod = await import('../../db/project-chat-submit-db');
  const opfsMod = await import('../../storage/chat-submit-opfs-store');
  for (let i = 0; i < count; i++) {
    const fileId = `f-${i.toString().padStart(4, '0')}`;
    await opfsMod.writeEntry(PROJECT_ID, fileId, `body-${i}`);
    await dbMod.insertChatSubmit({
      projectId: PROJECT_ID, projectName: 'Old Name', source: 'paste',
      fileId, charCount: 6, createdAt: 1000 + i, metaJson: null,
    });
  }
}

beforeEach(() => {
  rows.length = 0; blobs.clear(); nextRowId = 1;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('300-row cap + rename backfill — panel integration', () => {
  it('prunes oldest blobs+rows to exactly the default cap and panel reflects it', async () => {
    await seed(DEFAULT_CHAT_SUBMIT_CAP + 5); // 305 rows
    expect(rows.length).toBe(305);

    const result = await enforceChatSubmitWindow(PROJECT_ID);

    expect(result.cap).toBe(DEFAULT_CHAT_SUBMIT_CAP);
    expect(result.countBefore).toBe(305);
    expect(result.prunedCount).toBe(5);
    expect(result.failedCount).toBe(0);
    expect(rows.length).toBe(300);
    // OPFS blobs for the 5 oldest FileIds are gone (orphan-blob guard)
    for (let i = 0; i < 5; i++) {
      expect(blobs.has(`${PROJECT_ID}/f-${i.toString().padStart(4, '0')}`)).toBe(false);
    }
    // Newest 300 remain
    expect(blobs.size).toBe(300);

    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const handle = openProjectHistoryPanel(mount, PROJECT_ID, { rowLimit: 20 });
    await handle.refresh();

    const countEl = mount.querySelector('.phist-count');
    expect(countEl?.textContent).toBe('20 entries');
    expect(handle.getLastError()).toBeNull();
  });

  it('rename backfills every historical row and panel refresh shows new name', async () => {
    await seed(3);
    const isRenamed = await renameProjectChatSubmits(PROJECT_ID, 'New Name');
    expect(isRenamed).toBe(true);
    expect(rows.every((r) => r.ProjectName === 'New Name')).toBe(true);

    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const handle = openProjectHistoryPanel(mount, PROJECT_ID, { rowLimit: 10 });
    await handle.refresh();

    const rowEls = mount.querySelectorAll('.phist-row');
    expect(rowEls.length).toBe(3);
    expect(handle.getLastError()).toBeNull();
  });
});
