/**
 * v4.16.0 regression lock — unified-billing workspaces must NOT be
 * short-circuited as "inline" just because `ws.limit > 0`. Under
 * unified billing the list endpoint's `billing_period_credits_limit`
 * is only the cloud sub-bucket (e.g. `20` on a `ktlo_2` workspace whose
 * real `total_granted` is `315`).
 *
 * Root cause fix: hasInlineCredits() in credit-fetch-controller.ts
 * now ignores `ws.limit` for unified-billing workspaces.
 */
import { describe, expect, it } from 'vitest';
import type { WorkspaceCredit } from '../types';

import { hasInlineCredits } from '../credit-balance-update/credit-fetch-controller';

function ws(partial: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: 'ws_1', name: 'ws', fullName: 'workspace',
        dailyFree: 0, dailyUsed: 0, dailyLimit: 0,
        rolloverUsed: 0, rolloverLimit: 0,
        freeGranted: 0, freeRemaining: 0,
        used: 0, limit: 0, topupLimit: 0,
        totalCredits: 0, available: 0, rollover: 0, billingAvailable: 0,
        hasFree: false, totalCreditsUsed: 0,
        subscriptionStatus: 'active', subscriptionStatusChangedAt: '',
        plan: 'pro_1', role: 'owner', tier: 'PRO',
        raw: {}, rawApi: {},
        numProjects: 0, gitSyncEnabled: false,
        nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
        membershipRole: 'owner', planType: 'monthly',
        ...partial,
    };
}

describe('hasInlineCredits — unified-billing (v4.16.0)', () => {
    it('legacy pro_1 with ws.limit > 0 still counts as inline (regression guard)', () => {
        expect(hasInlineCredits(ws({ plan: 'pro_1', limit: 100 }))).toBe(true);
    });

    it('ktlo_2 with only ws.limit set is NOT inline — must fall through to /credit-balance', () => {
        expect(hasInlineCredits(ws({ plan: 'ktlo_2', limit: 20 }))).toBe(false);
    });

    it('ktlo_3 with only ws.limit set is NOT inline', () => {
        expect(hasInlineCredits(ws({ plan: 'ktlo_3', limit: 20 }))).toBe(false);
    });

    it('any plan with experimental_features.unified_billing=true is NOT inline via ws.limit alone', () => {
        const w = ws({
            plan: 'pro_1',
            limit: 20,
            rawApi: { experimental_features: { unified_billing: true } },
        });
        expect(hasInlineCredits(w)).toBe(false);
    });

    it('unified-billing workspace WITH a non-zero grant_type_balances row is NOT inline', () => {
        const w = ws({
            plan: 'ktlo_2',
            limit: 20,
            rawApi: {
                grant_type_balances: [
                    { grant_type: 'granted', granted: 310, remaining: 297.9 },
                ],
            },
        });
        expect(hasInlineCredits(w)).toBe(false);
    });

    it('unified-billing workspace with only ZERO grant rows is NOT inline (must fetch)', () => {
        const w = ws({
            plan: 'ktlo_2',
            limit: 20,
            rawApi: {
                grant_type_balances: [
                    { grant_type: 'granted', granted: 0, remaining: 0 },
                ],
            },
        });
        expect(hasInlineCredits(w)).toBe(false);
    });

    it('plain ktlo (no tier suffix) with ws.limit=0 and no grants is NOT inline', () => {
        expect(hasInlineCredits(ws({ plan: 'ktlo', limit: 0 }))).toBe(false);
    });
});
