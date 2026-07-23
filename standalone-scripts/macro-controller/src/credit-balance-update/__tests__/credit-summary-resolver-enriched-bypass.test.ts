/**
 * Regression test — credit-summary resolver bypasses legacy calc for enriched rows (v4.24.0)
 *
 * Locks the behavior that when `WorkspaceCredit.enriched === true`, the
 * inline path returns `ws.totalCredits` verbatim and NEVER calls
 * `calcTotalCredits` — which would otherwise pull the stale sub-bucket
 * `ws.limit` back in and reintroduce the ktlo_2 wrong-total regression.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../credit-balance-cache', () => ({
    readCreditBalanceUpdateCacheSync: () => null,
}));

const calcTotalCreditsMock = vi.fn((..._args: unknown[]): number => 999);
vi.mock('../../credit-api', () => ({
    calcTotalCredits: (...args: unknown[]) => calcTotalCreditsMock(...args),
}));

vi.mock('../credit-fetch-controller', () => ({
    hasInlineCredits: () => true,
    isUnifiedBillingWorkspace: () => false,
}));

vi.mock('../plan-mapper', () => ({
    mapPlanFromWire: (p: string) => p,
    shouldFetchCreditBalanceForPlan: () => true,
}));

import { resolveCreditSummary } from '../credit-summary-resolver';
import type { WorkspaceCredit } from '../../types';

function makeWs(overrides: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: 'ws1', name: 'w', fullName: 'w', dailyFree: 0, dailyUsed: 0, dailyLimit: 0,
        rolloverUsed: 0, rolloverLimit: 0, freeGranted: 0, freeRemaining: 0,
        used: 0, limit: 20, topupLimit: 0, totalCredits: 315, available: 297,
        rollover: 0, billingAvailable: 0, hasFree: false, totalCreditsUsed: 12,
        subscriptionStatus: 'ACTIVE', subscriptionStatusChangedAt: '',
        plan: 'ktlo_2', role: 'owner', tier: 'PAID',
        raw: {}, rawApi: {}, numProjects: 0, gitSyncEnabled: false,
        nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
        membershipRole: 'owner', planType: 'monthly',
        ...overrides,
    } as WorkspaceCredit;
}

describe('resolveCreditSummary — enriched bypass', () => {
    beforeEach(() => { calcTotalCreditsMock.mockClear(); });

    it('returns ws.totalCredits verbatim and never calls calcTotalCredits when enriched=true', () => {
        const ws = makeWs({ enriched: true });
        const summary = resolveCreditSummary(ws);
        expect(summary.total).toBe(315);
        expect(summary.available).toBe(297);
        expect(calcTotalCreditsMock).not.toHaveBeenCalled();
    });

    it('still uses ws.totalCredits (?? fallback) when enriched is undefined', () => {
        const ws = makeWs({});
        const summary = resolveCreditSummary(ws);
        expect(summary.total).toBe(315);
        expect(calcTotalCreditsMock).not.toHaveBeenCalled();
    });

    it('falls through to calcTotalCredits when ws.totalCredits is nullish AND enriched is not true', () => {
        const ws = makeWs({ enriched: false, totalCredits: undefined as unknown as number, available: 5 });
        resolveCreditSummary(ws);
        expect(calcTotalCreditsMock).toHaveBeenCalledTimes(1);
    });
});
