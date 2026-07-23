import type { WorkspaceCredit } from '../types';
import { calcTotalCredits } from '../credit-api';
import { CreditFetchOutcome } from './credit-fetch-outcome';
import { readCreditBalanceUpdateCacheSync } from './credit-balance-cache';
import { hasInlineCredits, isUnifiedBillingWorkspace } from './credit-fetch-controller';
import { mapPlanFromWire, shouldFetchCreditBalanceForPlan } from './plan-mapper';
import { resolveDisplayAvailable, resolveDisplayTotal } from './credit-balance-display';

export type CreditSummarySource = 'Inline' | 'Cache' | 'Timeout' | 'Missing' | 'Pending';

export interface CreditSummary {
    readonly available: number;
    readonly total: number;
    readonly daily: number;
    readonly dailyLimit: number;
    readonly billingAvailable: number;
    readonly billingLimit: number;
    readonly rollover: number;
    readonly rolloverLimit: number;
    readonly totalUsed: number;
    /** Wire `available_balance`. 0 when unavailable. */
    readonly availableBalance: number;
    /** Wire `cloud_remaining`. 0 when unavailable. */
    readonly cloudRemaining: number;
    /** Wire `ai_remaining`. 0 when unavailable. */
    readonly aiRemaining: number;
    readonly source: CreditSummarySource;
    readonly renderDash: boolean;
}

function inlineTotal(ws: WorkspaceCredit): number {
    // v4.25.0: bypass legacy list-endpoint math for enriched rows. When
    // `overlayCreditBalanceOnWorkspace` has run, `ws.totalCredits` already
    // reflects the authoritative `/credit-balance` totals; recomputing via
    // `calcTotalCredits` would pull the stale sub-bucket `ws.limit` back
    // in and reintroduce the ktlo_2 wrong-total regression.
    if (ws.enriched === true) {
        return Math.max(0, Math.round(ws.totalCredits || 0));
    }
    return Math.round(ws.totalCredits ?? calcTotalCredits(
        ws.freeGranted,
        ws.dailyLimit,
        ws.limit,
        ws.topupLimit,
        ws.rolloverLimit,
        ws.plan,
    ));
}

function buildCachedSummary(ws: WorkspaceCredit, balance: NonNullable<ReturnType<typeof readCreditBalanceUpdateCacheSync>>['balance']): CreditSummary {
    const b = balance!;
    return {
        available: resolveDisplayAvailable(b),
        total: resolveDisplayTotal(b),
        daily: Math.max(0, Math.round(b.dailyRemaining)),
        dailyLimit: Math.max(0, Math.round(b.dailyLimit)),
        billingAvailable: Math.max(0, Math.round(b.totalRemaining - b.dailyRemaining)),
        billingLimit: Math.max(0, Math.round(b.totalGranted - b.dailyLimit)),
        rollover: Math.max(0, Math.round(ws.rollover || 0)),
        rolloverLimit: Math.max(0, Math.round(ws.rolloverLimit || 0)),
        totalUsed: Math.max(0, Math.round(b.totalBillingPeriodUsed)),
        availableBalance: Math.max(0, Math.round(b.availableBalance)),
        cloudRemaining: Math.max(0, Math.round(b.cloudRemaining)),
        aiRemaining: Math.max(0, Math.round(b.aiRemaining)),
        source: 'Cache',
        renderDash: false,
    };
}

function zeroSummary(source: CreditSummary['source'], renderDash: boolean): CreditSummary {
    return {
        available: 0, total: 0, daily: 0, dailyLimit: 0,
        billingAvailable: 0, billingLimit: 0, rollover: 0, rolloverLimit: 0,
        totalUsed: 0,
        availableBalance: 0, cloudRemaining: 0, aiRemaining: 0,
        source, renderDash,
    };
}

export function resolveCreditSummary(ws: WorkspaceCredit): CreditSummary {
    const cached = ws.id ? readCreditBalanceUpdateCacheSync(ws.id) : null;
    if (cached?.balance) { return buildCachedSummary(ws, cached.balance); }
    if (cached?.outcome === CreditFetchOutcome.Timeout) { return zeroSummary('Timeout', true); }

    const plan = mapPlanFromWire(ws.plan);
    const total = inlineTotal(ws);
    const available = Math.max(0, Math.round(ws.available || 0));
    // Only fall back to Pending when the row has no usable inline signal AND
    // the plan requires a /credit-balance fetch. Rows that already carry
    // non-zero `available`/`totalCredits` (e.g. pro_0 enriched upstream, or
    // legacy list-endpoint hits) render immediately from inline values so
    // aggregators and sorts don't collapse to zero while the background
    // enrichment settles.
    // Unified-billing workspaces (ktlo_*, or `experimental_features.unified_billing`)
    // report ONLY the stale cloud sub-bucket in `available`/`totalCredits`
    // until `/credit-balance` overlays the real totals. Trusting those inline
    // fields would pin the row at (e.g.) 20/20 for a ktlo_2 whose real
    // grant is 315 — Pend until the enrichment fetch settles.
    const staleUnifiedBilling = ws.enriched !== true && isUnifiedBillingWorkspace(ws);
    const noInlineSignal = available === 0 && total === 0;
    if ((noInlineSignal || staleUnifiedBilling) && ws.enriched !== true
        && shouldFetchCreditBalanceForPlan(plan) && !hasInlineCredits(ws)) {
        return zeroSummary('Pending', true);
    }
    return {
        available,
        total,
        daily: Math.max(0, Math.round(ws.dailyFree || 0)),
        dailyLimit: Math.max(0, Math.round(ws.dailyLimit || 0)),
        billingAvailable: Math.max(0, Math.round(ws.billingAvailable || 0)),
        billingLimit: Math.max(0, Math.round(ws.limit || 0)),
        rollover: Math.max(0, Math.round(ws.rollover || 0)),
        rolloverLimit: Math.max(0, Math.round(ws.rolloverLimit || 0)),
        totalUsed: Math.max(0, Math.round(ws.totalCreditsUsed || 0)),
        availableBalance: 0,
        cloudRemaining: 0,
        aiRemaining: 0,
        source: available === 0 && total === 0 ? 'Missing' : 'Inline',
        renderDash: false,
    };
}

