/**
 * Marco Extension — shared React-Testing-Library `act(...)` helpers.
 *
 * Plan 10 Step 2 deliverable. Every helper stays under the 15-line
 * function cap (see `.lovable/spec/commands/06-function-size-cap-15-lines.md`).
 *
 * Categories these helpers cover (see
 * `.lovable/plans/subtasks/32-plan-10/01-vitest-inventory.md`):
 *
 *   A. async-mount effect flushes  -> `flushEffects()`
 *   B. controlled prop-change setState  -> `actRerender()`
 *   C. fake+real-timer interleaving  -> `withFakeTimers()` / `waitRealMs()`
 *
 * Import via the barrel:
 *   import { flushEffects, actRerender, waitRealMs } from "@/test/support";
 */

import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Flushes the current microtask queue inside `act(...)` so that async
 * mount effects (clipboard probes, boot-trail hydrate, status fetch)
 * resolve BEFORE the caller's next assertion runs.
 *
 * `ticks` controls how many microtask flushes are performed. Two ticks
 * covers the common case: one for the awaited fetch, one for the
 * subsequent `setState`.
 */
export async function flushEffects(ticks: number = 2): Promise<void> {
    await act(async () => {
        for (let i = 0; i < ticks; i += 1) {
            await Promise.resolve();
        }
    });
}

/**
 * Wraps `view.rerender(...)` in `act(...)` and flushes effects, so
 * prop-change-driven `useEffect` state updates land inside act.
 */
export async function actRerender(
    rerender: (ui: React.ReactElement) => void,
    ui: React.ReactElement,
): Promise<void> {
    await act(async () => { rerender(ui); });
    await flushEffects();
}

/**
 * Awaits a real-timer wait inside `act(...)`. Use only when a component
 * schedules its own `setTimeout` before the test could install fake
 * timers (see the pulse-clear pattern in
 * `LiveRecordedActionsTree.scroll.test.tsx`).
 */
export async function waitRealMs(ms: number): Promise<void> {
    await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
    });
}

/**
 * Runs `body` with fake timers installed and restores real timers on
 * exit, even if `body` throws. `advanceMs` is optional; when provided
 * it is invoked inside `act(...)` after `body` resolves.
 */
export async function withFakeTimers(
    body: () => Promise<void> | void,
    advanceMs?: number,
): Promise<void> {
    vi.useFakeTimers();
    try {
        await body();
        if (advanceMs !== undefined) {
            await act(async () => { vi.advanceTimersByTime(advanceMs); });
        }
    } finally {
        vi.useRealTimers();
    }
}
