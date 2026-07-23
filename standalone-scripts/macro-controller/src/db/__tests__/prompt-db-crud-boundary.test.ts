/**
 * Plan-22 steps 11..23: prompt-crud pos/neg boundary + DB-error tests.
 *
 * Existing `prompt-db.test.ts` covers happy paths and token-guard branches.
 * This file locks the RCA-critical failure surfaces that would otherwise be
 * caught only in prod:
 *
 *  - `sendToExtension` returning `{ isOk: false, error }` MUST propagate
 *    into `{ ok: false, error }` for every mutation (never silently succeed).
 *  - `deletePromptById` must reject non-integer / negative ids before any
 *    DB round-trip (defence-in-depth against caller drift).
 *  - `getDefaultPromptForRole` must reject an invalid role without DB I/O.
 *  - Empty-required-field errors mention the exact field name so the UI
 *    can point the user at what to fix.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let nextResponse: Record<string, unknown> = { isOk: true, rows: [] };
let responsesQueue: Record<string, unknown>[] | null = null;

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

import {
    listPromptsByRole, getDefaultPromptForRole, setDefaultPromptForRole,
    upsertPrompt, deletePromptById,
} from '../prompt-db';

beforeEach(() => {
    captured.length = 0;
    nextResponse = { isOk: true, rows: [] };
    responsesQueue = null;
});

describe('prompt-db negative: DB-layer errors propagate to caller', () => {
    it('listPromptsByRole returns ok=false when driver reports isOk=false', async () => {
        nextResponse = { isOk: false, error: 'sql: table Prompt missing' };
        const r = await listPromptsByRole('plan');
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/query failed|table Prompt missing/);
    });

    it('upsertPrompt INSERT surfaces DB error (never returns ok=true)', async () => {
        nextResponse = { isOk: false, error: 'UNIQUE constraint failed: Prompt.Slug' };
        const r = await upsertPrompt({ slug: 'dup', name: 'n', body: 'b', role: 'generic' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/write failed|UNIQUE constraint failed/);
    });

    it('upsertPrompt UPDATE surfaces DB error and does not swallow it', async () => {
        nextResponse = { isOk: false, error: 'disk I/O error' };
        const r = await upsertPrompt({ id: 4, slug: 's', name: 'n', body: 'b', role: 'generic' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/write failed|disk I\/O error/);
    });

    it('setDefaultPromptForRole propagates transactional flip failure', async () => {
        nextResponse = { isOk: false, error: 'transaction rolled back' };
        const r = await setDefaultPromptForRole(9, 'next');
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/enforceSingleDefaultPerRole failed|transaction rolled back/);
    });

    it('deletePromptById propagates DB error from the DELETE stage', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ Id: 2, Slug: 's', Name: 'n', Body: 'b', Role: 'next', IsDefault: 0, CreatedAt: 1, UpdatedAt: 1 }] },
            { isOk: true, rows: [{ c: 4 }] },
            { isOk: false, error: 'row is locked' },
        ];
        const r = await deletePromptById(2);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/delete failed|row is locked/);
    });
});

describe('prompt-db negative: input validation short-circuits before DB I/O', () => {
    it('deletePromptById rejects negative id without DB round-trip', async () => {
        const r = await deletePromptById(-1);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('deletePromptById rejects NaN id without DB round-trip', async () => {
        const r = await deletePromptById(Number.NaN);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('getDefaultPromptForRole rejects invalid role without DB round-trip', async () => {
        const r = await getDefaultPromptForRole('unknown' as never);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('setDefaultPromptForRole rejects invalid role without DB round-trip', async () => {
        const r = await setDefaultPromptForRole(1, 'x' as never);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('upsertPrompt empty-field error names the missing field (name)', async () => {
        const r = await upsertPrompt({ slug: 's', name: '', body: 'b', role: 'plan' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/name/);
    });

    it('upsertPrompt empty-field error names the missing field (body)', async () => {
        const r = await upsertPrompt({ slug: 's', name: 'n', body: '', role: 'plan' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/body/);
    });
});

describe('prompt-db positive: full happy-path integration for a plan-role edit', () => {
    it('upsertPrompt UPDATE with token-preserving edit writes body + replace columns', async () => {
        nextResponse = { isOk: true };
        const r = await upsertPrompt({
            id: 12, slug: 'plan-a', name: 'Plan A', role: 'plan',
            previousBody: 'Step {{n}} of the plan',
            body: 'The plan needs {{n}} steps',
            replaceKey: 'n', replaceValues: ['2', '3', '5'],
        });
        expect(r.ok).toBe(true);
        // v4.187.0: since v4.173.0 upsertPrompt reads the pre-image row
        // BEFORE writing so a rollback is possible. Successful UPDATE with
        // an empty pre-image (rows:[]) therefore emits two DB calls:
        // [0] SELECT * FROM Prompt WHERE Id = ..., [1] UPDATE Prompt SET ...
        // Revision INSERT is skipped because preImage is null.
        expect(captured).toHaveLength(2);
        expect(captured[0].sql).toMatch(/^SELECT \* FROM Prompt WHERE Id = 12/);
        expect(captured[1].sql).toMatch(/^UPDATE Prompt SET/);
        expect(captured[1].sql).toContain('WHERE Id = 12');
        expect(captured[1].sql).toMatch(/ReplaceKey = 'n'/);
        expect(captured[1].sql).toMatch(/ReplaceValues = '\["2","3","5"\]'/);
    });

    it('listPromptsByRole -> setDefaultPromptForRole -> deletePromptById chain', async () => {
        // 1) list
        responsesQueue = [
            { isOk: true, rows: [
                { Id: 1, Slug: 'a', Name: 'A', Body: 'b1', Role: 'next', IsDefault: 1, CreatedAt: 1, UpdatedAt: 2 },
                { Id: 2, Slug: 'b', Name: 'B', Body: 'b2', Role: 'next', IsDefault: 0, CreatedAt: 1, UpdatedAt: 3 },
            ] },
        ];
        const list = await listPromptsByRole('next');
        expect(list.ok).toBe(true);
        expect(list.value).toHaveLength(2);

        // 2) flip default
        responsesQueue = [{ isOk: true }];
        const flip = await setDefaultPromptForRole(2, 'next');
        expect(flip.ok).toBe(true);

        // 3) delete non-default row (row count > 1 -> allowed)
        responsesQueue = [
            { isOk: true, rows: [{ Id: 1, Slug: 'a', Name: 'A', Body: 'b1', Role: 'next', IsDefault: 0, CreatedAt: 1, UpdatedAt: 4 }] },
            { isOk: true, rows: [{ c: 2 }] },
            { isOk: true },
        ];
        const del = await deletePromptById(1);
        expect(del.ok).toBe(true);
    });
});
