/**
 * Tests for prompt-db.ts CRUD (plan-14, step 5).
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

describe('listPromptsByRole', () => {
    it('emits SELECT scoped by Role with correct ORDER BY', async () => {
        nextResponse = { isOk: true, rows: [
            { Id: 1, Slug: 'plan-default', Name: 'Plan default', Body: '# Plan {{n}}', Role: 'plan', IsDefault: 1, CreatedAt: 10, UpdatedAt: 20 },
        ]};
        const r = await listPromptsByRole('plan');
        expect(r.ok).toBe(true);
        expect(r.value).toHaveLength(1);
        expect(r.value?.[0].Slug).toBe('plan-default');
        expect(captured[0].sql).toBe(
            "SELECT * FROM Prompt WHERE Role = 'plan' ORDER BY IsDefault DESC, UpdatedAt DESC"
        );
    });

    it('rejects invalid role without touching DB', async () => {
        const r = await listPromptsByRole('bogus' as never);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });
});

describe('getDefaultPromptForRole', () => {
    it('returns the single IsDefault=1 row', async () => {
        nextResponse = { isOk: true, rows: [
            { Id: 3, Slug: 'next-default', Name: 'Next', Body: 'go', Role: 'next', IsDefault: 1, CreatedAt: 1, UpdatedAt: 2 },
        ]};
        const r = await getDefaultPromptForRole('next');
        expect(r.ok).toBe(true);
        expect(r.value?.Id).toBe(3);
        expect(captured[0].sql).toBe("SELECT * FROM Prompt WHERE Role = 'next' AND IsDefault = 1 LIMIT 1");
    });

    it('returns undefined when no default set (ok=true, value=undefined)', async () => {
        nextResponse = { isOk: true, rows: [] };
        const r = await getDefaultPromptForRole('plan');
        expect(r.ok).toBe(true);
        expect(r.value).toBeUndefined();
    });
});

describe('setDefaultPromptForRole', () => {
    it('delegates to enforceSingleDefaultPerRole (transactional flip)', async () => {
        const r = await setDefaultPromptForRole(5, 'plan');
        expect(r.ok).toBe(true);
        expect(captured[0].sql).toMatch(/BEGIN TRANSACTION/);
        expect(captured[0].sql).toMatch(/UPDATE Prompt SET IsDefault = 1 WHERE Id = 5 AND Role = 'plan'/);
    });
});

describe('upsertPrompt', () => {
    it('INSERTs a new row when id is omitted', async () => {
        nextResponse = { isOk: true, lastInsertId: 42 };
        const r = await upsertPrompt({ slug: 's', name: 'n', body: 'b', role: 'generic' });
        expect(r.ok).toBe(true);
        expect(r.value).toBe(42);
        expect(captured[0].sql).toMatch(/^INSERT INTO Prompt/);
        expect(captured[0].sql).toContain("'generic'");
    });

    it('resolves the inserted row id by slug when rawSql omits lastInsertId', async () => {
        responsesQueue = [
            { isOk: true, rows: [] },
            { isOk: true, rows: [{ Id: 88 }] },
        ];
        const r = await upsertPrompt({ slug: 'plan-default', name: 'Plan', body: 'body {{n}}', role: 'plan' });
        expect(r.ok).toBe(true);
        expect(r.value).toBe(88);
        expect(captured[0].sql).toMatch(/^INSERT INTO Prompt/);
        expect(captured[1].sql).toBe("SELECT Id FROM Prompt WHERE Slug = 'plan-default' AND Role = 'plan' LIMIT 1");
    });

    it('UPDATEs when id is provided', async () => {
        const r = await upsertPrompt({ id: 7, slug: 's', name: 'n', body: 'b', role: 'plan' });
        expect(r.ok).toBe(true);
        expect(r.value).toBe(7);
        // v4.173.0: upsertPrompt now reads the pre-image row before writing so
        // it can snapshot the previous body into PromptRevision for rollback.
        // The UPDATE is therefore no longer index 0; find it explicitly.
        const updateCall = captured.find(c => c.sql.startsWith('UPDATE Prompt SET'));
        expect(updateCall).toBeDefined();
        expect(updateCall?.sql).toContain('WHERE Id = 7');
    });

    it('rejects empty required fields with a specific error and no DB write', async () => {
        const r = await upsertPrompt({ slug: '', name: 'n', body: 'b', role: 'plan' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/slug/);
        expect(captured).toHaveLength(0);
    });

    it('rejects invalid role', async () => {
        const r = await upsertPrompt({ slug: 's', name: 'n', body: 'b', role: 'nope' as never });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/);
    });

    it('blocks token drift when previousBody is provided for plan/next role', async () => {
        const r = await upsertPrompt({
            id: 1, slug: 's', name: 'n', role: 'plan',
            previousBody: 'hi {{count}}',
            body: 'hi {{n}}',
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/ParamTokenMismatch/);
        expect(captured).toHaveLength(0);
    });

    it('allows edit when tokens are preserved (reorder)', async () => {
        const r = await upsertPrompt({
            id: 1, slug: 's', name: 'n', role: 'plan',
            previousBody: 'a {{x}} b {{y}}',
            body: 'b {{y}} a {{x}}',
        });
        expect(r.ok).toBe(true);
        expect(captured.some(c => c.sql.startsWith('UPDATE Prompt'))).toBe(true);
    });

    it('does NOT apply token guard to generic role (backwards-compat)', async () => {
        const r = await upsertPrompt({
            id: 1, slug: 's', name: 'n', role: 'generic',
            previousBody: '{{a}}',
            body: 'no tokens',
        });
        expect(r.ok).toBe(true);
    });

    it('persists default ReplaceKey and ReplaceValues on insert when not overridden', async () => {
        nextResponse = { isOk: true, lastInsertId: 1 };
        const r = await upsertPrompt({ slug: 's', name: 'n', body: 'b', role: 'plan' });
        expect(r.ok).toBe(true);
        expect(captured[0].sql).toContain("'n'"); // ReplaceKey literal
        expect(captured[0].sql).toContain('["1","2","3","5","8"]');
    });

    it('honors caller-provided replaceKey and replaceValues on insert', async () => {
        nextResponse = { isOk: true, lastInsertId: 2 };
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b {{count}}', role: 'plan',
            replaceKey: 'count', replaceValues: ['3', '7', '3', ' 9 '],
        });
        expect(r.ok).toBe(true);
        expect(captured[0].sql).toContain("'count'");
        // Deduped + trimmed, order preserved.
        expect(captured[0].sql).toContain('["3","7","9"]');
    });

    it('UPDATE writes ReplaceKey and ReplaceValues columns', async () => {
        const r = await upsertPrompt({
            id: 7, slug: 's', name: 'n', body: 'b', role: 'plan',
            replaceKey: 'k', replaceValues: ['a'],
        });
        expect(r.ok).toBe(true);
        const updateCall = captured.find(c => c.sql.startsWith('UPDATE Prompt SET'));
        expect(updateCall).toBeDefined();
        expect(updateCall?.sql).toMatch(/ReplaceKey = 'k'/);
        expect(updateCall?.sql).toMatch(/ReplaceValues = '\["a"\]'/);
    });

    it('rejects malformed replaceKey without touching DB', async () => {
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b', role: 'plan',
            replaceKey: '9bad',
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/replaceKey/);
        expect(captured).toHaveLength(0);
    });

    it('rejects empty replaceValues without touching DB', async () => {
        const r = await upsertPrompt({
            slug: 's', name: 'n', body: 'b', role: 'plan',
            replaceValues: ['', '  '],
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/replaceValues/);
        expect(captured).toHaveLength(0);
    });
});

describe('rowToPrompt (via listPromptsByRole)', () => {
    it('decodes ReplaceKey and ReplaceValues from SELECT rows', async () => {
        nextResponse = { isOk: true, rows: [{
            Id: 1, Slug: 'plan-default', Name: 'Plan', Body: '# {{count}}',
            Role: 'plan', IsDefault: 1,
            ReplaceKey: 'count', ReplaceValues: '["2","4","8"]',
            CreatedAt: 10, UpdatedAt: 20,
        }] };
        const r = await listPromptsByRole('plan');
        expect(r.ok).toBe(true);
        const row = r.value?.[0];
        expect(row?.ReplaceKey).toBe('count');
        expect(row?.ReplaceValues).toEqual(['2', '4', '8']);
    });

    it('falls back to defaults when legacy rows lack the new columns', async () => {
        nextResponse = { isOk: true, rows: [{
            Id: 1, Slug: 'legacy', Name: 'L', Body: 'b', Role: 'plan', IsDefault: 0,
            CreatedAt: 1, UpdatedAt: 2,
        }] };
        const r = await listPromptsByRole('plan');
        const row = r.value?.[0];
        expect(row?.ReplaceKey).toBe('n');
        expect(row?.ReplaceValues).toEqual(['1', '2', '3', '5', '8']);
    });
});

describe('deletePromptById', () => {
    it('rejects non-positive ids without DB round-trip', async () => {
        const r = await deletePromptById(0);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('refuses to delete the last row for its role', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ Id: 1, Slug: 's', Name: 'n', Body: 'b', Role: 'plan', IsDefault: 1, CreatedAt: 1, UpdatedAt: 1 }] }, // readPromptRow
            { isOk: true, rows: [{ c: 1 }] }, // countRowsForRole
        ];
        const r = await deletePromptById(1);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/last row for role plan/);
        // 2 queries fired, no DELETE
        expect(captured.map(c => c.method)).toEqual(['QUERY', 'QUERY']);
    });

    it('deletes when >1 rows exist for the role', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ Id: 2, Slug: 's', Name: 'n', Body: 'b', Role: 'next', IsDefault: 0, CreatedAt: 1, UpdatedAt: 1 }] },
            { isOk: true, rows: [{ c: 3 }] },
            { isOk: true },
        ];
        const r = await deletePromptById(2);
        expect(r.ok).toBe(true);
        expect(captured[2].sql).toBe('DELETE FROM Prompt WHERE Id = 2');
    });

    it('surfaces "row not found" when the id does not exist', async () => {
        responsesQueue = [{ isOk: true, rows: [] }];
        const r = await deletePromptById(99);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/not found/);
    });
});
