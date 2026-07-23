/**
 * MacroLoop Controller, Credit Balance Batch Refresh (predicate-driven).
 *
 * Spec: spec/22-app-issues/122a-credit-balance-throttle-and-persistence.md
 *
 * Iterates every candidate flagged `dispatchable=true` by the upstream
 * wire wrapper (`batch-refresh-from-wire.ts`), calls `fetchAndPersist()`
 * sequentially with a 5s gap between calls. Non-dispatchable candidates
 * are recorded with outcome `'skipped'` and a machine-readable
 * `reason` (e.g. `'plan-not-eligible'`).
 *
 * This module owns NO plan-literal policy. Plan selection lives entirely
 * in the wire wrapper so any future policy change (e.g. widening to
 * pro_2) is a single-file edit there.
 *
 * Single sequential pass, no retry, no backoff
 * (mem://constraints/no-retry-policy). Each iteration catches and logs
 * via logError (mem://standards/no-error-swallowing).
 */

import { logError } from '../error-utils';
import { log } from '../logger';
import { fetchAndPersist, type FetchAndPersistResult } from './fetcher';
import { INTER_WS_GAP_MS } from './throttle';

/** Machine-readable reason attached to a `'skipped'` outcome. */
export type BatchSkipReason = 'plan-not-eligible';

/** Minimal workspace shape needed by the batch. */
export interface BatchWorkspaceCandidate {
    readonly workspaceId: string;
    /**
     * When true the candidate is executed through `fetchAndPersist`.
     * When false the iteration records outcome `'skipped'` with
     * `reason='plan-not-eligible'`. Policy owner is the wire wrapper,
     * not this dispatcher.
     */
    readonly dispatchable: boolean;
}

/**
 * Options accepted by `batchRefreshProOneCreditBalances`. The dispatcher
 * is plan-agnostic: plan-literal policy (e.g. `allowPlan0`) lives on the
 * wire wrapper (`WireBatchRefreshOptions` in
 * `./batch-refresh-from-wire.ts`) and MUST NOT be added here.
 */
export interface BatchRefreshOptions {
    /** Bypass per-workspace 10s throttle (manual/shared force path). Default false. */
    readonly force?: boolean;
    /** Fetch source tag surfaced in telemetry. Default 'batch'. */
    readonly source?: 'batch' | 'manual';
}


/** Per-workspace iteration result, surfaced to callers/tests. */
export interface BatchRefreshIterationResult {
    readonly workspaceId: string;
    readonly outcome: FetchAndPersistResult['outcome'] | 'skipped';
    /** Present only when `outcome === 'skipped'`. */
    readonly reason?: BatchSkipReason;
}


export interface BatchRefreshSummary {
    readonly total: number;
    readonly attempted: number;
    readonly fetched: number;
    readonly throttled: number;
    readonly failed: number;
    readonly skipped: number;
    readonly results: ReadonlyArray<BatchRefreshIterationResult>;
}

/** Sleep helper, sequential, no recursion, single pending timer. */
function delay(ms: number): Promise<void> {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

interface BatchCounters {
    fetched: number;
    throttled: number;
    failed: number;
    skipped: number;
    attempted: number;
}

async function runOneWorkspace(
    candidate: BatchWorkspaceCandidate,
    counters: BatchCounters,
    results: BatchRefreshIterationResult[],
    force: boolean,
    source: 'batch' | 'manual',
): Promise<void> {
    counters.attempted += 1;
    try {
        const result = await fetchAndPersist(candidate.workspaceId, { force, source });
        results.push({ workspaceId: candidate.workspaceId, outcome: result.outcome });
        if (result.outcome === 'fetched') { counters.fetched += 1; }
        else if (result.outcome === 'throttled') { counters.throttled += 1; }
        else { counters.failed += 1; }
    } catch (caughtError: unknown) {
        counters.failed += 1;
        results.push({ workspaceId: candidate.workspaceId, outcome: 'failed' });
        logError(
            'CreditBalance.batchRefresh',
            'fetchAndPersist threw for workspaceId=' + candidate.workspaceId,
            caughtError,
        );
    }
}

/**
 * @internal Do NOT import directly outside `./batch-refresh-from-wire.ts`
 * or `__tests__/`. All production callers MUST route through
 * `batchRefreshFromWire`, which owns plan-literal policy and enforces
 * the plan-10 mapper + predicate. Enforced by `no-restricted-imports`
 * in `eslint.config.js`.
 */
export async function batchRefreshProOneCreditBalances(
    candidates: ReadonlyArray<BatchWorkspaceCandidate>,
    options?: BatchRefreshOptions,
): Promise<BatchRefreshSummary> {
    const results: BatchRefreshIterationResult[] = [];
    const counters: BatchCounters = { fetched: 0, throttled: 0, failed: 0, skipped: 0, attempted: 0 };
    const force = options?.force === true;
    const source: 'batch' | 'manual' = options?.source ?? 'batch';

    const dispatchable = candidates.filter(function (c) { return c.dispatchable === true; });

    log('CreditBalance.batchRefresh: starting (candidates=' + String(candidates.length)
        + ', dispatchable=' + String(dispatchable.length)
        + ', gapMs=' + String(INTER_WS_GAP_MS)
        + ', force=' + String(force) + ', source=' + source + ')', 'info');

    for (const c of candidates) {
        if (c.dispatchable !== true) {
            counters.skipped += 1;
            results.push({ workspaceId: c.workspaceId, outcome: 'skipped', reason: 'plan-not-eligible' });
        }
    }

    for (let i = 0; i < dispatchable.length; i += 1) {
        if (i > 0) { await delay(INTER_WS_GAP_MS); }
        await runOneWorkspace(dispatchable[i], counters, results, force, source);
    }

    const summary: BatchRefreshSummary = {
        total: candidates.length,
        attempted: counters.attempted,
        fetched: counters.fetched,
        throttled: counters.throttled,
        failed: counters.failed,
        skipped: counters.skipped,
        results,
    };

    log('CreditBalance.batchRefresh: done (attempted=' + String(counters.attempted)
        + ', fetched=' + String(counters.fetched)
        + ', throttled=' + String(counters.throttled)
        + ', failed=' + String(counters.failed)
        + ', skipped=' + String(counters.skipped) + ')', 'success');

    return summary;
}
