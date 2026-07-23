/**
 * Regression — expiring_grants 2026-06 wire shape.
 *
 * Live `/credit-balance` responses now emit expiring grants using
 * `credits` + `applicability` (the field `remaining` was removed).
 * Parser must accept both shapes without emitting CODE-RED warnings
 * for the new payload.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseCreditBalance } from '../credit-balance-parser';
import * as logger from '../credit-balance-logger';
import { GrantType } from '../grant-type';

describe('parseCreditBalance — expiring_grants 2026-06 shape', () => {
    it('accepts `credits` alias and captures `applicability` without warnings', () => {
        const warnSpy = vi.spyOn(logger, 'logCreditParseWarning').mockImplementation(() => {});
        const parsed = parseCreditBalance({
            total_remaining: 302.9,
            total_granted: 315,
            daily_remaining: 5,
            daily_limit: 5,
            total_billing_period_used: 11.5,
            available_balance: 297.9,
            cloud_remaining: 20,
            ai_remaining: 4,
            expiring_grants: [
                {
                    grant_type: 'granted',
                    applicability: 'generic',
                    credits: 297.9,
                    expires_at: '2027-06-21T07:13:36.339349303Z',
                },
            ],
            grant_type_balances: [
                { grant_type: 'daily', granted: 5, remaining: 5 },
                { grant_type: 'granted', granted: 310, remaining: 297.9 },
            ],
        });

        expect(parsed.expiringGrants).toHaveLength(1);
        expect(parsed.expiringGrants[0]).toEqual({
            grantType: GrantType.Granted,
            remaining: 297.9,
            expiresAt: '2027-06-21T07:13:36.339349303Z',
            applicability: 'generic',
        });
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('still accepts the legacy `remaining` shape', () => {
        const parsed = parseCreditBalance({
            total_remaining: 5, total_granted: 5, daily_remaining: 5,
            daily_limit: 5, total_billing_period_used: 0,
            expiring_grants: [
                { grant_type: 'daily', remaining: 2, expires_at: '2026-06-05T00:00:00Z' },
            ],
            grant_type_balances: [],
        });
        expect(parsed.expiringGrants[0].remaining).toBe(2);
        expect(parsed.expiringGrants[0].applicability).toBe('');
    });
});
