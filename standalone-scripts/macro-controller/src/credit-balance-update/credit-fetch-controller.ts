import type { WorkspaceCredit } from '../types';
import { onSettingsChange } from '../settings-store';
import { CreditFetchOutcome } from './credit-fetch-outcome';
import { fetchWorkspaceCreditBalance } from './credit-balance-fetcher';
import { readCreditBalanceUpdateCache, writeCreditBalanceUpdateCache, makeCachedResult, invalidateCreditBalanceUpdateCache, CREDIT_BALANCE_UPDATE_CACHE_TTL_MS } from './credit-balance-cache';
import { mapPlanFromWire, shouldFetchCreditBalanceForPlan } from './plan-mapper';
import { Plan } from './plan';
import type { CreditBalance, CreditFetchResult } from './credit-balance-types';
import { logError } from '../error-utils';
import { resolveDisplayAvailable, resolveDisplayTotal } from './credit-balance-display';
import { toWireWorkspaceRaw } from '../types/wire-workspace-raw';

const DEFAULT_TIMEOUT_MS = 3000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 15_000;
const SOURCE_INLINE = 'inline:/user/workspaces';

let timeoutMs = DEFAULT_TIMEOUT_MS;
const inFlight = new Map<string, Promise<CreditFetchResult>>();
let settingsUnsubscribe: (() => void) | null = null;

// Plan 01 / Step 7: tiny pub-sub so UI layers can re-paint the affected
// workspace row after the resolver completes (success OR failure). Avoids the
// "value is in cache but never pushed to DOM until next manual refresh" race
// from `.lovable/plan.md` RCA #4.
export type CreditResolvedListener = (workspaceId: string, result: CreditFetchResult) => void;
const creditResolvedListeners = new Set<CreditResolvedListener>();

export function onCreditResolved(listener: CreditResolvedListener): () => void {
    creditResolvedListeners.add(listener);
    return function unsubscribe(): void {
        creditResolvedListeners.delete(listener);
    };
}

function emitCreditResolved(workspaceId: string, result: CreditFetchResult): void {
    for (const listener of creditResolvedListeners) {
        try {
            listener(workspaceId, result);
        } catch (caught: CaughtError) {
            logError(
                'CreditBalanceUpdate.controller',
                'Path: standalone-scripts/macro-controller/src/credit-balance-update/credit-fetch-controller.ts. Missing item: CreditResolved listener for workspace ' + workspaceId + '. Reason: listener threw during emit — continuing other listeners.',
                caught,
            );
        }
    }
}

interface CreditFetchSettingsShape {
    readonly creditFetchDelayMs?: number | undefined;
}

function clampTimeoutMs(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_TIMEOUT_MS;
    }
    if (value < MIN_TIMEOUT_MS) {
        return MIN_TIMEOUT_MS;
    }
    if (value > MAX_TIMEOUT_MS) {
        return MAX_TIMEOUT_MS;
    }
    return Math.floor(value);
}

function readRawGrantTypeBalances(ws: WorkspaceCredit): ReadonlyArray<object> | null {
    const wireRaw = toWireWorkspaceRaw(ws.rawApi);
    const fromRawApi = wireRaw?.grant_type_balances;
    if (Array.isArray(fromRawApi)) {
        return fromRawApi as ReadonlyArray<object>;
    }

    const fromRaw = ws.raw?.grant_type_balances;
    if (Array.isArray(fromRaw)) {
        return fromRaw as ReadonlyArray<object>;
    }

    return null;
}

/**
 * A grant-type-balance row counts as "inline data" only if it carries a
 * non-zero number. New free / Lite (ktlo) / Cancelled accounts can ship
 * `grant_type_balances: [{ total_granted: 0, total_remaining: 0, ... }]`
 * — a zero-row that previously short-circuited the /credit-balance fetch
 * and pinned the UI at 0/0. See `.lovable/plan.md` 2026-06-06 RCA #3.
 */
function isNonZeroGrantRow(row: object): boolean {
    const r = row as Record<string, unknown>;
    // Wire ships two variants: `granted`/`remaining` on real
    // grant_type_balances rows (unified billing), and the legacy
    // `total_granted`/`total_remaining` shape on older accounts. Check both.
    const keys = ['granted', 'remaining', 'total_granted', 'total_remaining', 'total_billing_period_used', 'daily_limit', 'daily_remaining'];
    for (const k of keys) {
        const v = Number(r[k]);
        if (Number.isFinite(v) && v > 0) {
            return true;
        }
    }
    return false;
}

