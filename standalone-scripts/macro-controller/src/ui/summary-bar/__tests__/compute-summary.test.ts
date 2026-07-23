/**
 * Unit tests — computeDashboardSummary (Issue 125 §5).
 *
 * Covers:
 *   - empty list returns all zeros
 *   - pro-only mix (Pro / Pro_0 / Pro_1)
 *   - mixed pro + free rows (free contributes only to freeCreditsAvailable)
 *   - pro_0 enriched row (available/totalCredits read straight from the row)
 *   - expire / expire-soon / canceled all counted in proExpiringCount
 *   - FREE rows excluded from pro credit totals
 */

import { describe, expect, it } from 'vitest';
import type { WorkspaceCredit } from '../../../types/credit-types';
import type { WorkspaceDisplayKind } from '../../../workspace-display-status';
import { computeDashboardSummary, type DisplayKindResolver } from '../compute-summary';

function ws(overrides: Partial<WorkspaceCredit>): WorkspaceCredit {
    return {
        id: overrides.id ?? 'ws-' + Math.random().toString(36).slice(2, 8),
        name: overrides.name ?? 'name',
        fullName: overrides.fullName ?? 'Full Name',
        dailyFree: overrides.dailyFree ?? 0,
        dailyUsed: 0,
        dailyLimit: 0,
        rolloverUsed: 0,
        rolloverLimit: 0,
        freeGranted: 0,
        freeRemaining: 0,
        used: 0,
        limit: 0,
        topupLimit: 0,
        totalCredits: overrides.totalCredits ?? 0,
        available: overrides.available ?? 0,
        rollover: 0,
        billingAvailable: 0,
        hasFree: false,
        totalCreditsUsed: 0,
        subscriptionStatus: '',
        subscriptionStatusChangedAt: '',
        plan: overrides.plan ?? 'pro_1',
        role: '',
        tier: overrides.tier ?? 'PAID',
        raw: {},
        rawApi: {},
        numProjects: 0,
        gitSyncEnabled: false,
        nextRefillAt: '',
        billingPeriodEndAt: '',
        createdAt: '',
        membershipRole: '',
        planType: '',
        ...overrides,
    };
}

const allNormal: DisplayKindResolver = () => 'normal';

function byKind(map: Record<string, WorkspaceDisplayKind>): DisplayKindResolver {
    return (row) => map[row.id] ?? 'normal';
}

describe('computeDashboardSummary', () => {
    it('returns all zeros for an empty list', () => {
        const summary = computeDashboardSummary([], allNormal);
        expect(summary).toEqual({
            proCount: 0,
            proExpiringCount: 0,
            proCreditsAvailable: 0,
            proCreditsTotal: 0,
            freeCreditsAvailable: 0,
        });
    });

    it('returns all zeros when called with no resolver', () => {
        // Default resolver returns 'normal' so proExpiringCount stays 0.
        const summary = computeDashboardSummary([ws({ id: 'a', plan: 'pro_2', available: 100, totalCredits: 200 })]);
        expect(summary.proExpiringCount).toBe(0);
        expect(summary.proCount).toBe(1);
    });

    it('aggregates a pure pro-only mix (pro_0 + pro_1 + pro_2)', () => {
        const rows = [
            ws({ id: 'a', plan: 'pro_0', available: 10, totalCredits: 50 }),
            ws({ id: 'b', plan: 'pro_1', available: 20, totalCredits: 100 }),
            ws({ id: 'c', plan: 'pro_2', available: 30, totalCredits: 200 }),
        ];
        const summary = computeDashboardSummary(rows, allNormal);
        expect(summary.proCount).toBe(3);
        expect(summary.proCreditsAvailable).toBe(60);
        expect(summary.proCreditsTotal).toBe(350);
        expect(summary.freeCreditsAvailable).toBe(0);
        expect(summary.proExpiringCount).toBe(0);
    });

    it('counts FREE rows only toward freeCreditsAvailable, never toward Pro counters', () => {
        const rows = [
            ws({ id: 'a', plan: 'pro_1', available: 50, totalCredits: 100, dailyFree: 5 }),
            ws({ id: 'b', plan: 'free', available: 999, totalCredits: 999, dailyFree: 7 }),
        ];
        const summary = computeDashboardSummary(rows, allNormal);
        expect(summary.proCount).toBe(1);
        expect(summary.proCreditsAvailable).toBe(50);
        expect(summary.proCreditsTotal).toBe(100);
        expect(summary.freeCreditsAvailable).toBe(12);
    });

    it('reads pro_0 enriched available/totalCredits straight from the row', () => {
        // Per mem://features/macro-controller/pro-zero-credit-balance the row is
        // already overlaid upstream with /credit-balance totals — the aggregator
        // must not re-derive from *_limit.
        const rows = [ws({ id: 'p0', plan: 'pro_0', available: 7, totalCredits: 35 })];
        const summary = computeDashboardSummary(rows, allNormal);
        expect(summary.proCreditsAvailable).toBe(7);
        expect(summary.proCreditsTotal).toBe(35);
    });

    it('counts expire / expire-soon / canceled toward proExpiringCount', () => {
        const rows = [
            ws({ id: 'normal', plan: 'pro_1' }),
            ws({ id: 'cx', plan: 'pro_2' }),
            ws({ id: 'es', plan: 'pro_1' }),
            ws({ id: 'ex', plan: 'pro_0' }),
            ws({ id: 'pdex', plan: 'pro_1' }),
        ];
        const summary = computeDashboardSummary(
            rows,
            byKind({
                cx: 'canceled',
                es: 'expire-soon',
                ex: 'expired',
                pdex: 'past-due-expiring',
            }),
        );
        expect(summary.proCount).toBe(5);
        expect(summary.proExpiringCount).toBe(4);
    });

    it('ignores expiring state on FREE rows for proExpiringCount', () => {
        const rows = [
            ws({ id: 'a', plan: 'free' }),
        ];
        const summary = computeDashboardSummary(rows, () => 'expire-soon');
        expect(summary.proCount).toBe(0);
        expect(summary.proExpiringCount).toBe(0);
    });

    it('handles whitespace and case in plan literals', () => {
        const rows = [
            ws({ id: 'a', plan: ' PRO_1 ', available: 10, totalCredits: 20 }),
            ws({ id: 'b', plan: 'Pro_2', available: 30, totalCredits: 40 }),
            ws({ id: 'c', plan: 'starter', available: 99, totalCredits: 99 }),
        ];
        const summary = computeDashboardSummary(rows, allNormal);
        expect(summary.proCount).toBe(2);
        expect(summary.proCreditsAvailable).toBe(40);
        expect(summary.proCreditsTotal).toBe(60);
    });

    it('treats non-finite numbers (NaN / undefined) as 0', () => {
        const rows = [
            ws({ id: 'a', plan: 'pro_1', available: NaN as unknown as number, totalCredits: 50 }),
        ];
        const summary = computeDashboardSummary(rows, allNormal);
        expect(summary.proCreditsAvailable).toBe(0);
        expect(summary.proCreditsTotal).toBe(50);
    });
});
