/**
 * Plan-15 Task 17: `upsertPrompt` rename acceptance via `previousReplaceKey`.
 *
 * Locks the contract that the DB layer forwards `{ oldKey, newKey }` into
 * `assertParamTokensUnchanged`, so:
 *   - `{{n}}` -> `{{count}}` (with `previousReplaceKey='n'` and
 *     `replaceKey='count'`) is accepted.
 *   - Dropping `{{n}}` entirely (no rename) still fails with a token drift error.
 *   - Cross-role guard is inert (generic role never blocks).
 *   - Missing `previousBody` skips the guard even for plan/next.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../error-utils', () => ({ logError: vi.fn(), logDiagnosticFromCode: vi.fn() }));

const sendMock = vi.hoisted(() => vi.fn());
vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({ sendToExtension: sendMock }));
vi.mock('../extension-bridge', () => ({ sendToExtension: sendMock }));
vi.mock('../prompt-role-db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../prompt-role-db');
    return { ...actual };
});

import { upsertPrompt } from '../prompt-db';

beforeEach(() => {
    sendMock.mockReset();
    // Default: every rawSql call succeeds and returns lastInsertId=42.
    sendMock.mockImplementation(async () => ({ isOk: true, rows: [], lastInsertId: 42 }));
});

describe('upsertPrompt: token rename acceptance', () => {
    it('accepts `{{n}}` -> `{{count}}` when previousReplaceKey=n and replaceKey=count', async () => {
        const res = await upsertPrompt({
            id: 1, slug: 'plan-default', name: 'Plan default',
            body: 'Give me the next {{count}} steps',
            role: 'plan',
            previousBody: 'Give me the next {{n}} steps',
            previousReplaceKey: 'n',
            replaceKey: 'count',
            replaceValues: ['3', '5', '8'],
        });
        expect(res.ok).toBe(true);
        expect(res.error).toBeUndefined();
        // The write actually ran (SCHEMA call issued).
        const schemaCalls = sendMock.mock.calls.filter(([, p]) => (p as { method: string }).method === 'SCHEMA');
        expect(schemaCalls.length).toBeGreaterThanOrEqual(1);
        const sql = (schemaCalls[0][1] as { params: { sql: string } }).params.sql;
        expect(sql).toMatch(/UPDATE Prompt/);
        expect(sql).toContain("ReplaceKey = 'count'");
    });

    it('rejects a plan edit that drops `{{n}}` entirely (no rename supplied)', async () => {
        const res = await upsertPrompt({
            id: 1, slug: 'plan-default', name: 'Plan default',
            body: 'Give me the next steps',
            role: 'plan',
            previousBody: 'Give me the next {{n}} steps',
        });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('ParamTokenMismatch');
        expect(res.error).toContain('removed');
        // No SCHEMA call should have fired.
        const schemaCalls = sendMock.mock.calls.filter(([, p]) => (p as { method: string }).method === 'SCHEMA');
        expect(schemaCalls).toHaveLength(0);
    });

    it('rejects a rename that changes token count (e.g. two {{n}} -> one {{count}})', async () => {
        const res = await upsertPrompt({
            id: 1, slug: 'plan-default', name: 'Plan default',
            body: 'Next {{count}} tasks',
            role: 'plan',
            previousBody: 'Next {{n}} tasks in {{n}} minutes',
            previousReplaceKey: 'n',
            replaceKey: 'count',
        });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('ParamTokenMismatch');
    });

    it('skips the token guard when role is generic (never blocks)', async () => {
        const res = await upsertPrompt({
            id: 9, slug: 'generic-x', name: 'Generic',
            body: 'no tokens here',
            role: 'generic',
            previousBody: 'previously had {{n}} tokens',
        });
        expect(res.ok).toBe(true);
    });

    it('skips the token guard when previousBody is missing (fresh insert path)', async () => {
        const res = await upsertPrompt({
            slug: 'plan-new', name: 'Plan new',
            body: 'Body with {{n}}',
            role: 'plan',
        });
        expect(res.ok).toBe(true);
    });
});
