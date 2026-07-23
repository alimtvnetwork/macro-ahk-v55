/**
 * Startup validation: detect and disable duplicate Read Memory prompts.
 *
 * Verifies:
 * - No-op when zero duplicates are found (no writes, no cache clear).
 * - Demotes duplicates via UPDATE (IsDefault = 0, Name prefixed with
 *   `[duplicate] `) and invalidates the IndexedDB JsonCopy cache.
 * - Never touches the canonical `read-memory-enhanced` slug.
 * - Idempotent: rows already prefixed are excluded from the match.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
interface QueuedResponse { isOk: boolean; rows?: unknown[]; errorMessage?: string }

const captured: CapturedCall[] = [];
let responsesQueue: QueuedResponse[] = [];
const clearPromptCacheSpy = vi.fn(async () => { /* void */ });

vi.mock('../extension-bridge', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return responsesQueue.shift() ?? { isOk: true };
    }),
}));
vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
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

import {
    validateAndDisableReadMemoryDuplicates,
    READ_MEMORY_CANONICAL_SLUG_FOR_TEST,
    READ_MEMORY_DUPLICATE_PREFIX_FOR_TEST,
} from '../validate-read-memory-duplicates';

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    clearPromptCacheSpy.mockClear();
});

describe('validateAndDisableReadMemoryDuplicates', () => {
    it('is a no-op when no duplicate rows are found', async () => {
        responsesQueue = [{ isOk: true, rows: [] }];
        const report = await validateAndDisableReadMemoryDuplicates();
        expect(report).toEqual({ detected: 0, disabled: 0, slugs: [] });
        expect(captured).toHaveLength(1);
        expect(captured[0]?.method).toBe('QUERY');
        expect(clearPromptCacheSpy).not.toHaveBeenCalled();
    });

    it('demotes duplicates, prefixes Name, and clears the cache', async () => {
        responsesQueue = [
            {
                isOk: true,
                rows: [
                    { Id: 11, Slug: 'read-memory-v2', Name: 'Read Memory v2' },
                    { Id: 22, Slug: 'rejog-the-memory-v1', Name: 'Rejog the Memory v1' },
                ],
            },
            { isOk: true },
        ];
        const report = await validateAndDisableReadMemoryDuplicates();
        expect(report.detected).toBe(2);
        expect(report.disabled).toBe(2);
        expect(report.slugs).toEqual(['read-memory-v2', 'rejog-the-memory-v1']);
        expect(captured).toHaveLength(2);
        const updateSql = captured[1]?.sql ?? '';
        expect(captured[1]?.method).toBe('SCHEMA');
        expect(updateSql).toContain('UPDATE Prompt');
        expect(updateSql).toContain('IsDefault = 0');
        expect(updateSql).toContain(READ_MEMORY_DUPLICATE_PREFIX_FOR_TEST);
        expect(updateSql).toContain('Id IN (11, 22)');
        expect(clearPromptCacheSpy).toHaveBeenCalledOnce();
    });

    it('excludes the canonical slug and already-prefixed rows from the match', async () => {
        responsesQueue = [{ isOk: true, rows: [] }];
        await validateAndDisableReadMemoryDuplicates();
        const querySql = captured[0]?.sql ?? '';
        expect(querySql).toContain("Slug <> '" + READ_MEMORY_CANONICAL_SLUG_FOR_TEST + "'");
        expect(querySql).toContain("Name NOT LIKE '" + READ_MEMORY_DUPLICATE_PREFIX_FOR_TEST + "%'");
    });

    it('reports partial disable when the UPDATE fails', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ Id: 5, Slug: 'read-memory-old', Name: 'Read Memory Old' }] },
            { isOk: false, errorMessage: 'boom' },
        ];
        const report = await validateAndDisableReadMemoryDuplicates();
        expect(report.detected).toBe(1);
        expect(report.disabled).toBe(0);
        expect(clearPromptCacheSpy).not.toHaveBeenCalled();
    });
});
