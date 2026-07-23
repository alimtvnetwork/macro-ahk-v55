/**
 * Tests for Prompt table schema migration + enforceSingleDefaultPerRole
 * (plan-14, steps 3 + 4).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let nextResponse: Record<string, unknown> = { isOk: true };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return nextResponse;
    }),
}));
vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return nextResponse;
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { initMacroDb } from '../macro-db';
import { enforceSingleDefaultPerRole } from '../prompt-role-db';

beforeEach(() => { captured.length = 0; nextResponse = { isOk: true }; });

describe('Prompt table schema (step 3)', () => {
    it('initMacroDb schema string creates Prompt with Role + IsDefault + composite index', async () => {
        await initMacroDb();
        // captured[0] is the schema-init call; later entries are the plan/next seeder (step 9).
        expect(captured.length).toBeGreaterThanOrEqual(1);
        const sql = captured[0].sql;
        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS Prompt/);
        expect(sql).toMatch(/Role TEXT NOT NULL DEFAULT 'generic'/);
        expect(sql).toMatch(/IsDefault INTEGER NOT NULL DEFAULT 0/);
        expect(sql).toMatch(/Slug TEXT NOT NULL UNIQUE/);
        expect(captured.some((entry) => entry.sql.includes('idx_prompt_role_isdefault'))).toBe(true);
    });

    it('initMacroDb is idempotent (all CREATE statements use IF NOT EXISTS)', async () => {
        await initMacroDb();
        const sql = captured[0].sql;
        const createStmts = sql.match(/CREATE TABLE(?! IF NOT EXISTS)/g);
        expect(createStmts).toBeNull();
    });
});

describe('enforceSingleDefaultPerRole (step 4)', () => {
    it('emits a BEGIN/COMMIT block with a clear-others UPDATE and a set-one UPDATE', async () => {
        const result = await enforceSingleDefaultPerRole('plan', 7);
        expect(result.ok).toBe(true);
        expect(captured).toHaveLength(1);
        const sql = captured[0].sql;
        expect(sql).toMatch(/^BEGIN TRANSACTION;/);
        expect(sql).toMatch(/UPDATE Prompt SET IsDefault = 0 WHERE Role = 'plan' AND Id <> 7;/);
        expect(sql).toMatch(/UPDATE Prompt SET IsDefault = 1 WHERE Id = 7 AND Role = 'plan';/);
        expect(sql).toMatch(/COMMIT;$/);
    });

    it('rejects unknown roles before touching the DB', async () => {
        const result = await enforceSingleDefaultPerRole('bogus' as never, 1);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/invalid role/);
        expect(captured).toHaveLength(0);
    });

    it('rejects non-positive / non-integer keepId', async () => {
        for (const bad of [0, -1, 1.5, Number.NaN]) {
            const r = await enforceSingleDefaultPerRole('next', bad);
            expect(r.ok).toBe(false);
            expect(r.error).toMatch(/positive integer/);
        }
        expect(captured).toHaveLength(0);
    });

    it('surfaces driver errors instead of swallowing them', async () => {
        nextResponse = { isOk: false, errorMessage: 'db locked' };
        const r = await enforceSingleDefaultPerRole('next', 3);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/db locked/);
    });

    it('handles all three roles including generic (guard is permissive by design)', async () => {
        for (const role of ['plan', 'next', 'generic'] as const) {
            captured.length = 0;
            const r = await enforceSingleDefaultPerRole(role, 42);
            expect(r.ok).toBe(true);
            expect(captured[0].sql).toContain("Role = '" + role + "'");
        }
    });
});
