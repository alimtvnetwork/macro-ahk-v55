# Refactor oversized functions to 15-line cap

Slug: refactor-oversized-functions-15-line-cap
Steps: 20
Status: pending
Created: 2026-07-20

## Context

`pnpm run lint` reports many functions exceeding the current 40/60 `max-lines-per-function` threshold across `src/background/recorder/**`, `src/background/handlers/**`, and adjacent modules. User standard is stricter: 15 lines max per function. This plan refactors every offender, tightens the ESLint config to enforce 15 lines repo-wide, preserves behavior via tests, and updates memory so this class of drift never recurs.

Captured inputs:
- Command: `.lovable/spec/commands/06-function-size-cap-15-lines.md`
- Issue: `.lovable/issues/open/10-eslint-max-lines-per-function-regressions.md`
- Uploaded lint excerpt: `user-uploads://file-51` (lines 1-37 shown; 38-346 truncated, enumerated in SS-01).

Related memory to update: `.lovable/memory/standards/restricted-identifiers-and-function-size.md` (tighten cap from 60 to 15).

## Steps

1. Enumerate every offender under the 15-line rule (not the current 40/60 log). See ./subtasks/30-refactor-oversized-functions-15-line-cap/01-inventory-and-baseline.md
2. Document the reusable refactor patterns applied everywhere. See ./subtasks/30-refactor-oversized-functions-15-line-cap/02-refactor-patterns-catalog.md
3. Update `.lovable/memory/standards/restricted-identifiers-and-function-size.md` to set the hard cap at 15 lines, add the Shell+Wire and async-pipeline patterns, and reference command 06.
4. Update `.lovable/coding-guidelines.md` (bump to v1.0.3) with the 15-line rule and refactor patterns.
5. Update `standalone-scripts/prompts/18-coding-guidelines/prompt.md` (bump to v1.4.2) with the 15-line rule so downstream agents inherit it.
6. Refactor `src/background/recorder/live-dom-replay.ts` (`executeStep`, `finalize`). See ./subtasks/30-refactor-oversized-functions-15-line-cap/03-live-dom-replay-executeStep.md
7. Refactor `src/background/recorder/recorder-toolbar.ts` (`mountRecorderToolbar`), `dropzone-overlay.ts` (`mountDropZoneOverlay`), `hover-highlighter.ts` (`mountHoverHighlighter`). See ./subtasks/30-refactor-oversized-functions-15-line-cap/04-recorder-toolbar-and-overlays.md
8. Refactor `src/background/recorder/http-request-step.ts`, `selector-comparison.ts`, `selector-history.ts`, `selector-tester.ts`, and `handlers/logging-handler.test.ts`. See ./subtasks/30-refactor-oversized-functions-15-line-cap/05-http-step-and-selectors.md
9. Refactor any remaining offenders from lint lines 38-346 (uploaded excerpt) using the SS-02 pattern catalog; append each to the SS-01 inventory as it is completed.
10. Add JSDOM/Vitest unit tests for every extracted helper touched in Steps 6-9 (Shell+Wire + async pipeline), following `mem://preferences/test-with-features`.
11. Preserve diagnostic contracts: every extracted helper propagates `correlationId` and emits `Reason` + `ReasonDetail` on failure via existing `DiagnosticError` (per `mem://standards/verbose-logging-and-failure-diagnostics`).
12. Tighten repo ESLint: set `max-lines-per-function` to `{ max: 15, skipBlankLines: true, skipComments: true, IIFEs: true }` at the root config and remove per-folder overrides that raise the ceiling.
13. Extend ESLint config for test files: same 15-line cap (no separate laxer test rule).
14. Add a CI script `scripts/check-function-length.mjs` that fails the build if any function in `src/**` or `standalone-scripts/**` exceeds 15 non-blank/non-comment body lines, as a belt-and-braces guard independent of ESLint.
15. Wire `scripts/check-function-length.mjs` into `pnpm run ci:checks` (or the equivalent aggregate task) so the guard runs on every push.
16. Run `pnpm run lint --max-warnings=0` and `pnpm run typecheck` and `pnpm test`; fix any residual regressions surfaced by the tightened rules.
17. Run the existing strict-flag ratchet (`scripts/check-strict-flag-fallout.mjs --strict`) to ensure the refactor did not regress `noPropertyAccessFromIndexSignature` or `noUncheckedIndexedAccess` baselines.
18. Manual smoke: launch the recorder in the preview, exercise drop-zone overlay, hover highlighter, toolbar, and a full replay session; capture screenshots to `/tmp/browser/plan-30/`.
19. Update `changelog.md` and execute release ceremony per `mem://workflow/release-ceremony` (minor bump; edit `version.json` only, propagate via existing tooling).
20. Move this plan file to `.lovable/plans/completed/30-refactor-oversized-functions-15-line-cap.md` and flip `Status:` to `completed`; mark all subtasks completed in place.

## Verification

- `pnpm run lint --max-warnings=0` passes with the 15-line rule enabled at the root config.
- `scripts/check-function-length.mjs` reports zero offenders in `src/**` and `standalone-scripts/**`.
- `pnpm run typecheck` clean; `scripts/check-strict-flag-fallout.mjs --strict` still under baselines.
- All Vitest suites pass; new tests for extracted helpers included.
- Recorder smoke screenshots in `/tmp/browser/plan-30/` show unchanged UI and behavior.
- `changelog.md` entry and version bump landed; release-ceremony memory followed.

## Appended from prior pending tasks

Prior pending plans remain owned by their own files and are NOT rolled into Plan 30:
- 11-prompts-import-export-section
- 13-per-project-chat-submit-tracker
- 22-prompt-library-test-coverage-50
- 23-prompt-library-relocate-and-light-mode
- 24-eslint-warnings-cleanup-30
- 25-eslint-cleanup-continuation-30
- 29-version-json-single-source-of-truth

Overlap note: Plans 24 and 25 are ESLint cleanup plans predating this stricter 15-line command. When Plan 30 executes Step 12 (tighten root config), Plans 24/25 remaining items become subsumed; close them out in their own files rather than duplicating here.
