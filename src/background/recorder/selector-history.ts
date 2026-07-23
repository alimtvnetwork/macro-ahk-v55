/**
 * Marco Extension — Per-Selector Replay History
 *
 * Pure helper that takes a Step's persisted {@link PersistedReplayStepResult}
 * rows and reduces them into per-selector outcome timelines. Lets the UI
 * answer "when did selector X start failing?" without re-running anything.
 *
 * Bucketing rule:
 *   - We bucket by `ResolvedXPath` because that is what the executor
 *     persists per attempt (the resolver collapses the primary selector
 *     chain to a single expression). When `ResolvedXPath` is null the
 *     row falls into the `__unknown__` bucket so the UI can still surface it.
 *   - The original (raw) selector expression is matched against the
 *     bucket key when available so the comparison panel can display
 *     history alongside the matching selector row.
 *
 * Outputs (per bucket):
 *   - `Outcomes`         — chronological list of `{ At, IsOk, RunId, Error }`.
 *   - `LastSuccessAt`    — ISO of the most recent successful run, or null.
 *   - `FirstFailureAfterLastSuccessAt` — ISO of the first failure after the
 *     last success (or first-ever failure when the selector has never
 *     succeeded). This is the "when did it start failing?" answer.
 *   - `ConsecutiveFailures` — count of failures since the last success.
 *   - `Status`           — `"healthy" | "regressed" | "always-failing" | "unknown"`.
 *
 * Pure: no DB, no I/O. The async sister `loadSelectorHistoryForStep` in
 * `replay-run-persistence.ts` is the production caller.
 *
 * @see ./replay-run-persistence.ts — Persists the rows this helper consumes.
 * @see ./selector-comparison.ts    — Live counterpart (current DOM state).
 */

import type { PersistedReplayStepResult } from "./replay-run-persistence";

export interface SelectorOutcomePoint {
    readonly RunId: number;
    readonly At: string;            // ISO timestamp
    readonly IsOk: boolean;
    readonly Error: string | null;
    readonly DurationMs: number;
}

export type SelectorHealth = "healthy" | "regressed" | "always-failing" | "unknown";

export interface SelectorHistoryBucket {
    /** `ResolvedXPath` value, or `null` for the legacy/unknown bucket. */
    readonly ResolvedExpression: string | null;
    readonly Outcomes: ReadonlyArray<SelectorOutcomePoint>;
    readonly LastSuccessAt: string | null;
    readonly FirstFailureAfterLastSuccessAt: string | null;
    readonly ConsecutiveFailures: number;
    readonly TotalRuns: number;
    readonly TotalFailures: number;
    readonly Status: SelectorHealth;
}

const UNKNOWN_KEY = "__unknown__";

/**
 * Group prior per-step results by resolved selector expression and compute
 * the per-bucket health summary.
 *
 * Rows can be passed in any order; the helper sorts by `StartedAt` ASC
 * before reducing so the resulting `Outcomes` array is chronological.
 */
export function buildSelectorHistory(
    results: ReadonlyArray<PersistedReplayStepResult>,
): ReadonlyArray<SelectorHistoryBucket> {
    if (results.length === 0) { return []; }
    const sorted = [...results].sort((a, b) => a.StartedAt.localeCompare(b.StartedAt));
    const byKey = groupOutcomesByResolvedKey(sorted);
    const buckets = summariseAllBuckets(byKey);
    sortBucketsByStatus(buckets);
    return buckets;
}

function groupOutcomesByResolvedKey(
    sorted: ReadonlyArray<PersistedReplayStepResult>,
): Map<string, SelectorOutcomePoint[]> {
    const byKey = new Map<string, SelectorOutcomePoint[]>();
    for (const row of sorted) {
        const key = row.ResolvedXPath ?? UNKNOWN_KEY;
        const list = byKey.get(key) ?? [];
        list.push(toOutcomePoint(row));
        byKey.set(key, list);
    }
    return byKey;
}

