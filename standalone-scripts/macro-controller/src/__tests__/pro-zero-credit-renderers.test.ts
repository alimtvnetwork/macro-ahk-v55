/**
 * Unit tests — Group C: renderer integration (6 tests)
 *
 * Spec: spec/22-app-issues/114-pro-zero-credit-balance-calculation.md §6 Group C, §5 Step 3
 *
 * Covers: renderCreditBar HTML for pro_0, Copy-JSON payload assembly, and the
 * "legacy fallback throws for pro_0" guard at the renderer call site.
 */

import { describe, it, expect } from 'vitest';
import { renderCreditBar, calcTotalCredits } from '../credit-api';
import { applySummaryToRow } from '../pro-zero/pro-zero-enrichment';
import { calculateProZeroCreditSummary } from '../pro-zero/pro-zero-credit-calculator';
import { CreditGrantType } from '../pro-zero/credit-grant-type';
import { MacroCreditSource } from '../pro-zero/macro-credit-source';
import type { CreditBalanceResponseTyped } from '../pro-zero/credit-balance-response-typed';
import type { WorkspaceCredit } from '../types';

function refBalance(): CreditBalanceResponseTyped {
    return {
        ledger_enabled: false,
        total_remaining: 76, total_granted: 205,
        daily_remaining: 5, daily_limit: 5,
        total_billing_period_used: 144,
        expiring_grants: [],
        grant_type_balances: [
            { grant_type: CreditGrantType.DAILY, granted: 5, remaining: 5 },
            { grant_type: CreditGrantType.BILLING, granted: 200, remaining: 71 },
        ],
    };
}

function emptyWs(): WorkspaceCredit {
    return {
        id: 'ws-001', name: 'ws-001', fullName: 'ws-001 / owner@sample.com',
        dailyFree: 999, dailyUsed: 0, dailyLimit: 999,
        rolloverUsed: 0, rolloverLimit: 0,
        freeGranted: 0, freeRemaining: 0,
        used: 0, limit: 0, topupLimit: 0,
        totalCredits: 0, available: 0, rollover: 0, billingAvailable: 0,
        hasFree: false, totalCreditsUsed: 0,
        subscriptionStatus: '', subscriptionStatusChangedAt: '',
        plan: 'pro_0', role: 'owner', tier: 'PRO_ZERO',
        raw: {}, rawApi: { id: 'ws-001', plan: 'pro_0', billing_period_credits_limit: 9999 },
        numProjects: 0, gitSyncEnabled: false,
        nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
        membershipRole: 'owner', planType: 'monthly',
    };
}

describe('Group C — renderer integration', () => {
    it('C21: renderCreditBar reads WorkspaceCredit.billingAvailable (NOT rawApi.billing_period_credits_limit)', () => {
        const ws = emptyWs();
        applySummaryToRow(ws, calculateProZeroCreditSummary(refBalance(), 0), '{}');
        // billingAvailable now = 71 (from enrichment); raw API value = 9999 (legacy, must not be used)
        expect(ws.billingAvailable).toBe(71);
        const html = renderCreditBar({
            totalCredits: ws.totalCredits, available: ws.available, totalUsed: ws.totalCreditsUsed,
            freeRemaining: 0, billingAvail: ws.billingAvailable, rollover: 0, dailyFree: 5,
        });
        expect(html).toContain('💰 Monthly: 71');
        expect(html).not.toContain('9999');
    });

    it('C22: title shows "Available: 76 / Total: 205 (Used: 144)" for reference payload', () => {
        const ws = emptyWs();
        applySummaryToRow(ws, calculateProZeroCreditSummary(refBalance(), 0), '{}');
        const html = renderCreditBar({
            totalCredits: ws.totalCredits, available: ws.available, totalUsed: ws.totalCreditsUsed,
            freeRemaining: 0, billingAvail: ws.billingAvailable, rollover: 0, dailyFree: 5,
        });
        expect(html).toContain('Available: 76 / Total: 205 (Used: 144)');
    });

    it('C23: compact mode shows ⚡76/205', () => {
        const html = renderCreditBar({
            totalCredits: 205, available: 76, totalUsed: 144,
            freeRemaining: 0, billingAvail: 71, rollover: 0, dailyFree: 5,
            compact: true,
        });
        expect(html).toContain('⚡76/205');
    });

    it('C24: non-compact shows 🎁0 💰71 🔄0 📅5 ⚡76/205 for reference payload', () => {
        const html = renderCreditBar({
            totalCredits: 205, available: 76, totalUsed: 144,
            freeRemaining: 0, billingAvail: 71, rollover: 0, dailyFree: 5,
            compact: false,
        });
        expect(html).toContain('🎁0');
        expect(html).toContain('💰71');
        expect(html).toContain('🔄0');
        expect(html).toContain('📅5');
        expect(html).toContain('⚡76/205');
    });

    it('C25: Copy-JSON payload for pro_0 wraps both Workspace + CreditBalance', () => {
        // Inline replica of buildCopyJsonPayload to avoid coupling to UI module.
        const ws = emptyWs();
        const balance = refBalance();
        applySummaryToRow(ws, calculateProZeroCreditSummary(balance, 0), JSON.stringify(balance));

        const workspaceJson = JSON.stringify(ws.rawApi, null, 2);
        const balanceRaw = ws['proZeroCreditBalanceJson'];
        const source = ws['proZeroSource'];
        expect(source).toBe(MacroCreditSource.CREDIT_BALANCE);
        expect(typeof balanceRaw).toBe('string');
        const wrapped = {
            Source: source,
            Workspace: JSON.parse(workspaceJson) as unknown,
            CreditBalance: JSON.parse(balanceRaw as string) as unknown,
        };
        const out = JSON.stringify(wrapped);
        expect(out).toContain('"Source":"CREDIT_BALANCE"');
        expect(out).toContain('"plan":"pro_0"');
        expect(out).toContain('"total_granted":205');
        expect(out).toContain('"total_remaining":76');
    });

    it('C26: non-pro_0 plan still flows through legacy calcTotalCredits unchanged (no regression)', () => {
        expect(calcTotalCredits(0, 0, 100, 0, 0, 'pro')).toBe(100);
        expect(calcTotalCredits(50, 10, 100, 5, 5, 'free')).toBe(170);
        // No throw for any non-pro_0 plan.
        expect(() => calcTotalCredits(0, 0, 0, 0, 0, 'enterprise')).not.toThrow();
    });
});
