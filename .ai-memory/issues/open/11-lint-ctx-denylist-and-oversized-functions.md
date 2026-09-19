---
Slug: lint-ctx-denylist-and-oversized-functions
Status: open
Created: 2026-07-20
Related-Plan: 31-lint-cleanup-ctx-denylist-and-15-line-cap
---

# Lint regressions: `ctx` id-denylist + oversized functions

## User verbatim (2026-07-20)

> "Why I do see this error again? ... You have given several steps to reduce the code, write the code in a better way. Why you didn't do it? ... In the next 10 steps, can you fix all these warning issues"

## Symptom

`pnpm run lint` fails with 142 problems (36 errors, 106 warnings). Uploaded excerpt (`user-uploads://file-52`) shows two distinct classes:

1. **36 `id-denylist` errors** for identifier `ctx` in `src/background/recorder/http-request-step.ts` (lines 119, 148, 162-168, 178, 214, 218-253).
2. **106 `max-lines-per-function` warnings** across multiple files. Current ESLint threshold is still 40/25 (per Plan 30 Step 12, target is 15). Offenders in this excerpt:
   - `src/background/handlers/logging-handler.test.ts:13` (48L, cap 40)
   - `src/background/recorder/http-request-step.ts:87` `buildReplayTrace` (44L, cap 25)
   - `src/hooks/use-step-group-import.ts:97` `useStepGroupImport` (69L), `:104` async arrow (46L)
   - `src/hooks/use-step-library.ts:267` `useStepLibrary` (278L!), `:306` arrow (70L), `:631` `seedExampleData` (44L)
   - `src/hooks/use-visibility-paused-interval.ts:31` `useVisibilityPausedInterval` (43L)

## Root cause (recurrence)

Plan 30 tightened function size for `src/background/recorder/**` but never reached `src/hooks/**` nor completed the `id-denylist` sweep for `ctx` (prior sweeps covered `msg`/`fn`/`el`/`arr`/`cb` only). ESLint root config `max-lines-per-function` was not yet dropped to 15 repo-wide.

## Expected

- `pnpm run lint --max-warnings=0` exits 0.
- No `ctx` identifiers anywhere in `src/**`.
- Every function <= 15 body lines (per `.lovable/spec/commands/06-function-size-cap-15-lines.md`).

## Status

open
