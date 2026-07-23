/**
 * prompt-role-scope-validation.test.ts
 *
 * Access-control regression tests for the Prompt table role scoping.
 *
 * Guarantees exercised:
 *  1. Every CRUD entry point that accepts a `role` argument rejects any
 *     value outside `PROMPT_ROLES` before touching the DB, and returns a
 *     clear, non-empty error string that names the offending value.
 *  2. Every valid role (`plan`, `next`, `generic`) is accepted and
 *     produces SQL that is scoped by that role literal (no cross-role
 *     leakage).
 *  3. Malicious role payloads (SQL injection, prototype pollution,
 *     wrong types) are rejected as "invalid role" and never reach the
 *     rawSql channel, i.e. the guard is a hard gate, not a filter.
 *  4. `enforceSingleDefaultPerRole` refuses non-positive / non-integer
 *     `keepId` values with a clear error and no DB write.
 *
 * The suite mocks the extension bridge so we can assert whether the
 * guard admitted or refused each call by inspecting `captured`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let nextResponse: Record<string, unknown> = { isOk: true, rows: [] };

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

import { PROMPT_ROLES, type PromptRole } from '../../types/prompt-role';
import {
    listPromptsByRole,
    getDefaultPromptForRole,
    setDefaultPromptForRole,
    upsertPrompt,
} from '../prompt-db';
import { enforceSingleDefaultPerRole } from '../prompt-role-db';

beforeEach(() => {
    captured.length = 0;
    nextResponse = { isOk: true, rows: [] };
});

/** Values that must all be rejected as invalid roles. Includes SQL-injection
 *  probes, wrong casings, wrong types, and boundary strings. */
const INVALID_ROLES: readonly unknown[] = [
    '',
    ' ',
    'PLAN',
    'Plan',
    'admin',
    'root',
    'bogus',
    "plan'; DROP TABLE Prompt; --",
    'plan OR 1=1',
    'plan,next',
    'next ',
    ' next',
    null,
    undefined,
    0,
    1,
    true,
    false,
    {},
    [],
    { role: 'plan' },
];

describe('role-scope validation - invalid roles are rejected before DB', () => {
    it.each(INVALID_ROLES)('listPromptsByRole rejects %p without emitting SQL', async (bad) => {
        const r = await listPromptsByRole(bad as PromptRole);
        expect(r.ok).toBe(false);
        expect(r.error).toBeTruthy();
        expect(r.error).toMatch(/invalid role/i);
        expect(captured).toHaveLength(0);
    });

    it.each(INVALID_ROLES)('getDefaultPromptForRole rejects %p without emitting SQL', async (bad) => {
        const r = await getDefaultPromptForRole(bad as PromptRole);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/i);
        expect(captured).toHaveLength(0);
    });

    it.each(INVALID_ROLES)('setDefaultPromptForRole rejects %p without emitting SQL', async (bad) => {
        const r = await setDefaultPromptForRole(1, bad as PromptRole);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/i);
        expect(captured).toHaveLength(0);
    });

    it.each(INVALID_ROLES)('enforceSingleDefaultPerRole rejects %p without emitting SQL', async (bad) => {
        const r = await enforceSingleDefaultPerRole(bad as PromptRole, 1);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/i);
        expect(captured).toHaveLength(0);
    });

    it.each(INVALID_ROLES)('upsertPrompt rejects role %p without emitting SQL', async (bad) => {
        const r = await upsertPrompt({
            slug: 'x', name: 'X', body: 'B', role: bad as PromptRole,
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/invalid role/i);
        expect(captured).toHaveLength(0);
    });
});

describe('role-scope validation - every valid role is accepted and scoped', () => {
    it('PROMPT_ROLES is the exact set the guards accept (no drift)', () => {
        expect([...PROMPT_ROLES].sort()).toEqual(['generic', 'next', 'plan']);
    });

    it.each(PROMPT_ROLES)('listPromptsByRole(%s) emits SELECT scoped by that role literal', async (role) => {
        const r = await listPromptsByRole(role);
        expect(r.ok).toBe(true);
        expect(captured).toHaveLength(1);
        expect(captured[0].sql).toContain("WHERE Role = '" + role + "'");
        // No other role literal leaks into the query.
        for (const other of PROMPT_ROLES) {
            if (other !== role) {
                expect(captured[0].sql).not.toContain("'" + other + "'");
            }
        }
    });

    it.each(PROMPT_ROLES)('getDefaultPromptForRole(%s) filters by that role AND IsDefault = 1', async (role) => {
        const r = await getDefaultPromptForRole(role);
        expect(r.ok).toBe(true);
        expect(captured[0].sql).toContain("WHERE Role = '" + role + "'");
        expect(captured[0].sql).toContain('IsDefault = 1');
    });

    it.each(PROMPT_ROLES)('enforceSingleDefaultPerRole(%s, 42) scopes BOTH UPDATEs by role', async (role) => {
        const r = await enforceSingleDefaultPerRole(role, 42);
        expect(r.ok).toBe(true);
        const sql = captured[0].sql;
        expect(sql).toContain("UPDATE Prompt SET IsDefault = 0 WHERE Role = '" + role + "' AND Id <> 42");
        expect(sql).toContain("UPDATE Prompt SET IsDefault = 1 WHERE Id = 42 AND Role = '" + role + "'");
    });
});

describe('role-scope validation - error message shape', () => {
    it('names the offending role value in the error string', async () => {
        const r = await listPromptsByRole('admin' as PromptRole);
        expect(r.ok).toBe(false);
        expect(r.error).toContain('admin');
    });

    it('rejects non-positive keepId with a clear error and no SQL', async () => {
        for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            captured.length = 0;
            const r = await enforceSingleDefaultPerRole('plan', bad);
            expect(r.ok).toBe(false);
            expect(r.error).toMatch(/positive integer/);
            expect(captured).toHaveLength(0);
        }
    });

    it('rejects SQL-injection role payload without executing it', async () => {
        const evil = "plan'; DROP TABLE Prompt; --";
        const r = await listPromptsByRole(evil as PromptRole);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
        // Sanity: the invalid role never becomes a SQL fragment anywhere.
        expect(captured.some((c) => c.sql.includes('DROP'))).toBe(false);
    });
});
