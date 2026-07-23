/**
 * Migration: remove duplicate/legacy Read Memory seed rows.
 *
 * Verifies:
 * - Idempotent no-op when zero legacy rows are present.
 * - Deletes from Prompt + PromptRevision when legacy slugs exist.
 * - Invalidates the IndexedDB JsonCopy cache after deletion.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface CapturedCall { method: string; sql: string }
interface QueuedResponse { isOk: boolean; rows?: unknown[]; errorMessage?: string }

const captured: CapturedCall[] = [];
let responsesQueue: QueuedResponse[] = [];
const clearPromptCacheSpy = vi.fn(async () => { /* void */ });

vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return responsesQueue.shift() ?? { isOk: true };
    }),
}));
vi.mock('../../ui/prompt-cache', () => ({
    clearPromptCache: clearPromptCacheSpy,
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { migrateRemoveLegacyReadMemoryDuplicates, LEGACY_READ_MEMORY_SLUGS_FOR_TEST } from '../migrate-legacy-read-memory';

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    clearPromptCacheSpy.mockClear();
});

describe('migrateRemoveLegacyReadMemoryDuplicates', () => {
    it('is a no-op when no legacy rows exist', async () => {
        responsesQueue = [{ isOk: true, rows: [{ c: 0 }] }];
        await migrateRemoveLegacyReadMemoryDuplicates();
        expect(captured).toHaveLength(1);
        expect(captured[0]?.method).toBe('QUERY');
        expect(clearPromptCacheSpy).not.toHaveBeenCalled();
    });

    it('deletes legacy Prompt + PromptRevision rows and clears cache', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ c: 2 }] },
            { isOk: true },
        ];
        await migrateRemoveLegacyReadMemoryDuplicates();
        expect(captured).toHaveLength(2);
        expect(captured[1]?.method).toBe('SCHEMA');
        const deleteSql = captured[1]?.sql ?? '';
        expect(deleteSql).toContain('DELETE FROM PromptRevision');
        expect(deleteSql).toContain('DELETE FROM Prompt');
        for (const slug of LEGACY_READ_MEMORY_SLUGS_FOR_TEST) {
            expect(deleteSql).toContain("'" + slug + "'");
        }
        expect(deleteSql).toContain("'read-memory-imported'");
        expect(deleteSql).toContain("'read-memory-v2'");
        expect(deleteSql).not.toContain("'read-memory-enhanced'");
        expect(clearPromptCacheSpy).toHaveBeenCalledOnce();
    });

    it('does not throw when the count query fails', async () => {
        responsesQueue = [{ isOk: false, errorMessage: 'boom' }];
        await expect(migrateRemoveLegacyReadMemoryDuplicates()).resolves.toBeUndefined();
    });
});
