/**
 * Marco Extension — test-support barrel.
 *
 * Plan 10 Step 2: re-exports the shared `act(...)` helpers so tests can
 * import from one stable path (`@/test/support`).
 */

export { flushEffects, actRerender, waitRealMs, withFakeTimers } from "./act-helpers";
