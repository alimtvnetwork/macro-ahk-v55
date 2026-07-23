/**
 * Regression: `hasInlineCredits` MUST return `false` for any unified-billing
 * workspace, even when the list endpoint ships a non-zero
 * `grant_type_balances` row (cloud sub-bucket). Prior order checked the
 * grant rows FIRST, causing ktlo_2 workspaces with
 * `grant_type_balances:[{granted:20,remaining:20}]` to short-circuit to
 * inline `20/20` and never trigger the `/credit-balance` enrichment.
 */
import { describe, expect, it } from 'vitest';
import { hasInlineCredits } from '../credit-fetch-controller';
import type { WorkspaceCredit } from '../../types';

function ws(partial: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: 'w1', name: 'w1', fullName: 'w1',
        available: 20, totalCredits: 20, totalCreditsUsed: 0,
        limit: 20, used: 0, billingAvailable: 20,
        dailyFree: 0, dailyLimit: 0, dailyUsed: 0,
        rollover: 0, rolloverLimit: 0, rolloverUsed: 0,
        freeGranted: 0, freeRemaining: 0, hasFree: false,
        topupLimit: 0,
        plan: 'ktlo_2', role: 'owner',
        tier: 'LITE', subscriptionStatus: 'trialing',
        raw: {}, rawApi: {},
        ...partial,
    } as WorkspaceCredit;
}

describe('hasInlineCredits — unified billing precedence', () => {
    it('returns false for ktlo_2 with non-zero cloud sub-bucket grant row', () => {
        const w = ws({ plan: 'ktlo_2' });
        w.rawApi = { grant_type_balances: [{ granted: 20, remaining: 20 }] };
        expect(hasInlineCredits(w)).toBe(false);
    });

    it('returns false when experimental_features.unified_billing is true (any plan)', () => {
        const w = ws({ plan: 'pro_0' });
        w.rawApi = {
            experimental_features: { unified_billing: true },
            grant_type_balances: [{ granted: 20, remaining: 20 }],
        };
        expect(hasInlineCredits(w)).toBe(false);
    });

    it('still returns true for a legacy pro row with real inline grants', () => {
        const w = ws({ plan: 'pro_1' });
        w.rawApi = { grant_type_balances: [{ granted: 100, remaining: 42 }] };
        expect(hasInlineCredits(w)).toBe(true);
    });
});
