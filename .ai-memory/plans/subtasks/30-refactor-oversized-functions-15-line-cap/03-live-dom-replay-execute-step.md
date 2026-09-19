---
Slug: live-dom-replay-executeStep
Status: pending
Created: 2026-07-20
Parent: 30-refactor-oversized-functions-15-line-cap
---

# SS-03 Refactor `live-dom-replay.executeStep` and `finalize`

Highest-risk target: 123 lines, cognitive complexity 44. `finalize` 64 lines.

## Plan

1. Read `src/background/recorder/live-dom-replay.ts` fully; enumerate branches.
2. Extract a `StepKindDispatch` map: `Record<StepKindId, (ctx: StepContext) => Promise<StepOutcome>>`.
3. Split `executeStep` into: `buildStepContext`, `dispatchByKind`, `recordOutcome`, `handleStepFailure`. Each <=15 lines.
4. Split `finalize` into: `flushPendingWrites`, `emitSessionSummary`, `teardownObservers`, `disposeToolbar`.
5. Add unit tests for the dispatch map using existing recorder fixtures; ensure snapshot of outcome equals pre-refactor.
6. Verify with recorder E2E: `pnpm test -- recorder` (or the closest existing suite).

## Exit criteria

- File lints clean at 15-line cap.
- All existing recorder tests pass.
- Cognitive complexity per function <= 15.
