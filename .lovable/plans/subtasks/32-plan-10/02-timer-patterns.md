# Plan 10 Step 4: Fake / real timer interleaving audit

Scope: every `*.test.*` / `*.spec.*` under `src/` that toggles Vitest timers.
Method: `rg -l "useFakeTimers|useRealTimers"` then per-file line inspection.

## Files audited (7)

1. `src/lib/__tests__/step-executors.test.ts`
2. `src/lib/__tests__/keyword-event-playback.test.ts`
3. `src/lib/__tests__/keyword-event-chain.test.ts`
4. `src/test/regression/recorder-xpath-batch.test.ts`
5. `src/components/recorder/__tests__/FloatingController.test.tsx`
6. `src/components/recorder/__tests__/LiveRecordedActionsTree.scroll.test.tsx`
7. `src/background/recorder/__tests__/data-source-extended.test.ts`

## Pattern summary

| File | Fake install site | Restore site | Advance API | Risk |
|------|-------------------|--------------|-------------|------|
| step-executors | inline (L51) | inline (L55) | `advanceTimersByTime` (sync) | Low, single test body, symmetric |
| keyword-event-playback | `beforeEach` | `afterEach` | `advanceTimersByTimeAsync` | Low, hook-scoped, symmetric |
| keyword-event-chain | inline per-test (L108, L132, L193, L214, L233) | `afterEach` + trailing inline | `advanceTimersByTimeAsync` | Medium: inline install without paired inline restore relies on `afterEach` sweep; safe today but brittle |
| recorder-xpath-batch | inline (L86) | inline (L95) | `advanceTimersByTimeAsync` | Low, symmetric |
| FloatingController | `beforeEach` | `afterEach` | (none, mount only) | Low |
| LiveRecordedActionsTree.scroll | inline (L122) | inline (L126) then real `setTimeout` (L128) | mixed | Medium: intentional cross-over now wrapped in `act(...)` after v4.340.0 fix |
| data-source-extended | `beforeEach` | `afterEach` | `advanceTimersByTime` (sync) | Low, symmetric |

## Findings

1. All 7 files pair fake-timer installs with a real-timer restore in either the same test body or the enclosing `afterEach`. No dangling `useFakeTimers()` without a matching restore was found.
2. `keyword-event-chain.test.ts` is the only file that installs fake timers inline mid-suite (5 sites) while relying on the module-level `afterEach` to restore. This works today but a future test author adding a `throw` mid-body would strand fake timers into the next test. Preferred pattern: use `withFakeTimers(async () => { ... })` from `src/test/support/act-helpers.ts` which restores via `finally`.
3. `LiveRecordedActionsTree.scroll.test.tsx` deliberately swaps back to real timers to await the DOM pulse-clear; the `act(...)` wrapper added in v4.340.0 keeps the flush inside React's batch. No regression.
4. No test uses `runAllTimers` or `runOnlyPendingTimers`; the safer `advanceTimersByTimeAsync(N)` idiom is used consistently.

## Actions

- Non-blocking recommendation: migrate the 5 inline installs in `keyword-event-chain.test.ts` to `withFakeTimers` in a follow-up wave. Not required for Plan 10 completion because the current pattern is symmetric and the module-level `afterEach` acts as a safety net.
- No code change required this step; the audit is the deliverable and the recommendation is captured for a future refactor pass.

## Signal

- Zero timer-related `act(...)` warnings in the current Vitest run.
- Zero fake-timer leak between suites (Vitest per-file isolation).
