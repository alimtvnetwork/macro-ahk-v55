/**
 * Tests for chat-submit-window (plan 13 step 7).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/project-chat-submit-db', () => ({
  countChatSubmits: vi.fn(),
  deleteChatSubmit: vi.fn(),
  listOldestChatSubmits: vi.fn(),
}));

vi.mock('../../storage/chat-submit-opfs-store', () => ({
  deleteEntry: vi.fn(),
}));

vi.mock('../../error-utils', () => ({
  logError: vi.fn(),
}));

import {
  clampCap,
  resolveCap,
  enforceChatSubmitWindow,
  DEFAULT_CHAT_SUBMIT_CAP,
  MIN_CHAT_SUBMIT_CAP,
  MAX_CHAT_SUBMIT_CAP,
} from '../chat-submit-window';
import * as db from '../../db/project-chat-submit-db';
import * as opfs from '../../storage/chat-submit-opfs-store';

const countMock = db.countChatSubmits as unknown as ReturnType<typeof vi['fn']>;
const listOldestMock = db.listOldestChatSubmits as unknown as ReturnType<typeof vi['fn']>;
const deleteRowMock = db.deleteChatSubmit as unknown as ReturnType<typeof vi['fn']>;
const deleteOpfsMock = opfs.deleteEntry as unknown as ReturnType<typeof vi['fn']>;

beforeEach(() => {
  vi.clearAllMocks();
  // reset chrome global
  (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
});

describe('clampCap', () => {
  it('returns default for NaN / Infinity', () => {
    expect(clampCap(NaN)).toBe(DEFAULT_CHAT_SUBMIT_CAP);
    expect(clampCap(Infinity)).toBe(DEFAULT_CHAT_SUBMIT_CAP);
  });
  it('floors and clamps to [MIN, MAX]', () => {
    expect(clampCap(5)).toBe(MIN_CHAT_SUBMIT_CAP);
    expect(clampCap(99_999)).toBe(MAX_CHAT_SUBMIT_CAP);
    expect(clampCap(300.9)).toBe(300);
  });
});

describe('resolveCap', () => {
  it('uses override when provided', async () => {
    expect(await resolveCap('p1', 50)).toBe(50);
  });
  it('falls back to default when no chrome storage', async () => {
    expect(await resolveCap('p1')).toBe(DEFAULT_CHAT_SUBMIT_CAP);
  });
  it('reads Project.ChatSubmitCap.<projectId> from chrome.storage.local', async () => {
    const get = vi.fn().mockResolvedValue({ 'Project.ChatSubmitCap.p1': 42 });
    (globalThis as unknown as { chrome: unknown }).chrome = { storage: { local: { get } } };
    expect(await resolveCap('p1')).toBe(42);
    expect(get).toHaveBeenCalledWith('Project.ChatSubmitCap.p1');
  });
  it('clamps stored value below MIN', async () => {
    const get = vi.fn().mockResolvedValue({ 'Project.ChatSubmitCap.p1': 1 });
    (globalThis as unknown as { chrome: unknown }).chrome = { storage: { local: { get } } };
    expect(await resolveCap('p1')).toBe(MIN_CHAT_SUBMIT_CAP);
  });
});

describe('enforceChatSubmitWindow', () => {
  it('no-ops when count <= cap', async () => {
    countMock.mockResolvedValue(50);
    const r = await enforceChatSubmitWindow('p1', 300);
    expect(r).toEqual({ cap: 300, countBefore: 50, prunedCount: 0, failedCount: 0 });
    expect(listOldestMock).not.toHaveBeenCalled();
  });

  it('prunes exact excess (count - cap) oldest rows', async () => {
    countMock.mockResolvedValue(303);
    listOldestMock.mockResolvedValue([
      { Id: 1, FileId: 'f1' }, { Id: 2, FileId: 'f2' }, { Id: 3, FileId: 'f3' },
    ]);
    deleteOpfsMock.mockResolvedValue(true);
    deleteRowMock.mockResolvedValue(true);
    const r = await enforceChatSubmitWindow('p1', 300);
    expect(listOldestMock).toHaveBeenCalledWith('p1', 3);
    expect(r.prunedCount).toBe(3);
    expect(r.failedCount).toBe(0);
  });

  it('counts failed OPFS deletes without deleting the row (avoids orphan blob)', async () => {
    countMock.mockResolvedValue(301);
    listOldestMock.mockResolvedValue([{ Id: 9, FileId: 'fx' }]);
    deleteOpfsMock.mockResolvedValue(false);
    const r = await enforceChatSubmitWindow('p1', 300);
    expect(deleteRowMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ prunedCount: 0, failedCount: 1 });
  });

  it('counts failed row-delete as failed even after OPFS success', async () => {
    countMock.mockResolvedValue(301);
    listOldestMock.mockResolvedValue([{ Id: 9, FileId: 'fx' }]);
    deleteOpfsMock.mockResolvedValue(true);
    deleteRowMock.mockResolvedValue(false);
    const r = await enforceChatSubmitWindow('p1', 300);
    expect(r).toMatchObject({ prunedCount: 0, failedCount: 1 });
  });

  it('uses DEFAULT cap when no override + no storage', async () => {
    countMock.mockResolvedValue(299);
    const r = await enforceChatSubmitWindow('p1');
    expect(r.cap).toBe(DEFAULT_CHAT_SUBMIT_CAP);
  });
});
