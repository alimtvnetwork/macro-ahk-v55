import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CachedPromptEntry } from '../prompt-cache';
import { performPromptImport } from '../prompt-io';
import { DbCommitResults } from '../prompt-io-db-bridge';

// Mock DB Bridge
const commitDbEntriesMock = vi.hoisted(() => vi.fn<[readonly CachedPromptEntry[]], Promise<DbCommitResults>>());
vi.mock('../prompt-io-db-bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../prompt-io-db-bridge')>();

  return {
    ...actual,
    commitDbEntries: commitDbEntriesMock,
  };
});

// Mock Cache
const readJsonCopyMock = vi.hoisted(() => vi.fn());
const writeJsonCopyMock = vi.hoisted(() => vi.fn());
const clearPromptCacheMock = vi.hoisted(() => vi.fn());
vi.mock('../prompt-cache', () => ({
  readJsonCopy: readJsonCopyMock,
  writeJsonCopy: writeJsonCopyMock,
  clearPromptCache: clearPromptCacheMock,
}));

// Mock Loader
const invalidatePromptCacheMock = vi.hoisted(() => vi.fn());
vi.mock('../prompt-loader', () => ({
  invalidatePromptCache: invalidatePromptCacheMock,
}));

// Mock Drag Order
const savePromptOrderMock = vi.hoisted(() => vi.fn());
vi.mock('../prompt-drag-order', () => ({
  savePromptOrder: savePromptOrderMock,
}));

// Provide minimal imports for revision DB
vi.mock('../../db/prompt-revision-db', () => ({
  insertImportedRevisions: vi.fn().mockResolvedValue({ isSuccess: true, isFail: false }),
}));

describe('prompt-io import integration (Gap 9)', () => {
  beforeEach(() => {
    commitDbEntriesMock.mockReset();
    commitDbEntriesMock.mockResolvedValue({ upserted: 1, errors: [], defaultsProtected: 0 });

    readJsonCopyMock.mockReset();
    readJsonCopyMock.mockResolvedValue({ entries: [] });

    writeJsonCopyMock.mockReset();
    writeJsonCopyMock.mockResolvedValue(undefined);

    clearPromptCacheMock.mockReset();
    clearPromptCacheMock.mockResolvedValue(undefined);

    invalidatePromptCacheMock.mockReset();
    savePromptOrderMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects imported bundle into DB and UI cache within the same tick', async () => {
    const entries: CachedPromptEntry[] = [
      { name: 'Plan', text: 'Plan steps', slug: 'plan', role: 'plan', isDefault: false, category: 'G' }
    ];

    const results = await performPromptImport(entries, {});

    // 1. Bundle -> DB
    expect(commitDbEntriesMock).toHaveBeenCalledTimes(1);
    expect(commitDbEntriesMock.mock.calls[0][0][0].slug).toBe('plan');

    // 2. Bundle -> Cache
    expect(writeJsonCopyMock).toHaveBeenCalledTimes(1);
    expect(clearPromptCacheMock).toHaveBeenCalledTimes(1);

    // 3. Cache -> UI reflect
    expect(invalidatePromptCacheMock).toHaveBeenCalledTimes(1);

    // Should finish ok
    expect(results.errors).toHaveLength(0);
    expect(results.updated).toBe(1);
  });
});
