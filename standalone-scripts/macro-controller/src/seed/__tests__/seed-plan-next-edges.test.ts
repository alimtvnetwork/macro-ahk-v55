/**
 * Negative + idempotency edge coverage for `seed-plan-next.ts`
 * (Plan-22 steps 41-48).
 *
 * The existing `seed-plan-next.test.ts` locks the happy paths and
 * the top-level INSERT failure. This file closes the remaining gaps
 * so a silent failure cannot resurface:
 *
 *  E1. pre-select `rawSql` failure returns an empty set: seeder must
 *      still complete without throwing (idempotent contract) and the
 *      inserted counters degrade to "all inserted" instead of stalling.
 *  E2. promote UPDATE failure is logged (`SeedPlanNext`) and does NOT
 *      fail the seed as a whole; telemetry `promotedDefault` stays 0.
 *  E3. localStorage.setItem throwing during telemetry persistence is
 *      logged but does NOT flip `ok` to false.
 *  E4. seed SQL carries the Plan-15 ReplaceKey/ReplaceValues literals
 *      (`n` + `["1","2","3","5","8"]`) so cold-boot chip set is intact.
 *  E5. telemetry rows include `replaceKey` and `replaceValueCount`.
 *  E6. an outer throw (rawSql rejects) returns `ok:false` with the
 *      error surfaced, never a swallowed exception.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: unknown[] = [];
let sendImpl: ((sql: string) => Promise<unknown>) | null = null;

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        if (sendImpl) return sendImpl(p.params.sql);
        return responsesQueue.shift() ?? { isOk: true, rows: [] };
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { seedPlanNextPrompts } from '../seed-plan-next';
import { logDiagnosticFromCode } from '../../error-utils';
import {
    REPLACE_KEY_DEFAULT,
    REPLACE_VALUES_DEFAULT,
    REPLACE_VALUES_DEFAULT_JSON,
} from '../../db/prompt-defaults';

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    sendImpl = null;
    (logDiagnosticFromCode as unknown as Mock).mockClear();
    try { localStorage.removeItem('marco_last_seed_telemetry'); } catch { /* jsdom */ }
});

describe('seedPlanNextPrompts — negative + idempotency edges', () => {
    it('E1: pre-select failure degrades to empty set; seed still completes', async () => {
        responsesQueue = [
            { isOk: false, errorMessage: 'pre-select boom' }, // pre-select fails
            { isOk: true },                                    // INSERT OR IGNORE ok
            { isOk: true, rows: [{ '1': 1 }] },                // plan default present
            { isOk: true, rows: [{ '1': 1 }] },                // next default present
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        // With no pre-select data, every seed row is counted as "inserted"
        // (defensive, not misleading: the OR IGNORE below is still safe).
        const plan = r.telemetry?.find(t => t.role === 'plan');
        expect(plan?.inserted).toBeGreaterThan(0);
        expect(plan?.skipped).toBe(0);
    });

    it('E2: promote UPDATE failure logs via SeedPlanNext but overall seed still ok', async () => {
        // v4.187.0: two legacy-body SELECTs (plan + next) run before promotion.
        responsesQueue = [
            { isOk: true, rows: [] },                          // pre-select empty
            { isOk: true },                                    // INSERT ok
            { isOk: true, rows: [] },                          // legacy-body SELECT plan-default (skip)
            { isOk: true, rows: [] },                          // legacy-body SELECT next-default (skip)
            { isOk: true, rows: [] },                          // plan hasDefault -> false
            { isOk: false, errorMessage: 'update denied' },    // plan promote fails
            { isOk: true, rows: [] },                          // next hasDefault -> false
            { isOk: true },                                    // next promote ok
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        const plan = r.telemetry?.find(t => t.role === 'plan');
        const next = r.telemetry?.find(t => t.role === 'next');
        expect(plan?.promotedDefault).toBe(0);
        expect(next?.promotedDefault).toBe(1);
        expect(logDiagnosticFromCode).toHaveBeenCalledWith(
            'SEED_PROMOTE_E001',
            expect.objectContaining({ role: 'plan', slug: 'plan-default' }),
        );
    });

    it('E3: localStorage.setItem throwing logs but does not flip ok=false', async () => {
        responsesQueue = [
            { isOk: true, rows: [] }, { isOk: true },
            { isOk: true, rows: [{ '1': 1 }] }, { isOk: true, rows: [{ '1': 1 }] },
        ];
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded');
        });
        try {
            const r = await seedPlanNextPrompts();
            expect(r.ok).toBe(true);
            expect(logDiagnosticFromCode).toHaveBeenCalledWith(
                'SEED_TELEMETRY_E001',
                expect.objectContaining({ reason: expect.stringContaining('quota') }),
                expect.any(Error),
            );
        } finally {
            spy.mockRestore();
        }
    });

    it('E4: INSERT SQL carries the Plan-15 default ReplaceKey and ReplaceValues literals', async () => {
        responsesQueue = [
            { isOk: true, rows: [] }, { isOk: true },
            { isOk: true, rows: [{ '1': 1 }] }, { isOk: true, rows: [{ '1': 1 }] },
        ];
        await seedPlanNextPrompts();
        const sql = captured[1].sql;
        expect(sql).toContain('ReplaceKey');
        expect(sql).toContain('ReplaceValues');
        expect(sql).toContain("'" + REPLACE_KEY_DEFAULT + "'");
        // The JSON literal is stored as a single-quoted SQL string.
        expect(sql).toContain(REPLACE_VALUES_DEFAULT_JSON.replace(/'/g, "''"));
    });

    it('E5: telemetry rows include replaceKey and replaceValueCount', async () => {
        responsesQueue = [
            { isOk: true, rows: [] }, { isOk: true },
            { isOk: true, rows: [{ '1': 1 }] }, { isOk: true, rows: [{ '1': 1 }] },
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        for (const bucket of r.telemetry ?? []) {
            expect(bucket.replaceKey).toBe(REPLACE_KEY_DEFAULT);
            expect(bucket.replaceValueCount).toBe(REPLACE_VALUES_DEFAULT.length);
        }
    });

    it('E6: an outer rawSql throw surfaces via ok:false + coded diagnostic, never swallowed', async () => {
        sendImpl = async () => { throw new Error('driver offline'); };
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/driver offline/);
        expect(logDiagnosticFromCode).toHaveBeenCalledWith(
            'SEED_INSERT_E001',
            expect.objectContaining({ role: 'all', reason: expect.stringContaining('driver offline') }),
            expect.any(Error),
        );
    });
});