function toOutcomePoint(row: PersistedReplayStepResult): SelectorOutcomePoint {
    return {
        RunId: row.ReplayRunId,
        At: row.StartedAt,
        IsOk: row.IsOk === 1,
        Error: row.ErrorMessage,
        DurationMs: row.DurationMs,
    };
}

function summariseAllBuckets(
    byKey: Map<string, SelectorOutcomePoint[]>,
): SelectorHistoryBucket[] {
    const buckets: SelectorHistoryBucket[] = [];
    for (const [key, outcomes] of byKey) {
        buckets.push(summarise(key === UNKNOWN_KEY ? null : key, outcomes));
    }
    return buckets;
}

function sortBucketsByStatus(buckets: SelectorHistoryBucket[]): void {
    const order: Record<SelectorHealth, number> = {
        regressed: 0, "always-failing": 1, healthy: 2, unknown: 3,
    };
    buckets.sort((a, b) => order[a.Status] - order[b.Status]);
}

/**
 * Find the bucket that matches a live selector's resolved expression.
 * Returns `null` when the selector has no historical data.
 */
export function findHistoryForSelector(
    history: ReadonlyArray<SelectorHistoryBucket>,
    resolvedExpression: string | null,
): SelectorHistoryBucket | null {
    if (resolvedExpression === null) { return null; }
    return history.find((b) => b.ResolvedExpression === resolvedExpression) ?? null;
}

function summarise(
    resolved: string | null, outcomes: ReadonlyArray<SelectorOutcomePoint>,
): SelectorHistoryBucket {
    const { lastSuccessAt, lastSuccessIdx } = findLastSuccess(outcomes);
    const totals = countTotals(outcomes);
    return {
        ResolvedExpression: resolved, Outcomes: outcomes, LastSuccessAt: lastSuccessAt,
        FirstFailureAfterLastSuccessAt: findFirstFailureAfter(outcomes, lastSuccessIdx),
        ConsecutiveFailures: countTrailingFailures(outcomes),
        TotalRuns: totals.totalRuns, TotalFailures: totals.totalFailures,
        Status: classifyStatus(resolved, outcomes, totals),
    };
}

function findLastSuccess(
    outcomes: ReadonlyArray<SelectorOutcomePoint>,
): { lastSuccessAt: string | null; lastSuccessIdx: number } {
    for (let i = outcomes.length - 1; i >= 0; i--) {
        if (outcomes[i].IsOk) { return { lastSuccessAt: outcomes[i].At, lastSuccessIdx: i }; }
    }
    return { lastSuccessAt: null, lastSuccessIdx: -1 };
}

function findFirstFailureAfter(
    outcomes: ReadonlyArray<SelectorOutcomePoint>, lastSuccessIdx: number,
): string | null {
    if (lastSuccessIdx === -1) {
        return outcomes.find((o) => !o.IsOk)?.At ?? null;
    }
    for (let i = lastSuccessIdx + 1; i < outcomes.length; i++) {
        if (!outcomes[i].IsOk) { return outcomes[i].At; }
    }
    return null;
}

function countTotals(
    outcomes: ReadonlyArray<SelectorOutcomePoint>,
): { totalRuns: number; totalFailures: number } {
    return {
        totalRuns: outcomes.length,
        totalFailures: outcomes.filter((o) => !o.IsOk).length,
    };
}

function countTrailingFailures(outcomes: ReadonlyArray<SelectorOutcomePoint>): number {
    let consecutive = 0;
    for (let i = outcomes.length - 1; i >= 0 && !outcomes[i].IsOk; i--) {
        consecutive += 1;
    }
    return consecutive;
}

function classifyStatus(
    resolved: string | null,
    outcomes: ReadonlyArray<SelectorOutcomePoint>,
    totals: { totalRuns: number; totalFailures: number },
): SelectorHealth {
    if (resolved === null && totals.totalRuns === 0) { return "unknown"; }
    if (totals.totalFailures === 0) { return "healthy"; }
    if (totals.totalFailures === totals.totalRuns) { return "always-failing"; }
    const last = outcomes[outcomes.length - 1];
    return last.IsOk ? "healthy" : "regressed";
}
