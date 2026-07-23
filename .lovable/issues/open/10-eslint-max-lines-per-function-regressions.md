---
Slug: eslint-max-lines-per-function-regressions
Status: open
Created: 2026-07-20
Related-Plan: 30-refactor-oversized-functions-15-line-cap
---

# ESLint `max-lines-per-function` and cognitive-complexity regressions

## Symptom

`pnpm run lint` emits many warnings for oversized functions and high cognitive complexity across `src/background/**` (recorder, handlers, live-dom-replay, http step, toolbar, overlay, selector-*). User states the standard is 15 lines max per function (stricter than current ESLint `max-lines-per-function: 40/60` config). Warnings are non-zero, violating the project's zero-warning policy.

## Repro

```
pnpm run lint
```

## Expected vs actual

- Expected: zero warnings, every function <= 15 lines.
- Actual: 40+ warnings (samples): `mountDropZoneOverlay` 71, `mountHoverHighlighter` 134, `executeHttpStep` 95 (cc 20), `executeStep` in live-dom-replay 123 (cc 44), `finalize` 64, `mountRecorderToolbar` 167, `evaluateOne` 52, `summarise` 45 (cc 18), `testSelector` 49, `logging-handler.test.ts` arrow 48. Truncated log shows more in the same folders.

## Files (from uploaded lint output, partial)

- src/background/handlers/logging-handler.test.ts
- src/background/recorder/dropzone-overlay.ts
- src/background/recorder/hover-highlighter.ts
- src/background/recorder/http-request-step.ts
- src/background/recorder/live-dom-replay.ts
- src/background/recorder/recorder-toolbar.ts
- src/background/recorder/selector-comparison.ts
- src/background/recorder/selector-history.ts
- src/background/recorder/selector-tester.ts
- (plus additional files beyond line 37 of the uploaded lint report — to be enumerated in Plan 30 Step 1)

## Status

open
