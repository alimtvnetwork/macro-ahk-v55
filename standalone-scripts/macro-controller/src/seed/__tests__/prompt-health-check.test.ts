/**
 * Tests for the runtime prompt health check (prompt-health-check.ts).
 *
 * Covers:
 *   H1. Healthy state: both defaults present, tokens intact -> ok=true, no toast.
 *   H2. Missing row: getDefaultPromptForRole returns undefined -> row-missing.
 *   H3. Schema drift: body is missing the required {{n}} token -> missing-required-token.
 *   H4. IsDefault=0 -> not-flagged-default.
 *   H5. Query failure surfaces query-failed, never throws.
 *   H6. Report is exposed on window.__marcoPromptHealthReport.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

const toastCalls: Array<{ message: string; level?: string }> = [];
vi.mock('../../toast', () => ({
    showToast: vi.fn((message: string, level?: string) => { toastCalls.push({ message, level }); }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});

// Queue of responses returned by the mocked sendToExtension. Each element is
// consumed in FIFO order by successive DB probes (one per role in
// ROLES_TO_CHECK).
let responsesQueue: unknown[] = [];
vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async () => responsesQueue.shift() ?? { isOk: true, rows: [] }),
}));

import { runPromptHealthCheck } from '../prompt-health-check';
import { PLAN_NEXT_SEED_ROWS } from '../plan-next-prompts';

interface DbShape {
    Id: number; Slug: string; Name: string; Body: string; Role: string;
    IsDefault: number; ReplaceKey: string; ReplaceValues: string;
    CreatedAt: number; UpdatedAt: number;
}
function healthyRow(role: 'plan' | 'next', overrides: Partial<DbShape> = {}): DbShape {
    const seed = PLAN_NEXT_SEED_ROWS.find(r => r.role === role && r.isDefault);
    if (!seed) throw new Error('seed row missing for role=' + role);
    return {
        Id: role === 'plan' ? 1 : 2,
        Slug: seed.slug,
        Name: seed.name,
        Body: seed.body,
        Role: role,
        IsDefault: 1,
        ReplaceKey: '{{n}}',
        ReplaceValues: JSON.stringify(['5', '10', '20']),
        CreatedAt: 1, UpdatedAt: 1,
        ...overrides,
    };
}
const ok = (row: DbShape): unknown => ({ isOk: true, rows: [row] });
const empty = (): unknown => ({ isOk: true, rows: [] });

beforeEach(() => {
    toastCalls.length = 0;
    responsesQueue = [];
    delete (window as unknown as { __marcoPromptHealthReport?: unknown }).__marcoPromptHealthReport;
});

describe('runPromptHealthCheck', () => {
    it('H1: healthy defaults -> ok=true, no toast', async () => {
        responsesQueue = [ok(healthyRow('plan')), ok(healthyRow('next'))];
        const report = await runPromptHealthCheck();
        expect(report.ok).toBe(true);
        expect(report.issues).toEqual([]);
        expect(toastCalls).toEqual([]);
    });

    it('H2: missing default row surfaces row-missing + error toast', async () => {
        responsesQueue = [empty(), ok(healthyRow('next'))];
        const report = await runPromptHealthCheck();
        expect(report.ok).toBe(false);
        const codes = report.issues.map(i => i.code);
        expect(codes).toContain('row-missing');
        expect(toastCalls.length).toBe(1);
        expect(toastCalls[0].level).toBe('error');
    });

    it('H3: body missing required {{n}} token -> missing-required-token', async () => {
        responsesQueue = [
            ok(healthyRow('plan', { Body: 'no token here at all' })),
            ok(healthyRow('next')),
        ];
        const report = await runPromptHealthCheck();
        expect(report.ok).toBe(false);
        const codes = report.issues.map(i => i.code);
        expect(codes).toContain('missing-required-token');
    });

    it('H4: IsDefault=0 -> not-flagged-default', async () => {
        responsesQueue = [
            ok(healthyRow('plan', { IsDefault: 0 })),
            ok(healthyRow('next')),
        ];
        const report = await runPromptHealthCheck();
        expect(report.ok).toBe(false);
        expect(report.issues.map(i => i.code)).toContain('not-flagged-default');
    });

    it('H5: DB query error surfaces query-failed and does not throw', async () => {
        responsesQueue = [{ isOk: false, errorMessage: 'boom' }, ok(healthyRow('next'))];
        const report = await runPromptHealthCheck();
        expect(report.ok).toBe(false);
        const planIssue = report.issues.find(i => i.role === 'plan');
        expect(planIssue?.code).toBe('query-failed');
        expect(planIssue?.detail).toContain('boom');
    });

    it('H6: report is published to window.__marcoPromptHealthReport', async () => {
        responsesQueue = [ok(healthyRow('plan')), ok(healthyRow('next'))];
        await runPromptHealthCheck();
        const published = (window as unknown as { __marcoPromptHealthReport?: { ok: boolean } }).__marcoPromptHealthReport;
        expect(published?.ok).toBe(true);
    });
});