/**
 * Under unified billing (Lovable's list endpoint post-migration for
 * `ktlo_*` and any workspace with `experimental_features.unified_billing`),
 * `billing_period_credits_limit` no longer represents the total grant — it
 * is only the cloud sub-bucket (e.g. `20` for a `ktlo_2` workspace whose
 * real `total_granted` is `315`). Trusting `ws.limit > 0` as an "inline
 * hit" pins those rows at the wrong number and blocks the /credit-balance
 * fetch. So for plans whose authoritative source is /credit-balance we
 * IGNORE `ws.limit` and require a real non-zero `grant_type_balances` row.
 */
export function isUnifiedBillingWorkspace(ws: WorkspaceCredit): boolean {
    const wirePlan = String(ws.plan || '').trim().toLowerCase();
    if (wirePlan.startsWith('ktlo_')) return true;
    const wireRaw = toWireWorkspaceRaw(ws.rawApi);
    const candidate: unknown = wireRaw?.experimental_features ?? ws.raw?.experimental_features;
    if (candidate === null || typeof candidate !== 'object') return false;
    return (candidate as Record<string, unknown>).unified_billing === true;
}

export function hasInlineCredits(ws: WorkspaceCredit): boolean {
    // Unified-billing workspaces (ktlo_*, or `experimental_features.unified_billing=true`)
    // must ALWAYS take the /credit-balance path — the list endpoint's
    // `grant_type_balances` and `billing_period_credits_limit` reflect ONLY
    // the cloud sub-bucket (e.g. `[{granted: 20, remaining: 20}]` for a
    // `ktlo_2` workspace whose real `total_granted` is `315`). Trusting
    // either field as an "inline hit" pins the row at 20/20 and blocks the
    // enrichment fetch. Check this BEFORE any inline-shortcut branch.
    if (isUnifiedBillingWorkspace(ws)) {
        return false;
    }
    const balances = readRawGrantTypeBalances(ws);
    if (Array.isArray(balances) && balances.some(isNonZeroGrantRow)) {
        return true;
    }
    return Number(ws.limit || 0) > 0;
}

function buildInlineBalance(ws: WorkspaceCredit): CreditBalance {
    const totalRemaining = Math.max(0, Math.round(ws.available || 0));

    return {
        totalRemaining,
        totalGranted: Math.max(0, Math.round(ws.totalCredits || 0)),
        dailyRemaining: Math.max(0, Math.round(ws.dailyFree || 0)),
        dailyLimit: Math.max(0, Math.round(ws.dailyLimit || 0)),
        totalBillingPeriodUsed: Math.max(0, Math.round(ws.totalCreditsUsed || ws.used || 0)),
        availableBalance: totalRemaining,
        cloudRemaining: 0,
        aiRemaining: 0,
        ledgerEnabled: false,
        expiringGrants: [],
        grantTypeBalances: [],
    };
}

function buildResult(outcome: CreditFetchOutcome, balance: CreditBalance | null, errorDetail: string | null): CreditFetchResult {
    return {
        outcome,
        balance,
        fetchedAt: Date.now(),
        sourceUrl: SOURCE_INLINE,
        errorDetail,
    };
}

export function overlayCreditBalanceOnWorkspace(ws: WorkspaceCredit, balance: CreditBalance): void {
    const dailyLimit = Math.max(0, Math.round(balance.dailyLimit));
    const dailyRemaining = Math.max(0, Math.round(balance.dailyRemaining));
    ws.totalCredits = resolveDisplayTotal(balance);
    ws.available = resolveDisplayAvailable(balance);
    ws.totalCreditsUsed = Math.max(0, Math.round(balance.totalBillingPeriodUsed));
    ws.used = ws.totalCreditsUsed;
    ws.dailyLimit = dailyLimit;
    ws.dailyFree = dailyRemaining;
    ws.dailyUsed = Math.max(0, dailyLimit - dailyRemaining);
    // Mark the row as authoritative — downstream `calcTotalCredits` /
    // `calcAvailableCredits` bypass legacy list-endpoint math when this
    // flag is true. See changelog v4.25.0.
    ws.enriched = true;
}

