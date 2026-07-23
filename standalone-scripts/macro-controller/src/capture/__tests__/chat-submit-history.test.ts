/**
 * Tests for chat-submit-history (plan 13 step 9 data layer).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/project-chat-submit-db', () => ({
  listRecentChatSubmits: vi.fn(),
  deleteChatSubmit: vi.fn(),
}));
vi.mock('../../storage/chat-submit-opfs-store', () => ({
  readEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

import {
  getProjectHistory,
  exportProjectHistoryAsJson,
  deleteHistoryEntry,
  HISTORY_EXPORT_SCHEMA_VERSION,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '../chat-submit-history';
import * as db from '../../db/project-chat-submit-db';
import * as opfs from '../../storage/chat-submit-opfs-store';

const listMock = db.listRecentChatSubmits as unknown as ReturnType<typeof vi['fn']>;
const deleteRowMock = db.deleteChatSubmit as unknown as ReturnType<typeof vi['fn']>;
const readMock = opfs.readEntry as unknown as ReturnType<typeof vi['fn']>;
const deleteOpfsMock = opfs.deleteEntry as unknown as ReturnType<typeof vi['fn']>;

const sampleRow = {
  Id: 1, ProjectId: 'p1', ProjectName: 'Alpha', Source: 'paste',
  FileId: 'f1', CharCount: 42, CreatedAt: 1_700_000_000_000, MetaJson: null,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('getProjectHistory', () => {
  it('clamps limit into [1, MAX_HISTORY_LIMIT] and defaults on NaN', async () => {
    listMock.mockResolvedValue([]);
    await getProjectHistory('p1');
    expect(listMock).toHaveBeenLastCalledWith('p1', DEFAULT_HISTORY_LIMIT);
    await getProjectHistory('p1', 0);
    expect(listMock).toHaveBeenLastCalledWith('p1', 1);
    await getProjectHistory('p1', 10_000);
    expect(listMock).toHaveBeenLastCalledWith('p1', MAX_HISTORY_LIMIT);
    await getProjectHistory('p1', NaN);
    expect(listMock).toHaveBeenLastCalledWith('p1', DEFAULT_HISTORY_LIMIT);
  });

  it('hydrates body from OPFS and normalizes to camelCase', async () => {
    listMock.mockResolvedValue([sampleRow]);
    readMock.mockResolvedValue('hello world');
    const [e] = await getProjectHistory('p1', 10);
    expect(e).toEqual({
      id: 1, projectId: 'p1', projectName: 'Alpha', source: 'paste',
      fileId: 'f1', charCount: 42, createdAt: 1_700_000_000_000, metaJson: null,
      body: 'hello world',
    });
  });

  it('sets body=null when OPFS read throws (never rejects the whole call)', async () => {
    listMock.mockResolvedValue([sampleRow]);
    readMock.mockRejectedValue(new Error('boom'));
    const [e] = await getProjectHistory('p1');
    expect(e.body).toBeNull();
  });
});

describe('exportProjectHistoryAsJson', () => {
  it('produces a schema-versioned envelope with entryCount === entries.length', async () => {
    listMock.mockResolvedValue([sampleRow, { ...sampleRow, Id: 2, FileId: 'f2' }]);
    readMock.mockResolvedValue('body');
    const out = await exportProjectHistoryAsJson('p1');
    expect(out.schemaVersion).toBe(HISTORY_EXPORT_SCHEMA_VERSION);
    expect(out.projectId).toBe('p1');
    expect(out.entryCount).toBe(out.entries.length);
    expect(out.entryCount).toBe(2);
    expect(typeof out.exportedAt).toBe('number');
  });
});

describe('deleteHistoryEntry', () => {
  it('deletes OPFS first, then row', async () => {
    const order: string[] = [];
    deleteOpfsMock.mockImplementation(async () => { order.push('opfs'); return true; });
    deleteRowMock.mockImplementation(async () => { order.push('row'); return true; });
    const r = await deleteHistoryEntry('p1', 1, 'f1');
    expect(order).toEqual(['opfs', 'row']);
    expect(r).toEqual({ isDeleted: true, opfsRemoved: true, rowRemoved: true });
  });

  it('does NOT delete row when OPFS delete fails (avoids orphan blob)', async () => {
    deleteOpfsMock.mockResolvedValue(false);
    const r = await deleteHistoryEntry('p1', 1, 'f1');
    expect(deleteRowMock).not.toHaveBeenCalled();
    expect(r).toEqual({ isDeleted: false, opfsRemoved: false, rowRemoved: false });
  });

  it('reports partial delete when row-delete fails after OPFS success', async () => {
    deleteOpfsMock.mockResolvedValue(true);
    deleteRowMock.mockResolvedValue(false);
    const r = await deleteHistoryEntry('p1', 1, 'f1');
    expect(r).toEqual({ isDeleted: false, opfsRemoved: true, rowRemoved: false });
  });
});
