/**
 * Tests for `openProjectHistoryPanel` — plan-13 step 9 DOM shell.
 *
 * Covers: happy-path render + row count, per-row delete flow that
 * triggers a refresh, export-button hooking the download function
 * with a JSON envelope, and error branches that surface via the
 * status element without swallowing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openProjectHistoryPanel } from '../project-history-panel';
import type {
  HistoryEntry,
  HistoryExport,
  DeleteHistoryResult,
} from '../../capture/chat-submit-history';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 1,
    projectId: 'p1',
    projectName: 'Project 1',
    source: 'PasteFlow',
    fileId: 'f-1',
    charCount: 42,
    createdAt: 1_700_000_000_000,
    metaJson: null,
    body: 'first line\nsecond line',
    ...overrides,
  };
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('openProjectHistoryPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders header count and one row per entry', async () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2, source: 'NextChip' })];
    const loadHistory = vi.fn().mockResolvedValue(entries);
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory,
        exportHistory: vi.fn(),
        deleteEntry: vi.fn(),
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    expect(loadHistory).toHaveBeenCalledWith('p1', 20);
    expect(handle.root.querySelector('.phist-count')?.textContent).toBe('2 entries');
    expect(handle.root.querySelectorAll('.phist-row')).toHaveLength(2);
    expect(handle.getLastError()).toBeNull();
  });

  it('shows singular noun when only one entry', async () => {
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory: vi.fn().mockResolvedValue([makeEntry()]),
        exportHistory: vi.fn(),
        deleteEntry: vi.fn(),
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    expect(handle.root.querySelector('.phist-count')?.textContent).toBe('1 entry');
  });

  it('surfaces load errors on the status line without throwing', async () => {
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory: vi.fn().mockRejectedValue(new Error('boom')),
        exportHistory: vi.fn(),
        deleteEntry: vi.fn(),
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    const status = handle.root.querySelector('.phist-status') as HTMLElement;
    expect(status.dataset.state).toBe('error');
    expect(handle.getLastError()).toBe('Failed to load history');
  });

  it('deletes a row and refreshes on success', async () => {
    const initial = [makeEntry({ id: 7 }), makeEntry({ id: 8 })];
    const afterDelete = [makeEntry({ id: 8 })];
    const loadHistory = vi
      .fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(afterDelete);
    const deleteEntry = vi.fn<[string, number, string], Promise<DeleteHistoryResult>>(
      async () => ({ isDeleted: true, opfsRemoved: true, rowRemoved: true }),
    );
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory,
        exportHistory: vi.fn(),
        deleteEntry,
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    const firstDelete = handle.root.querySelector<HTMLButtonElement>(
      '.phist-row[data-entry-id="7"] .phist-delete',
    );
    expect(firstDelete).not.toBeNull();
    firstDelete!.click();
    await flush();
    await flush();
    expect(deleteEntry).toHaveBeenCalledWith('p1', 7, 'f-1');
    expect(loadHistory).toHaveBeenCalledTimes(2);
    expect(handle.root.querySelectorAll('.phist-row')).toHaveLength(1);
  });

  it('records delete-failed status when service returns not-deleted', async () => {
    const deleteEntry = vi
      .fn<[string, number, string], Promise<DeleteHistoryResult>>()
      .mockResolvedValue({ isDeleted: false, opfsRemoved: false, rowRemoved: false });
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory: vi.fn().mockResolvedValue([makeEntry({ id: 42 })]),
        exportHistory: vi.fn(),
        deleteEntry,
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    handle.root
      .querySelector<HTMLButtonElement>('.phist-row[data-entry-id="42"] .phist-delete')!
      .click();
    await flush();
    expect(handle.getLastError()).toBe('Delete failed (row=42)');
  });

  it('exports a JSON envelope through the provided download function', async () => {
    const envelope: HistoryExport = {
      schemaVersion: 1,
      projectId: 'p1',
      exportedAt: 1_700_000_000_000,
      entryCount: 1,
      entries: [makeEntry()],
    };
    const triggerDownload = vi.fn();
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory: vi.fn().mockResolvedValue([makeEntry()]),
        exportHistory: vi.fn().mockResolvedValue(envelope),
        deleteEntry: vi.fn(),
        triggerDownload,
      },
    });
    await flush();
    handle.root.querySelector<HTMLButtonElement>('.phist-export')!.click();
    await flush();
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const [filename, payload] = triggerDownload.mock.calls[0]!;
    expect(filename).toBe('project-history-p1.json');
    const parsed = JSON.parse(payload as string);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.entryCount).toBe(1);
  });

  it('surfaces export failures without swallowing', async () => {
    const handle = openProjectHistoryPanel(document.body, 'p1', {
      deps: {
        loadHistory: vi.fn().mockResolvedValue([makeEntry()]),
        exportHistory: vi.fn().mockRejectedValue(new Error('nope')),
        deleteEntry: vi.fn(),
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    handle.root.querySelector<HTMLButtonElement>('.phist-export')!.click();
    await flush();
    expect(handle.getLastError()).toBe('Export failed');
  });

  it('respects a custom rowLimit', async () => {
    const loadHistory = vi.fn().mockResolvedValue([]);
    openProjectHistoryPanel(document.body, 'p1', {
      rowLimit: 5,
      deps: {
        loadHistory,
        exportHistory: vi.fn(),
        deleteEntry: vi.fn(),
        triggerDownload: vi.fn(),
      },
    });
    await flush();
    expect(loadHistory).toHaveBeenCalledWith('p1', 5);
  });
});
