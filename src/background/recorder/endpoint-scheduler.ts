/**
 * Marco Extension — Endpoint Scheduler (Spec 17 §3.4)
 *
 * Manages a small pool of `setInterval` timers that periodically refresh
 * registered endpoint data sources. Returns a single teardown function so
 * callers can clear ALL active timers atomically (e.g. on session end).
 *
 * Capped at `MAX_ACTIVE_TIMERS = 32` — registrations beyond that are
 * silently dropped and reported in `result.Skipped` so the caller can
 * surface a warning toast.
 *
 * Pure module — no chrome.* / DOM dependencies; the tick callback is
 * passed in by the caller.
 */

export interface ScheduledFetch {
    readonly DataSourceId: number;
    readonly IntervalMs: number;
}

export interface SchedulerStartResult {
    readonly Teardown: () => void;
    readonly Active: ReadonlyArray<number>;
    readonly Skipped: ReadonlyArray<number>;
}

export const MAX_ACTIVE_TIMERS = 32;
export const MIN_INTERVAL_MS = 1_000;

interface SchedulerAccumulator {
    handles: ReturnType<typeof setInterval>[];
    active: number[];
    skipped: number[];
}

function registerFetch(
    spec: ScheduledFetch,
    acc: SchedulerAccumulator,
    onTick: (dataSourceId: number) => void,
    setIntervalImpl: typeof setInterval,
): void {
    const capped = acc.active.length >= MAX_ACTIVE_TIMERS;
    const tooSmall = spec.IntervalMs < MIN_INTERVAL_MS;
    if (capped || tooSmall) { acc.skipped.push(spec.DataSourceId); return; }
    acc.handles.push(setIntervalImpl(() => onTick(spec.DataSourceId), spec.IntervalMs));
    acc.active.push(spec.DataSourceId);
}

export function startScheduler(
    fetches: ReadonlyArray<ScheduledFetch>,
    onTick: (dataSourceId: number) => void,
    setIntervalImpl: typeof setInterval = setInterval,
    clearIntervalImpl: typeof clearInterval = clearInterval,
): SchedulerStartResult {
    const acc: SchedulerAccumulator = { handles: [], active: [], skipped: [] };
    for (const spec of fetches) registerFetch(spec, acc, onTick, setIntervalImpl);
    const teardown = (): void => {
        for (const h of acc.handles) clearIntervalImpl(h);
        acc.handles.length = 0;
    };
    return { Teardown: teardown, Active: acc.active, Skipped: acc.skipped };
}
