/**
 * Plan-22 gap #1 + #3: prompt-db uncovered negative branches.
 *
 * Root cause covered: previous suites exercised DB-driver errors and
 * empty-field validation but skipped four critical guards inside
 * `upsertPrompt` / `deletePromptById` whose regression would silently
 * corrupt data or hide DB errors from the UI:
 *
 *   N1. `upsertPrompt` invalid `role` (validateUpsert branch).
 *   N2. `upsertPrompt` malformed `replaceKey` (resolveReplaceFields).
 *   N3. `upsertPrompt` empty `replaceValues` array (normalizeReplaceValues -> null).
 *   N4. `deletePromptById` last-row guard for a role (must refuse).
 *   N5. `upsertPrompt` INSERT with lastInsertId absent falls back to
 *       `resolveInsertedPromptId` and surfaces its failure as ok:false.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: Record<string, unknown>[] | null = null;
let nextResponse: Record<string, unknown> = { isOk: true, rows: [] };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        if (responsesQueue && responsesQueue.length > 0) return responsesQueue.shift();
        return nextResponse;
    }),
}));
vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        if (responsesQueue && responsesQueue.length > 0) return responsesQueue.shift();
        return nextResponse;
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { upsertPrompt, deletePromptById } from '../prompt-db';

beforeEach(() => {
    captured.length = 0;
    responsesQueue = null;
    nextResponse = { isOk: true, rows: [] };
});

describe('prompt-db negative branches (Plan 22 gap #1 + #3)', () => {
    it('N1: upsertPrompt rejects invalid role without DB round-trip', async () => {
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b', role: 'unknown' as never,
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/);
        expect(captured).toHaveLength(0);
    });

    it('N2: upsertPrompt rejects malformed replaceKey without DB round-trip', async () => {
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b', role: 'plan',
            replaceKey: '1-bad', // leading digit fails REPLACE_KEY_RE
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/replaceKey/);
        expect(captured).toHaveLength(0);
    });

    it('N3: upsertPrompt rejects empty/whitespace-only replaceValues', async () => {
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b', role: 'plan',
            replaceValues: ['', '   '],
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/replaceValues/);
        expect(captured).toHaveLength(0);
    });

    it('N4: deletePromptById refuses to remove the last row for a role', async () => {
        responsesQueue = [
            // readPromptRow(id)
            { isOk: true, rows: [{ Id: 7, Slug: 's', Name: 'n', Body: 'b', Role: 'plan', IsDefault: 1, CreatedAt: 1, UpdatedAt: 2 }] },
            // countRowsForRole('plan') -> 1
            { isOk: true, rows: [{ c: 1 }] },
        ];
        const r = await deletePromptById(7);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/last row for role plan/);
        // no third DELETE call was issued
        expect(captured).toHaveLength(2);
        expect(captured[1].sql).toMatch(/^SELECT COUNT\(\*\)/);
    });

    it('N5: INSERT with missing lastInsertId falls back and surfaces failure', async () => {
        responsesQueue = [
            // INSERT succeeds but driver returns no lastInsertId
            { isOk: true },
            // resolveInsertedPromptId query fails -> returns null
            { isOk: false, error: 'transient read error' },
        ];
        const r = await upsertPrompt({
            slug: 'new-slug', name: 'n', body: 'b', role: 'generic',
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/inserted Prompt Id could not be resolved/);
    });
});