function cacheTtlFor(result: CreditFetchResult): number {
    if (result.balance) {
        return CREDIT_BALANCE_UPDATE_CACHE_TTL_MS;
    }
    return Math.max(MIN_TIMEOUT_MS, timeoutMs);
}

async function fetchWithSingleAuthRetry(ws: WorkspaceCredit, plan: Plan): Promise<CreditFetchResult> {
    const first = await fetchWorkspaceCreditBalance({ workspaceId: ws.id, plan, timeoutMs });
    if (first.outcome !== CreditFetchOutcome.AuthError) {
        return first;
    }
    return fetchWorkspaceCreditBalance({ workspaceId: ws.id, plan, timeoutMs, forceTokenRefresh: true });
}

async function requestCreditsUncached(ws: WorkspaceCredit, plan: Plan): Promise<CreditFetchResult> {
    const result = await fetchWithSingleAuthRetry(ws, plan);
    void writeCreditBalanceUpdateCache(ws.id, result, cacheTtlFor(result));
    if (result.balance) {
        overlayCreditBalanceOnWorkspace(ws, result.balance);
    }
    return result;
}

export async function requestCredits(ws: WorkspaceCredit): Promise<CreditFetchResult> {
    if (!ws.id) {
        return buildResult(CreditFetchOutcome.Skipped, null, 'Missing workspace id');
    }

    const plan = mapPlanFromWire(ws.plan);
    if (!shouldFetchCreditBalanceForPlan(plan)) {
        return buildResult(CreditFetchOutcome.Skipped, null, 'Plan does not require /credit-balance');
    }

    if (hasInlineCredits(ws)) {
        return buildResult(CreditFetchOutcome.InlineHit, buildInlineBalance(ws), null);
    }

    const cached = await readCreditBalanceUpdateCache(ws.id);
    if (cached) {
        if (cached.balance) {
            overlayCreditBalanceOnWorkspace(ws, cached.balance);
        }
        return makeCachedResult(cached);
    }

    const existing = inFlight.get(ws.id);
    if (existing) {
        return existing;
    }

    const promise = requestCreditsUncached(ws, plan)
        .catch(function (caught: CaughtError): CreditFetchResult {
            const detail = caught instanceof Error ? caught.message : String(caught);
            logError(
                'CreditBalanceUpdate.controller',
                'Path: standalone-scripts/macro-controller/src/credit-balance-update/credit-fetch-controller.ts. Missing item: credit-balance result for workspace ' + ws.id + '. Reason: controller fetch failed without a structured result.',
                caught,
            );
            return buildResult(CreditFetchOutcome.HttpError, null, detail);
        })
        .finally(function (): void {
            inFlight.delete(ws.id);
        })
        .then(function (settled: CreditFetchResult): CreditFetchResult {
            // Plan 01 / Step 7: notify subscribers AFTER cache is written and
            // inFlight is cleared, so the re-render reads the fresh value.
            emitCreditResolved(ws.id, settled);
            return settled;
        });
    inFlight.set(ws.id, promise);
    return promise;
}

export function setTimeoutMs(nextTimeoutMs: number): void {
    timeoutMs = clampTimeoutMs(nextTimeoutMs);
}

export function getTimeoutMs(): number {
    return timeoutMs;
}

export async function invalidateCredits(workspaceId: string): Promise<void> {
    inFlight.delete(workspaceId);
    await invalidateCreditBalanceUpdateCache(workspaceId);
}

export function subscribeCreditFetchSettings(): void {
    if (settingsUnsubscribe) {
        return;
    }
    settingsUnsubscribe = onSettingsChange(function (overrides: CreditFetchSettingsShape): void {
        if (typeof overrides.creditFetchDelayMs === 'number') {
            setTimeoutMs(overrides.creditFetchDelayMs);
        }
    });
}

export function __resetCreditFetchControllerForTests(): void {
    timeoutMs = DEFAULT_TIMEOUT_MS;
    inFlight.clear();
    creditResolvedListeners.clear();
    if (settingsUnsubscribe) {
        settingsUnsubscribe();
        settingsUnsubscribe = null;
    }
}
