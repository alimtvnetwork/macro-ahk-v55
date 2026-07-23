---
Slug: retry-em-dash
Status: pending
Created: 2026-07-20
Parent: 34-fix-vitest-15-failures
---

# SS-01 Retry-step em-dash + startup header em-dash

## Goal

Kill every em dash that leaks into an emitted user-facing string, starting with the two known sites captured in the CI log at `user-uploads://file-55` lines 1843, 2452, 3514, 3703.

## Sites to fix

1. **Retry note builder.** Search: `rg -n "Retry of step #" src/ standalone-scripts/`. The producing site emits `Retry of step #{id} — {source}`; change the ` — ` separator to `, ` so the string becomes `Retry of step #{id}, {source}`. This matches `src/background/recorder/__tests__/retry-step.test.ts:99` which asserts `"Retry of step #42, from toast"`.
2. **Startup header comment.** File: `standalone-scripts/macro-controller/src/startup.ts` (or its counterpart). The top-of-file block comment currently reads `MacroLoop Controller — Startup`. Change to `MacroLoop Controller, Startup`. This comment ends up in stdout via a `console.log(banner)` at boot and shows up in test snapshots (lines 1843 + 2452 of the CI log).

## Procedure

1. `rg -n " — " src/background/recorder/ standalone-scripts/macro-controller/src/` — list every em dash still living in emitted strings or headers.
2. For each hit that lands in a user-facing string, comment header that gets logged, or diagnostic message, replace ` — ` with `, ` (comma + space) or `: ` where the semantic is a subordinate clause.
3. Do NOT touch em dashes inside `.test.ts` fixture literals that intentionally assert on the old broken output — those tests must be updated to the new ASCII form (comma variant).
4. Run `pnpm vitest run src/background/recorder/__tests__/retry-step.test.ts` locally — must exit 0.

## Verification

- `rg -n " — " src/background/recorder/ standalone-scripts/macro-controller/src/` returns 0 hits.
- `rg -n "step #[0-9N]+ —" src/ standalone-scripts/` returns 0 hits.
- The retry-step suite is green.
