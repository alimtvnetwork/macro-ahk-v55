# Lint cleanup: `ctx` id-denylist + oversized functions (hooks + handlers)

Slug: lint-cleanup-ctx-denylist-and-15-line-cap
Steps: 10
Status: pending
Created: 2026-07-20

## Context

`pnpm run lint` regressed to 142 problems (36 errors, 106 warnings). Two root causes:
(1) 36 `id-denylist` errors for `ctx` in `src/background/recorder/http-request-step.ts` (never included in prior sweeps for `msg`/`fn`/`el`/`arr`/`cb`),
(2) `max-lines-per-function` breaches across `src/hooks/**`, `src/background/handlers/**`, and `src/background/recorder/http-request-step.ts` that Plan 30 did not touch.

Captured this turn:
- Issue: `.lovable/issues/open/11-lint-ctx-denylist-and-oversized-functions.md`
- Existing command already governs the cap: `.lovable/spec/commands/06-function-size-cap-15-lines.md`
- Existing memory: `.lovable/memory/standards/restricted-identifiers-and-function-size.md` (extend `ctx` into denylist docs).

## Steps

1. Run `pnpm run lint --no-fix > /tmp/lint-full.log 2>&1` and enumerate every `ctx` occurrence and every `max-lines-per-function` offender across the whole repo (not just the uploaded excerpt). Write the inventory to `.lovable/plans/subtasks/31-lint-cleanup-ctx-denylist-and-15-line-cap/01-full-inventory.md`.
2. Add `ctx` to the ESLint `id-denylist` array in `eslint.config.js` (root) so the rule catches it repo-wide going forward; update `.lovable/memory/standards/restricted-identifiers-and-function-size.md` to list `ctx` alongside `msg`/`fn`/`el`/`arr`/`cb` with the approved replacements (`context`, `requestContext`, `stepContext`).
3. Refactor `src/background/recorder/http-request-step.ts`: rename all 36 `ctx` sites to `requestContext` (or a scoped name per helper), then split `buildReplayTrace` (44L) and any other >15L function under the 15-line cap using the Shell+Wire pattern from `mem://standards/restricted-identifiers-and-function-size`. See `.lovable/plans/subtasks/31-lint-cleanup-ctx-denylist-and-15-line-cap/02-http-request-step-refactor.md`.
4. Refactor `src/hooks/use-step-library.ts` (`useStepLibrary` 278L, inner arrow 70L, `seedExampleData` 44L). Extract per-operation helpers (load, seed, mutate) into `src/hooks/step-library/*.ts` sub-modules. See `.lovable/plans/subtasks/31-lint-cleanup-ctx-denylist-and-15-line-cap/03-use-step-library-refactor.md`.
5. Refactor `src/hooks/use-step-group-import.ts` (69L + 46L async arrow) and `src/hooks/use-visibility-paused-interval.ts` (43L) into <=15L helpers, preserving `correlationId` and `DiagnosticError` propagation.
6. Refactor `src/background/handlers/logging-handler.test.ts` (48L arrow) by extracting a `buildLoggingHandlerHarness()` helper; apply the same pattern to any sibling test that trips the cap.
7. Sweep every remaining offender surfaced in Step 1 that is not in Steps 3-6, using the pattern catalog in `.lovable/plans/subtasks/30-refactor-oversized-functions-15-line-cap/02-refactor-patterns-catalog.md`. Append each fixed function to the Step 1 inventory as done.
8. Tighten ESLint root config: `max-lines-per-function: { max: 15, skipBlankLines: true, skipComments: true, IIFEs: true }`, remove per-folder overrides that raise the ceiling, and align `sonarjs/cognitive-complexity` at 15. Extend `scripts/check-function-length.mjs` (from Plan 30) to also scan `src/hooks/**` and `src/background/handlers/**` if not already included.
9. Add Vitest coverage for every extracted helper touched in Steps 3-7 (per `mem://preferences/test-with-features`). Run `pnpm run lint --max-warnings=0`, `pnpm run typecheck`, `pnpm test`, and `scripts/check-strict-flag-fallout.mjs --strict`; fix any residual regressions.
10. Execute the release ceremony per `mem://workflow/release-ceremony` (minor bump), update `changelog.md` and `RELEASE_NOTES.md`, then `mv .lovable/plans/pending/31-lint-cleanup-ctx-denylist-and-15-line-cap.md .lovable/plans/completed/` and flip `Status: completed` in the same turn as Step 10 lands.

## Verification

- `pnpm run lint --max-warnings=0` exits 0 (was 36 errors + 106 warnings).
- `rg -n "\\bctx\\b" src/ standalone-scripts/` returns zero identifier hits (comments / string literals excluded via review).
- `scripts/check-function-length.mjs` reports zero offenders in `src/**` and `standalone-scripts/**`.
- `pnpm run typecheck` and `pnpm test` clean; strict-flag ratchet unchanged.
- Manual smoke: recorder HTTP step still executes end-to-end; hooks in options page render without regressions.
- New plan file lives only in `.lovable/plans/completed/`; no duplicate under `pending/`.

## Appended from prior pending tasks

Not rolled into Plan 31 (each stays under its own plan file):
- 11-prompts-import-export-section
- 13-per-project-chat-submit-tracker
- 22-prompt-library-test-coverage-50
- 23-prompt-library-relocate-and-light-mode
- 24-eslint-warnings-cleanup-30 (subsumed once Step 8 lands the 15-line root rule)
- 25-eslint-cleanup-continuation-30 (same)
- 29-version-json-single-source-of-truth
- 30-refactor-oversized-functions-15-line-cap (Plan 31 completes the `src/hooks/**` + `handlers/**` slice Plan 30 did not reach)
