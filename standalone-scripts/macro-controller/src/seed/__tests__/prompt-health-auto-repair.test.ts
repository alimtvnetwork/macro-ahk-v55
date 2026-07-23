/**
 * Tests for prompt-health-auto-repair.ts (v4.178.0).
 *
 * Covers:
 *   AR1. Healthy on first probe -> no reseed, isHealthy=true, no toast.
 *   AR2. Unhealthy -> idempotent reseed -> second probe healthy: green toast,
 *        NO red toast (first probe was silent), telemetry recovered.
 *   AR3. Unhealthy -> reseed fails: red toast fires from loud second probe,
 *        result.reseedError populated, telemetry failed.
 *   AR4. Unhealthy -> reseed ok but second probe still unhealthy: red toast
 *        fires, telemetry failed, force-mode NEVER invoked.
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

let responsesQueue: unknown[] = [];
vi.mock('../../db/extension-bridge', () => ({
    sendToExtension: vi.fn(async () => responsesQueue.shift() ?? { isOk: true, rows: [] }),
}));
vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async () => responsesQueue.shift() ?? { isOk: true, rows: [] }),
}));

const reseedCalls: Array<{ force?: boolean }> = [];
let reseedResult: { ok: boolean; error?: string; mode: 'idempotent' | 'force' } = { ok: true, mode: 'idempotent' };
vi.mock('../reseed-command', () => ({
    reseedPromptsOnDemand: vi.fn(async (opts?: { force?: boolean }) => {
        reseedCalls.push({ force: opts?.force });
        return reseedResult;
    }),
}));

import { runPromptHealthCheckWithAutoRepair } from '../prompt-health-auto-repair';
import { PLAN_NEXT_SEED_ROWS } from '../plan-next-prompts';

interface Row {
    Id: number; Slug: string; Name: string; Body: string; Role: string;
    IsDefault: number; ReplaceKey: string; ReplaceValues: string;
    CreatedAt: number; UpdatedAt: number;
}
function healthyRow(role: 'plan' | 'next', overrides: Partial<Row> = {}): Row {
    const seed = PLAN_NEXT_SEED_ROWS.find(r => r.role === role && r.isDefault);
    if (!seed) throw new Error('seed row missing');
    return {
        Id: role === 'plan' ? 1 : 2, Slug: seed.slug, Name: seed.name, Body: seed.body,
        Role: role, IsDefault: 1, ReplaceKey: '{{n}}',
        ReplaceValues: JSON.stringify(['5', '10']), CreatedAt: 1, UpdatedAt: 1,
        ...overrides,
    };
}
const ok = (row: Row): unknown => ({ isOk: true, rows: [row] });
const empty = (): unknown => ({ isOk: true, rows: [] });

beforeEach(() => {
    toastCalls.length = 0;
    responsesQueue = [];
    reseedCalls.length = 0;
    reseedResult = { ok: true, mode: 'idempotent' };
});

describe('runPromptHealthCheckWithAutoRepair', () => {
    it('AR1: healthy on first probe skips reseed and stays quiet', async () => {
        responsesQueue = [ok(healthyRow('plan')), ok(healthyRow('next'))];
        const result = await runPromptHealthCheckWithAutoRepair();
        expect(result.isHealthy).toBe(true);
        expect(result.repairAttempted).toBe(false);
        expect(reseedCalls.length).toBe(0);
        expect(toastCalls).toEqual([]);
    });

    it('AR2: unhealthy -> reseed -> healthy: green success toast, no red toast', async () => {
        responsesQueue = [
            // First (silent) probe: plan missing
            empty(), ok(healthyRow('next')),
            // Second (loud) probe: both healthy
            ok(healthyRow('plan')), ok(healthyRow('next')),
        ];
        const result = await runPromptHealthCheckWithAutoRepair();
        expect(result.repairAttempted).toBe(true);
        expect(result.reseedOk).toBe(true);
        expect(result.isHealthy).toBe(true);
        expect(reseedCalls.length).toBe(1);
        // Force mode must NEVER be auto-invoked.
        expect(reseedCalls[0]?.force).toBeUndefined();
        expect(toastCalls.some(t => t.level === 'success')).toBe(true);
        expect(toastCalls.some(t => t.level === 'error')).toBe(false);
    });

    it('AR3: unhealthy -> reseed fails: loud second probe raises red toast', async () => {
        reseedResult = { ok: false, error: 'db offline', mode: 'idempotent' };
        responsesQueue = [
            empty(), ok(healthyRow('next')),
            empty(), ok(healthyRow('next')),
        ];
        const result = await runPromptHealthCheckWithAutoRepair();
        expect(result.repairAttempted).toBe(true);
        expect(result.reseedOk).toBe(false);
        expect(result.reseedError).toBe('db offline');
        expect(result.isHealthy).toBe(false);
        expect(toastCalls.some(t => t.level === 'error')).toBe(true);
    });

    it('AR4: unhealthy -> reseed ok but issues remain: red toast + no force', async () => {
        responsesQueue = [
            ok(healthyRow('plan', { IsDefault: 0 })), ok(healthyRow('next')),
            ok(healthyRow('plan', { IsDefault: 0 })), ok(healthyRow('next')),
        ];
        const result = await runPromptHealthCheckWithAutoRepair();
        expect(result.reseedOk).toBe(true);
        expect(result.isHealthy).toBe(false);
        expect(reseedCalls.length).toBe(1);
        expect(reseedCalls[0]?.force).toBeUndefined();
        expect(toastCalls.some(t => t.level === 'error')).toBe(true);
    });
});
