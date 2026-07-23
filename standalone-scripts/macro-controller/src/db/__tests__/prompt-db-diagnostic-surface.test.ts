/**
 * Plan 22 gap #2: `upsertPrompt` / `deletePromptById` diagnostic-code surface.
 *
 * Root cause pinned: Every failure in `prompt-db.ts` routes through
 * `fail(where, message)` which MUST emit `logDiagnosticFromCode('DB_PROMPT_E001',
 * { where, reason }, context)` before returning `{ ok:false, error }`. A silent
 * regression that skipped the diagnostic (or dropped `where` / `reason`)
 * would still return an error to callers but lose the structured surface
 * the audit/toast layers depend on. No test locked that contract, so this
 * pins the emit + payload shape for every user-visible failure branch.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

const captured: { method: string; sql: string }[] = [];
let nextResp: Record<string, unknown> = { isOk: true, rows: [], lastInsertId: 1 };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return nextResp;
    }),
}));
vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return nextResp;
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: vi.fn(), logError: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { logDiagnosticFromCode } from '../../error-utils';
const logDiagnosticMock = logDiagnosticFromCode as unknown as Mock;
import { upsertPrompt, deletePromptById } from '../prompt-db';

beforeEach(() => {
    captured.length = 0;
    logDiagnosticMock.mockReset();
    nextResp = { isOk: true, rows: [], lastInsertId: 1 };
});

function pickWhere(): string | undefined {
    const call = logDiagnosticMock.mock.calls[0];
    if (!call) return undefined;
    const context = call[1] as { where?: string };
    return context.where;
}
function pickCode(): string | undefined {
    const call = logDiagnosticMock.mock.calls[0];
    return call ? (call[0] as string) : undefined;
}

describe('prompt-db diagnostic surface (Plan 22 gap #2)', () => {
    it('D1: upsertPrompt invalid role emits DB_PROMPT_E001 with where=upsertPrompt', async () => {
        const r = await upsertPrompt({
            // @ts-expect-error - invalid role by contract
            slug: 's', name: 'n', role: 'garbage', body: 'x',
        });
        expect(r.ok).toBe(false);
        expect(pickCode()).toBe('DB_PROMPT_E001');
        expect(pickWhere()).toBe('upsertPrompt');
    });

    it('D2: upsertPrompt token-guard failure emits diagnostic and skips runSql', async () => {
        const r = await upsertPrompt({
            slug: 'plan-default', name: 'Plan', role: 'plan',
            previousBody: 'do {{n}} steps', body: 'no tokens',
        });
        expect(r.ok).toBe(false);
        expect(pickCode()).toBe('DB_PROMPT_E001');
        expect(pickWhere()).toBe('upsertPrompt');
        expect(captured).toHaveLength(0);
    });

    it('D3: upsertPrompt SQL failure surfaces DB errorMessage in reason', async () => {
        nextResp = { isOk: false, errorMessage: 'disk I/O failure' };
        const r = await upsertPrompt({ slug: 's', name: 'n', role: 'generic', body: 'x' });
        expect(r.ok).toBe(false);
        expect(pickCode()).toBe('DB_PROMPT_E001');
        const context = logDiagnosticMock.mock.calls[0][1] as { where?: string; reason?: string };
        expect(context.where).toBe('upsertPrompt');
        expect(context.reason).toContain('disk I/O');
    });

    it('D4: deletePromptById non-integer id emits DB_PROMPT_E001 with where=deletePromptById', async () => {
        const r = await deletePromptById(0);
        expect(r.ok).toBe(false);
        expect(pickCode()).toBe('DB_PROMPT_E001');
        expect(pickWhere()).toBe('deletePromptById');
        expect(captured).toHaveLength(0);
    });

    it('D5: successful upsert emits NO diagnostic (positive baseline: no false-positive logs)', async () => {
        nextResp = { isOk: true, rows: [], lastInsertId: 42 };
        const r = await upsertPrompt({ slug: 's', name: 'n', role: 'generic', body: 'x' });
        expect(r.ok).toBe(true);
        expect(logDiagnosticMock).not.toHaveBeenCalled();
    });
});
