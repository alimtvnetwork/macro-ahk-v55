/**
 * Regression test — credit-balance mapper field extension (v4.24.0)
 *
 * Locks the wire→typed mapping for the unified-billing `/credit-balance`
 * response captured from live DevTools inspection: `ledger_enabled` now
 * lands as `ledgerEnabled` on the typed CreditBalance, and every
 * previously-parsed field survives the extension unchanged.
 */
import { describe, it, expect } from 'vitest';
import { parseCreditBalance } from '../credit-balance-parser';

describe('parseCreditBalance — unified-billing wire fields', () => {
    const wire = {
        ledger_enabled: false,
        total_remaining: 297.9,
        total_granted: 310,
        daily_remaining: 5,
        daily_limit: 5,
        total_billing_period_used: 12.1,
        expiring_grants: [
            { grant_type: 'granted', remaining: 297.9, expires_at: '2027-06-21T07:13:36.339349303Z' },
        ],
        grant_type_balances: [
            { grant_type: 'daily', granted: 5, remaining: 5 },
            { grant_type: 'granted', granted: 310, remaining: 297.9 },
        ],
    };

    it('extracts ledgerEnabled + every documented field', () => {
        const parsed = parseCreditBalance(wire);
        expect(parsed.ledgerEnabled).toBe(false);
        expect(parsed.totalGranted).toBe(310);
        expect(parsed.totalRemaining).toBe(297.9);
        expect(parsed.dailyLimit).toBe(5);
        expect(parsed.dailyRemaining).toBe(5);
        expect(parsed.totalBillingPeriodUsed).toBe(12.1);
        expect(parsed.grantTypeBalances).toHaveLength(2);
        expect(parsed.expiringGrants).toHaveLength(1);
    });

    it('defaults ledgerEnabled to false when the wire omits it', () => {
        const { ledger_enabled: _omit, ...rest } = wire;
        void _omit;
        const parsed = parseCreditBalance(rest as unknown as typeof wire);
        expect(parsed.ledgerEnabled).toBe(false);
    });

    it('captures ledgerEnabled=true when the wire opts in', () => {
        const parsed = parseCreditBalance({ ...wire, ledger_enabled: true });
        expect(parsed.ledgerEnabled).toBe(true);
    });
});
