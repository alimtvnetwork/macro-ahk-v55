/**
 * Multi-workspace unified-billing fan-out E2E (v4.24.0)
 *
 * Composes the KTLO_2 fixture with legacy pro_1 + free rows, feeds them
 * through the real `fanOutCreditEnrichment` capped-parallel pipeline
 * with a stub requester that overlays parsed `/credit-balance` payloads
 * onto the workspace, and asserts:
 *
 *   1. Only rows lacking inline credits are targeted for fetch.
 *   2. Each targeted row lands on its own authoritative totals — no
 *      cross-contamination between workspaces during parallel dispatch.
 *   3. The KTLO_2 row shows `315 / 303` (not the stale `20` sub-bucket).
 *   4. `ws.enriched === true` on every overlayed row.
 */
import { describe, it, expect, vi } from 'vitest';
import type { WorkspaceCredit } from '../types';
import { CreditFetchOutcome } from '../credit-balance-update/credit-fetch-outcome';
import type { CreditFetchResult } from '../credit-balance-update/credit-balance-types';
import { parseCreditBalance } from '../credit-balance-update/credit-balance-parser';
import { overlayCreditBalanceOnWorkspace } from '../credit-balance-update/credit-fetch-controller';
import { fanOutCreditEnrichment } from '../credit-balance-update/credit-enrichment-fanout';
import { KTLO_2_CREDIT_BALANCE_WIRE, KTLO_2_EXPECTED_DISPLAY } from './fixtures/ktlo-2-unified-workspace';

vi.mock('../error-utils', () => ({ logError: vi.fn() }));

function ws(partial: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: 'x', name: 'x', fullName: 'x',
        dailyFree: 0, dailyUsed: 0, dailyLimit: 0,
        rolloverUsed: 0, rolloverLimit: 0,
        freeGranted: 0, freeRemaining: 0,
        used: 0, limit: 0, topupLimit: 0,
        totalCredits: 0, available: 0, rollover: 0, billingAvailable: 0,
        hasFree: false, totalCreditsUsed: 0,
        subscriptionStatus: 'active', subscriptionStatusChangedAt: '',
        plan: 'ktlo', role: 'owner', tier: 'LITE',
        raw: {}, rawApi: {},
        numProjects: 0, gitSyncEnabled: false,
        nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
        membershipRole: 'owner', planType: 'monthly',
        ...partial,
    } as WorkspaceCredit;
}

const balanceByWorkspace: Record<string, ReturnType<typeof parseCreditBalance>> = {
    ktlo2_a: parseCreditBalance(KTLO_2_CREDIT_BALANCE_WIRE),
    // Distinct payload — proves rows do not cross-contaminate under
    // parallel dispatch.
    ktlo2_b: parseCreditBalance({
        ledger_enabled: true,
        total_remaining: 100,
        total_granted: 200,
        daily_remaining: 3,
        daily_limit: 5,
        total_billing_period_used: 100,
        expiring_grants: [],
        grant_type_balances: [{ grant_type: 'granted', granted: 200, remaining: 100 }],
    }),
    free_1: parseCreditBalance({
        ledger_enabled: false,
        total_remaining: 5,
        total_granted: 5,
        daily_remaining: 5,
        daily_limit: 5,
        total_billing_period_used: 0,
        expiring_grants: [],
        grant_type_balances: [],
    }),
};

describe('multi-workspace unified-billing fan-out E2E', () => {
    it('overlays per-workspace /credit-balance without cross-contamination', async () => {
        const workspaces = [
            ws({ id: 'ktlo2_a', plan: 'ktlo_2', limit: 20 }),         // fetch → 315/303
            ws({ id: 'ktlo2_b', plan: 'ktlo_2', limit: 20 }),         // fetch → 200/103 (distinct)
            ws({ id: 'free_1',  plan: 'free' }),                       // fetch → 5/5
            ws({ id: 'pro1_inline', plan: 'pro_1', limit: 100,         // inline-hit, NOT fetched
                rawApi: { grant_type_balances: [{ granted: 100, remaining: 40 }] } }),
        ];

        const fanOut = await fanOutCreditEnrichment(workspaces, {
            requester: async (target): Promise<CreditFetchResult> => {
                const balance = balanceByWorkspace[target.id];
                if (!balance) throw new Error('no fixture for ' + target.id);
                overlayCreditBalanceOnWorkspace(target, balance);
                return {
                    outcome: CreditFetchOutcome.ApiHit,
                    balance,
                    fetchedAt: 1,
                    sourceUrl: 'https://api.test/workspaces/' + target.id + '/credit-balance',
                    errorDetail: null,
                };
            },
        });

        // Inline-hit row is skipped by fan-out.
        expect(fanOut.targetedCount).toBe(3);
        expect(Object.keys(fanOut.resultsByWorkspaceId).sort()).toEqual(['free_1', 'ktlo2_a', 'ktlo2_b']);

        const byId = Object.fromEntries(workspaces.map(w => [w.id, w]));

        // KTLO_2 rows overlayed with their OWN payloads (no leak).
        expect(byId.ktlo2_a.totalCredits).toBe(KTLO_2_EXPECTED_DISPLAY.total);
        expect(byId.ktlo2_a.available).toBe(KTLO_2_EXPECTED_DISPLAY.available);
        expect(byId.ktlo2_a.enriched).toBe(true);

        expect(byId.ktlo2_b.totalCredits).toBe(200);
        expect(byId.ktlo2_b.available).toBe(100);
        expect(byId.ktlo2_b.enriched).toBe(true);

        expect(byId.free_1.totalCredits).toBe(5);
        expect(byId.free_1.available).toBe(5);
        expect(byId.free_1.enriched).toBe(true);

        // The inline-hit pro_1 row was NOT touched by the fan-out overlay.
        expect(byId.pro1_inline.enriched).toBeUndefined();

        // Regression anchor: the stale sub-bucket 20 must NEVER leak into
        // an overlayed row's display total.
        expect(byId.ktlo2_a.totalCredits).not.toBe(20);
        expect(byId.ktlo2_b.totalCredits).not.toBe(20);
    });
});
