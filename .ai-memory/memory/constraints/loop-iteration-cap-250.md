---
name: Loop iteration cap 250
description: Hard ceiling of 250 iterations on every background loop, setInterval, setTimeout-chain, or repeat cycle in the macro-controller; auto-cancel on overflow
type: constraint
---

# Loop iteration cap: 250 (hard, non-negotiable)

## User directive (verbatim, 2026-07-19)

> "any looping should not run more than two fifty times. So if there is a looping that is running, that should have a highest level of two fifty, or three hundred, let's say, whatever the highest maximum plan is. So it shouldn't be more than two hundred, yeah. Let's just put two fifty, so it should never exceed that number, any looping interval or timeout in the background controller so that it does not waste the resource. So if that number exceeded, it should always cancel out."

## Rule

- **MAX_LOOP_ITERATIONS = 250** for every background/controller loop, `setInterval` tick counter, chained `setTimeout` reinstall, repeat-macro cycle, poll waiter, retry-of-retries chain, and any user-configurable "run N times" input.
- User-facing "repeat N times" fields MUST clamp input to `[1, 250]` at the boundary; higher values are auto-lowered with a toast, never accepted.
- Any loop counter that reaches 250 MUST auto-cancel: clear the interval/timeout, tear down observers, log a single `LoopCapReached` info event with loop name + iteration count + reason=`iteration-cap-250`, and stop. No retry, no backoff, no re-arm.
- This cap is INDEPENDENT of the no-retry policy and the timer-teardown policy. All three apply together.
- Applies to: `repeat-loop-ui.ts`, `task-queue.ts`, `loop-cycle-fallback.ts`, `progress-probe.ts`, any `trackedSetInterval` caller, credit-balance pollers, workspace pollers, injection retry loops, prompt-health-check loops.

## Why

Wasted resources on runaway loops has been a recurring root cause. 250 covers the highest plan's "repeat 250 times" ceiling; beyond that is always a bug or a misconfiguration.

## How to apply

1. Centralize the constant in `standalone-scripts/macro-controller/src/constants.ts` as `MAX_LOOP_ITERATIONS = 250`.
2. Every loop site imports it. No inline `250` literals scattered across files.
3. Every clamp site logs `LoopCapClamped` (input>250 clamped to 250) at the boundary.
4. Every cancel site logs `LoopCapReached` and calls the paired teardown (interval/observer/listener).
5. CI check: grep for `setInterval|setTimeout|for.*<.*=` in `standalone-scripts/macro-controller/src/**` and fail on new call sites without a `MAX_LOOP_ITERATIONS` guard (add to `scripts/`).

## Related

- `mem://constraints/no-retry-policy` (sequential fail-fast, no exponential backoff)
- `mem://standards/timer-and-observer-teardown` (paired teardown + pagehide)
