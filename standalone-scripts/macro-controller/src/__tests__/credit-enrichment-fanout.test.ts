import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceCredit } from '../types';
import { CreditFetchOutcome } from '../credit-balance-update/credit-fetch-outcome';
import type { CreditFetchResult } from '../credit-balance-update/credit-balance-types';

const { logErrorSpy } = vi.hoisted(() => ({
    logErrorSpy: vi.fn(),
}));

vi.mock('../error-utils', () => ({
    logError: logErrorSpy,
}));

import { fanOutCreditEnrichment } from '../credit-balance-update/credit-enrichment-fanout';

function workspace(partial: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: 'ws_1', name: 'ws', fullName: 'workspace',
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
    };
}

function result(workspaceId: string): CreditFetchResult {
    return {
        outcome: CreditFetchOutcome.ApiHit,
        balance: null,
        fetchedAt: 1,
        sourceUrl: 'https://api.example.test/workspaces/' + workspaceId + '/credit-balance',
        errorDetail: null,
    };
}

describe('fanOutCreditEnrichment', () => {
    it('targets only enriched workspaces and returns results keyed by workspace id', async () => {
        const calls: string[] = [];
        const workspaces = [
            workspace({ id: 'ktlo_1', plan: 'ktlo' }),
            workspace({ id: 'free_1', plan: 'free' }),
            workspace({ id: 'cancelled_1', plan: 'cancelled' }),
            workspace({ id: 'pro0_1', plan: 'pro_0' }),
            workspace({ id: 'ktlo2_1', plan: 'ktlo_2', limit: 20 }),
            workspace({ id: 'pro1_1', plan: 'pro_1', limit: 100 }),
            workspace({ id: 'business_1', plan: 'business' }),
            workspace({ id: 'inline_ktlo', plan: 'ktlo', rawApi: { grant_type_balances: [{ granted: 10, remaining: 5 }] } }),
        ];

        const fanOut = await fanOutCreditEnrichment(workspaces, {
            requester: async function (current) {
                calls.push(current.id);
                return result(current.id);
            },
        });

        expect(fanOut.targetedCount).toBe(5);
        expect(calls).toEqual(['ktlo_1', 'free_1', 'cancelled_1', 'pro0_1', 'ktlo2_1']);
        expect(Object.keys(fanOut.resultsByWorkspaceId).sort()).toEqual(calls.sort());
    });

    it('caps concurrent credit-balance requests at six', async () => {
        let activeCount = 0;
        let maxActiveCount = 0;
        const workspaces = Array.from({ length: 8 }, function (_, index) {
            return workspace({ id: 'ktlo_' + index, plan: 'ktlo' });
        });

        await fanOutCreditEnrichment(workspaces, {
            requester: async function (current) {
                activeCount += 1;
                maxActiveCount = Math.max(maxActiveCount, activeCount);
                await Promise.resolve();
                activeCount -= 1;
                return result(current.id);
            },
        });

        expect(maxActiveCount).toBe(6);
    });

    it('logs one failed workspace while sibling fetches still populate', async () => {
        const workspaces = [
            workspace({ id: 'ok_1', plan: 'ktlo' }),
            workspace({ id: 'bad_1', plan: 'free' }),
            workspace({ id: 'ok_2', plan: 'pro_0' }),
        ];

        const fanOut = await fanOutCreditEnrichment(workspaces, {
            requester: async function (current) {
                if (current.id === 'bad_1') {
                    throw new Error('boom');
                }
                return result(current.id);
            },
        });

        expect(fanOut.resultsByWorkspaceId.ok_1?.outcome).toBe(CreditFetchOutcome.ApiHit);
        expect(fanOut.resultsByWorkspaceId.bad_1).toBeNull();
        expect(fanOut.resultsByWorkspaceId.ok_2?.outcome).toBe(CreditFetchOutcome.ApiHit);
        expect(logErrorSpy).toHaveBeenCalledWith(
            'CreditBalanceUpdate.fanOut',
            expect.stringContaining('WorkspaceId=bad_1'),
            expect.any(Error),
        );
    });
});