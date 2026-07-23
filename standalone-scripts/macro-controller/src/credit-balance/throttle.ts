/**
 * MacroLoop Controller — Credit Balance Throttle Gate
 *
 * Spec: spec/22-app-issues/122a-credit-balance-throttle-and-persistence.md
 *
 * Two independent rules:
 *   1. PER_WS_MIN_INTERVAL_MS (10s) — same workspace cannot be re-fetched
 *      sooner than 10s after its last successful fetch.
 *   2. INTER_WS_GAP_MS (5s) — any auto/batch fetch must wait at least 5s
 *      after the most recent fetch of ANY workspace.
 *
 * Manual right-click "Credit Refresh" passes `force: true` and bypasses
 * both gates (but still calls recordFetch so subsequent auto cycles
 * respect the fresh timestamp).
 *
 * Pure module — no I/O. Hydration (Task 5) seeds the per-ws map from
 * SQLite at boot so throttle survives reloads.
 *
 * Standards:
 *   - mem://constraints/no-retry-policy — gate refusal returns false; no
 *     backoff scheduling. Callers either skip or wait.
 *   - mem://standards/no-error-swallowing — pure module, no catch blocks.
 */

/** Same-workspace minimum interval between auto fetches (ms). */
export const PER_WS_MIN_INTERVAL_MS = 10_000;

/** Inter-workspace gap inside an auto/batch run (ms). */
export const INTER_WS_GAP_MS = 5_000;

/** Per-workspace last-success timestamp (epoch ms). */
const lastFetchedAt = new Map<string, number>();

/** Last successful fetch of ANY workspace (epoch ms). Drives 5s gap. */
let lastAnyFetchAt = 0;

/** Decision returned by `shouldFetch`. `waitMs` is how long until allowed. */
export interface ShouldFetchDecision {
    readonly allowed: boolean;
    readonly waitMs: number;
    readonly reason: 'ok' | 'forced' | 'per-ws-cooldown' | 'inter-ws-cooldown';
}

/**
 * Decide whether a fetch for `workspaceId` is allowed at `nowMs`.
 *
 * - `force=true` ALWAYS returns allowed (manual refresh path).
 * - Otherwise enforces PER_WS_MIN_INTERVAL_MS, then INTER_WS_GAP_MS.
 */
export function shouldFetch(
    workspaceId: string,
    nowMs: number = Date.now(),
    force: boolean = false,
): ShouldFetchDecision {
    if (force) {
        return { allowed: true, waitMs: 0, reason: 'forced' };
    }
    const lastWs = lastFetchedAt.get(workspaceId) ?? 0;
    const perWsWait = lastWs + PER_WS_MIN_INTERVAL_MS - nowMs;
    if (perWsWait > 0) {
        return { allowed: false, waitMs: perWsWait, reason: 'per-ws-cooldown' };
    }
    const interWsWait = lastAnyFetchAt + INTER_WS_GAP_MS - nowMs;
    if (interWsWait > 0) {
        return { allowed: false, waitMs: interWsWait, reason: 'inter-ws-cooldown' };
    }
    return { allowed: true, waitMs: 0, reason: 'ok' };
}

/** Record a successful fetch. Updates both per-ws and global timestamps. */
export function recordFetch(workspaceId: string, nowMs: number = Date.now()): void {
    if (!workspaceId) {
        return;
    }
    lastFetchedAt.set(workspaceId, nowMs);
    if (nowMs > lastAnyFetchAt) {
        lastAnyFetchAt = nowMs;
    }
}

/**
 * Seed a workspace's last-fetched timestamp from persisted cache (boot
 * hydrator). Does NOT bump the global `lastAnyFetchAt` — a cold-start
 * batch should be able to fire immediately, then space subsequent calls
 * by INTER_WS_GAP_MS.
 */
export function seedLastFetched(workspaceId: string, fetchedAtMs: number): void {
    if (!workspaceId || fetchedAtMs <= 0) {
        return;
    }
    const existing = lastFetchedAt.get(workspaceId) ?? 0;
    if (fetchedAtMs > existing) {
        lastFetchedAt.set(workspaceId, fetchedAtMs);
    }
}

/** Read-only inspector (tests + diagnostics). */
export function getLastFetched(workspaceId: string): number {
    return lastFetchedAt.get(workspaceId) ?? 0;
}

/** Read-only inspector (tests + diagnostics). */
export function getLastAnyFetchAt(): number {
    return lastAnyFetchAt;
}

/** Test-only reset. Not exported from the module barrel. */
export function __resetThrottleForTests(): void {
    lastFetchedAt.clear();
    lastAnyFetchAt = 0;
}
