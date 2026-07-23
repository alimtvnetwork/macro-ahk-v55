/**
 * Integration test — `openProjectHistoryPanel` end-to-end.
 *
 * Plan 13, Step 10 (verification harness). Unlike the unit test in
 * `project-history-panel.test.ts` (which injects `deps`), this test
 * uses the panel's DEFAULT dependencies so the real
 * `chat-submit-history` service runs. The storage substrate
 * (`db/project-chat-submit-db` + `storage/chat-submit-opfs-store`) is
 * mocked at the module boundary because JSDOM has neither SQLite nor
 * OPFS.
 *
 * What we prove here:
 *   1. Panel mount triggers `listRecentChatSubmits` and `readEntry`
 *      through the real service pipeline.
 *   2. Row bodies hydrated from OPFS reach the DOM preview.
 *   3. `Export JSON` invokes `deleteEntry`-independent read paths and
 *      serialises the exact schema-versioned envelope produced by
 *      `exportProjectHistoryAsJson`.
 *   4. Row delete drives both OPFS delete AND SQLite row delete, then
 *      re-lists rows.
 *
 * If the storage adapters ever change their contract, this test will
 * fail before the shipped UI does.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two storage modules BEFORE importing the panel/service.
vi.mock('../../db/project-chat-submit-db', () => {
  const rows = [
    {
      Id: 11, ProjectId: 'proj-A', ProjectName: 'Alpha', Source: 'PasteFlow',
      FileId: 'file-11', CharCount: 22, CreatedAt: 1_700_000_000_000, MetaJson: null,
    },
    {
      Id: 12, ProjectId: 'proj-A', ProjectName: 'Alpha', Source: 'NextChip',
      FileId: 'file-12', CharCount: 33, CreatedAt: 1_700_000_001_000, MetaJson: null,
    },
  ];
  return {
    listRecentChatSubmits: vi.fn(async (projectId: string) =>
      rows.filter((r) => r.ProjectId === projectId),
    ),
    deleteChatSubmit: vi.fn(async (id: number) => {
      const before = rows.length;
      const idx = rows.findIndex((r) => r.Id === id);
      if (idx >= 0) rows.splice(idx, 1);
      return rows.length < before;
    }),
    __rows: rows,
  };
});

vi.mock('../../storage/chat-submit-opfs-store', () => {
  const blobs = new Map<string, string>([
    ['proj-A/file-11', 'hello from file-11'],
    ['proj-A/file-12', 'hello from file-12'],
  ]);
  return {
    readEntry: vi.fn(async (projectId: string, fileId: string) =>
      blobs.get(`${projectId}/${fileId}`) ?? null,
    ),
    deleteEntry: vi.fn(async (projectId: string, fileId: string) => {
      return blobs.delete(`${projectId}/${fileId}`);
    }),
  };
});

import { openProjectHistoryPanel } from '../project-history-panel';
import * as db from '../../db/project-chat-submit-db';
import * as opfs from '../../storage/chat-submit-opfs-store';

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('openProjectHistoryPanel — integration with real service', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mount loads rows through service and hydrates OPFS bodies into DOM', async () => {
    const handle = openProjectHistoryPanel(document.body, 'proj-A');
    await flush();
    await flush();

    expect(db.listRecentChatSubmits).toHaveBeenCalledWith('proj-A', 20);
    expect(opfs.readEntry).toHaveBeenCalledTimes(2);
    expect(handle.root.querySelectorAll('.phist-row')).toHaveLength(2);
    expect(handle.root.textContent).toContain('hello from file-11');
    expect(handle.root.textContent).toContain('hello from file-12');
    expect(handle.getLastError()).toBeNull();
  });

  it('export button downloads schema-versioned envelope with all rows', async () => {
    const download = vi.fn();
    // Wrap default deps by replacing only triggerDownload so the rest
    // of the pipeline (real service) stays exercised.
    const handle = openProjectHistoryPanel(document.body, 'proj-A', {
      deps: { triggerDownload: download },
    });
    await flush();
    await flush();

    const btn = handle.root.querySelector('.phist-export') as HTMLButtonElement;
    btn.click();
    await flush();
    await flush();

    expect(download).toHaveBeenCalledTimes(1);
    const [filename, payload] = download.mock.calls[0];
    expect(filename).toBe('project-history-proj-A.json');
    const parsed = JSON.parse(payload);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.projectId).toBe('proj-A');
    expect(parsed.entryCount).toBe(2);
    expect(parsed.entries[0].body).toBe('hello from file-11');
  });

  it('row delete runs OPFS delete AND SQLite delete then refreshes', async () => {
    const handle = openProjectHistoryPanel(document.body, 'proj-A');
    await flush();
    await flush();

    const firstDeleteBtn = handle.root.querySelector('.phist-row .phist-del') as HTMLButtonElement | null;
    // The panel button class may differ; fall back to any button in the first row.
    const btn = firstDeleteBtn ?? (handle.root.querySelector('.phist-row button') as HTMLButtonElement);
    expect(btn).toBeTruthy();
    btn.click();
    await flush();
    await flush();
    await flush();

    expect(opfs.deleteEntry).toHaveBeenCalledTimes(1);
    expect(db.deleteChatSubmit).toHaveBeenCalledTimes(1);
    // After delete, listRecentChatSubmits should have been called
    // twice: initial + post-delete refresh.
    expect(db.listRecentChatSubmits).toHaveBeenCalledTimes(2);
    expect(handle.root.querySelectorAll('.phist-row')).toHaveLength(1);
    expect(handle.getLastError()).toBeNull();
  });
});
