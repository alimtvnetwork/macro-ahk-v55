# Vitest `act(...)` warnings and JS-step failure-report format drift

Status: open
Reported: 2026-07-20
Reporter: user (CI log excerpt, `user-uploads://file-54`)

## Symptom

CI run of `vitest` on `standalone-scripts/**` + `src/**` produced:

1. Hard failure at `src/background/recorder/__tests__/js-step-diagnostics.test.ts:272`
   — assertion `expect(text).toContain("Reason: JsThrew —")` failed because
   `formatFailureReport` emits `Reason: <code>, <detail>` (comma, no em dash).
2. `Warning: An update to LiveRecordedActionsTree inside a test was not
   wrapped in act(...)` fired from the pulse-clear test
   (`src/components/recorder/__tests__/LiveRecordedActionsTree.scroll.test.tsx`)
   because the 1300 ms real-timer wait let a state update fire outside `act()`.
3. Console logs from `OptionsPage` render branches leaked into test stdout
   (not fatal, but noisy).

The em-dash usage in the test also violates the
`mem://~user` rule "Never use em dashes".

## Expected vs actual

Expected: `pnpm test` green with zero `act(...)` warnings and zero em dashes
in test assertions.

Actual: 1 failing test + at least 1 act warning across the recorder + options
snapshot suites. The excerpt only shows one file, but the same pattern
(async mount effects, real-timer waits, timer-driven state clears) is
likely present across other snapshot / scroll / pulse tests.

## Related files

- `src/background/recorder/__tests__/js-step-diagnostics.test.ts`
- `src/background/recorder/failure-logger.ts` (`formatFailureReport`)
- `src/components/recorder/__tests__/LiveRecordedActionsTree.scroll.test.tsx`
- `src/components/recorder/LiveRecordedActionsTree.tsx`
- `src/pages/__tests__/Options.test.tsx` (stdout leak)
- `src/test/snapshots/Popup.snapshot.test.tsx` (precedent for `flushEffects` pattern)

## Scope

Repo-wide sweep: every Vitest file that renders a React component with an
async mount effect, a controlled prop that triggers `setState`, or a
`setTimeout`/`MutationObserver` that fires outside `act()`.
