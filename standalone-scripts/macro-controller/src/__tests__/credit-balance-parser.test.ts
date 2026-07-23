import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrantType } from '../credit-balance-update/grant-type';

const { logWarnSpy, logErrorSpy } = vi.hoisted(() => ({
    logWarnSpy: vi.fn(),
    logErrorSpy: vi.fn(),
}));

vi.mock('../error-utils', () => ({
    logWarn: logWarnSpy,
    logError: logErrorSpy,
}));

import { parseCreditBalance } from '../credit-balance-update/credit-balance-parser';

beforeEach(() => {
    logWarnSpy.mockClear();
    logErrorSpy.mockClear();
});

describe('credit-balance parser', () => {
    it('maps snake_case API payload into camelCase fields', () => {
        const parsed = parseCreditBalance({
            total_remaining: 5,
            total_granted: 5,
            daily_remaining: 5,
            daily_limit: 5,
            total_billing_period_used: 0,
            expiring_grants: [{ grant_type: 'daily', remaining: 1, expires_at: '2026-06-05T00:00:00Z' }],
            grant_type_balances: [{ grant_type: 'daily', granted: 5, remaining: 5 }],
        });

        expect(parsed.totalRemaining).toBe(5);
        expect(parsed.totalGranted).toBe(5);
        expect(parsed.dailyRemaining).toBe(5);
        expect(parsed.dailyLimit).toBe(5);
        expect(parsed.totalBillingPeriodUsed).toBe(0);
        expect(parsed.grantTypeBalances[0]).toEqual({ grantType: GrantType.Daily, granted: 5, remaining: 5 });
        expect(parsed.expiringGrants[0]).toEqual({ grantType: GrantType.Daily, remaining: 1, expiresAt: '2026-06-05T00:00:00Z', applicability: '' });
    });

    it('defaults missing numerics to 0 and logs warnings', () => {
        const parsed = parseCreditBalance({
            expiring_grants: [],
            grant_type_balances: [{ grant_type: 'daily' }],
        });

        expect(parsed.totalRemaining).toBe(0);
        expect(parsed.grantTypeBalances[0].granted).toBe(0);
        expect(logWarnSpy).toHaveBeenCalled();
    });

    it('throws ParseError for a bad top-level shape', () => {
        expect(() => parseCreditBalance(null as never)).toThrow('Expected credit-balance response object');
    });
});
