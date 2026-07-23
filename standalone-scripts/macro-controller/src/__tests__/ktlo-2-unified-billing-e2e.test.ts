/**
 * End-to-end regression — KTLO_2 unified-billing pipeline (v4.24.0)
 *
 * Wires the captured `/user/workspaces` row through parseCreditBalance
 * (as if from `/credit-balance`) and overlayCreditBalanceOnWorkspace,
 * then asserts the display resolver returns the authoritative
 * total/available — proving the ktlo_2 wrong-total bug stays fixed
 * end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { parseCreditBalance } from '../credit-balance-update/credit-balance-parser';
import { overlayCreditBalanceOnWorkspace, hasInlineCredits } from '../credit-balance-update/credit-fetch-controller';
import type { WorkspaceCredit } from '../types';
import {
    KTLO_2_UNIFIED_WORKSPACE_WIRE,
    KTLO_2_CREDIT_BALANCE_WIRE,
    KTLO_2_EXPECTED_DISPLAY,
} from './fixtures/ktlo-2-unified-workspace';

function seedWorkspaceFromWire(): WorkspaceCredit {
    const wire = KTLO_2_UNIFIED_WORKSPACE_WIRE;
    return {
        id: wire.id, name: wire.name, fullName: wire.name,
        dailyFree: 0, dailyUsed: wire.daily_credits_used, dailyLimit: wire.daily_credits_limit,
        rolloverUsed: 0, rolloverLimit: 0,
        freeGranted: 0, freeRemaining: 0,
        used: wire.billing_period_credits_used,
        limit: wire.billing_period_credits_limit, // <-- 20, the misleading sub-bucket
        topupLimit: 0,
        totalCredits: wire.billing_period_credits_limit, // legacy calc seeds 20 here
        available: 0,
        rollover: 0, billingAvailable: 0, hasFree: false,
        totalCreditsUsed: wire.billing_period_credits_used,
        subscriptionStatus: 'ACTIVE', subscriptionStatusChangedAt: '',
        plan: wire.plan, role: 'owner', tier: 'PAID',
        raw: {}, rawApi: wire as unknown as Record<string, unknown>,
        numProjects: wire.num_projects,
        gitSyncEnabled: false, nextRefillAt: '', billingPeriodEndAt: '',
        createdAt: wire.created_at, membershipRole: 'owner', planType: wire.plan_type,
    } as WorkspaceCredit;
}

describe('KTLO_2 unified-billing end-to-end', () => {
    it('does NOT report inline credits — must fall through to /credit-balance', () => {
        const ws = seedWorkspaceFromWire();
        // Even if the wire fixture ships non-zero grant_type_balances rows,
        // ktlo_2 unified billing must bypass inline shortcuts and fetch the
        // authoritative /credit-balance totals.
        expect(hasInlineCredits(ws)).toBe(false);
    });

    it('overlays /credit-balance totals and yields authoritative display numbers', () => {
        const ws = seedWorkspaceFromWire();
        const balance = parseCreditBalance(KTLO_2_CREDIT_BALANCE_WIRE);
        overlayCreditBalanceOnWorkspace(ws, balance);

        expect(ws.enriched).toBe(true);
        expect(ws.totalCredits).toBe(KTLO_2_EXPECTED_DISPLAY.total);
        expect(ws.available).toBe(KTLO_2_EXPECTED_DISPLAY.available);
        expect(ws.totalCreditsUsed).toBe(KTLO_2_EXPECTED_DISPLAY.totalUsed);
        // The stale sub-bucket must NOT leak into the display totals.
        expect(ws.totalCredits).not.toBe(20);
    });

    it('parses ledger_enabled=false from the captured wire', () => {
        const balance = parseCreditBalance(KTLO_2_CREDIT_BALANCE_WIRE);
        expect(balance.ledgerEnabled).toBe(false);
        expect(balance.totalGranted).toBe(310);
        expect(balance.totalRemaining).toBe(297.9);
    });
});
