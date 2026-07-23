/**
 * Plan 22 gap #4: token-guard integration at `upsertPrompt` (not just as a
 * standalone `assertParamTokensUnchanged` unit).
 *
 * Root cause pinned: `checkTokenGuard` runs inside `upsertPrompt` only for
 * role in ('plan','next') AND when `previousBody` is supplied. That gate,
 * plus the legitimate-rename escape hatch (`previousReplaceKey` + `replaceKey`),
 * had no direct integration test through the public API. A silent regression
 * that (a) skipped the guard for role='next', (b) accepted a token drop as a
 * legitimate rename, or (c) issued a DB round-trip before the guard fired,
 * would corrupt every plan/next default body without any CI signal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let nextResponse: Record<string, unknown> = { isOk: true, rows: [], lastInsertId: 42 };

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

import { upsertPrompt } from '../prompt-db';

beforeEach(() => {
    captured.length = 0;
    nextResponse = { isOk: true, rows: [], lastInsertId: 42 };
});

describe('upsertPrompt token-guard integration (Plan 22 gap #4)', () => {
    it('G1: role=plan blocks a dropped {{n}} token BEFORE any DB write', async () => {
        const r = await upsertPrompt({
            slug: 'plan-default', name: 'Plan', role: 'plan',
            previousBody: 'Task {{n}} of {{n}}',
            body: 'Task of', // both tokens dropped
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/token/i);
        // No SQL round-trip; the guard fires before runSql.
        expect(captured).toHaveLength(0);
    });

    it('G2: role=next enforces the same guard (not plan-only)', async () => {
        const r = await upsertPrompt({
            slug: 'next-default', name: 'Next', role: 'next',
            previousBody: '{{n}} more',
            body: 'no token here',
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/token/i);
        expect(captured).toHaveLength(0);
    });

    it('G3: role=generic bypasses the guard (contract: guard is plan/next only)', async () => {
        const r = await upsertPrompt({
            slug: 'anything', name: 'X', role: 'generic',
            previousBody: '{{n}}',
            body: 'no token here',
        });
        // Generic prompts do not carry the required-token contract; guard
        // MUST NOT block them. Write proceeds and hits the DB.
        expect(r.ok).toBe(true);
        expect(captured.length).toBeGreaterThan(0);
    });

    it('G4: legitimate rename via oldKey/newKey escape hatch does NOT throw', async () => {
        const r = await upsertPrompt({
            slug: 'plan-default', name: 'Plan', role: 'plan',
            previousBody: 'iterate {{n}} times',
            previousReplaceKey: 'n',
            replaceKey: 'count',
            body: 'iterate {{count}} times',
        });
        expect(r.ok).toBe(true);
    });


    it('G5: no previousBody => guard is skipped (new-row create path)', async () => {
        // Missing previousBody means "brand new row"; the guard must not
        // synthesize a mismatch out of thin air.
        const r = await upsertPrompt({
            slug: 'brand-new', name: 'New', role: 'plan',
            body: 'anything without tokens',
        });
        expect(r.ok).toBe(true);
    });

    it('G6: unchanged tokens pass through cleanly (positive baseline)', async () => {
        const r = await upsertPrompt({
            slug: 'plan-default', name: 'Plan', role: 'plan',
            previousBody: 'do {{n}} steps',
            body: 'please do {{n}} steps carefully',
        });
        expect(r.ok).toBe(true);
    });
});
