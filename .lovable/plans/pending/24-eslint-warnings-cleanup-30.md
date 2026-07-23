# ESLint Warnings & Errors Cleanup (30 steps)

Slug: eslint-warnings-cleanup-30
Steps: 30
Status: pending
Created: 2026-07-19

## Context

CI `pnpm lint` on macro-ahk-v54 reports ~265 issues across 107 files (see user-uploads://file-27):
- 157 `max-lines-per-function` (limit 40)
- 47 `id-denylist` (`arr`, `cb`, `fn`, `el`, `msg`, etc.)
- 31 `sonarjs/cognitive-complexity` (limit 15)
- 9 `sonarjs/no-duplicate-string`
- 2 `sonarjs/no-collapsible-if`
- 1 `@typescript-eslint/no-explicit-any`

Hot zones: `src/background/recorder/**` (26), `src/components/options/**` (30), `src/components/recorder/**` (20), plus `src/ui/**`, `src/hooks/**`, `src/lib/**`.

Goal: land `pnpm lint --max-warnings=0` clean without behavior changes. Refactor by extracting helpers, renaming denylisted identifiers, extracting constants for duplicate strings, and reducing branching depth. No baseline regressions on P0-10 double-cast or `noUncheckedIndexedAccess`.

Related captured input: none new this turn (planning-only).

## Steps

1. Snapshot baseline: run `pnpm lint --format=json > .lovable/audits/eslint-baseline-24.json`, commit counts per rule + per file.
2. Add helper doc `.lovable/plans/subtasks/24-eslint-warnings-cleanup-30/01-refactor-recipes.md` describing the four refactor recipes (extract helper, rename identifier, extract constant, flatten branches) with before/after examples. See ./subtasks/24-eslint-warnings-cleanup-30/01-refactor-recipes.md
3. Fix `src/background/auto-attach.ts` `evaluateAutoAttach` (101 lines): split into `resolveAttachTarget`, `checkAttachGuards`, `dispatchAttach`.
4. Fix `src/background/first-attach-toast.ts` `toastPagePayload` (76 lines): extract `buildToastMarkup`, `mountToastRoot`, `scheduleToastDismiss`.
5. Fix `src/background/handlers/injection-request-resolver.ts` `classifyEntry` (45 lines) + `logging-handler.test.ts` arrow (48 lines): extract classifier helpers and per-case test setup.
6. Fix `src/background/recorder/dropzone-overlay.ts` `mountDropZoneOverlay` (71 lines): split mount / listeners / teardown helpers.
7. Fix `src/background/recorder/failure-logger.ts`: `buildFailureReport` (42), `classifyReason` (55), `formatFailureReport` (69, cognitive 65). See ./subtasks/24-eslint-warnings-cleanup-30/02-failure-logger.md
8. Fix `src/background/recorder/field-binding-overlay.ts` (`mountFieldBindingOverlay` 266 lines, `renderColumns` 78). See ./subtasks/24-eslint-warnings-cleanup-30/03-field-binding-overlay.md
9. Fix `src/background/recorder/field-reference-resolver.ts` `classifyVariable` (54): table-driven classifier.
10. Fix `src/background/recorder/hover-highlighter.ts` `mountHoverHighlighter` (134): split into overlay build, event wiring, teardown.
11. Sweep remaining `src/background/recorder/**` `max-lines-per-function` warnings (recorder-panel, selector-scorer, snapshot-writer, verbose-store): extract per-concern helpers.
12. Sweep `src/background/handlers/**` remaining warnings (message-bus, project-api-relay, credit-refresh): split by message kind.
13. Sweep `src/components/options/**` (30 hits) part 1: split large tab/panel components into subcomponents (Audit, Prompt Library, Credits panels).
14. Sweep `src/components/options/**` part 2: extract row/renderer helpers, memoized selectors.
15. Sweep `src/components/recorder/**` (20 hits): split modal/step-editor components into presentational + container.
16. Fix `src/ui/prompt-history-panel.ts`, `prompt-io.ts`, `prompt-injection.ts`, `prompt-bundle-types.ts` residual line/complexity warnings via already-established modular helpers pattern.
17. Fix `src/hooks/use-step-group-{import,export,batch-actions}.ts` and `use-step-library.ts` `use-visibility-paused-interval.ts`: extract pure reducers out of hook body.
18. Fix `src/lib/keyword-event-bulk-actions.ts` line/complexity: split per-action branch into named handlers.
19. `id-denylist` sweep pass 1 (background/**): rename `arr`→`bucket|items`, `cb`→`callback|checkbox`, `fn`→`handler|task`, `el`→`node|host`, `msg`→`payload|messageNode`. Update tests in same commit.
20. `id-denylist` sweep pass 2 (components/**, hooks/**, lib/**, ui/**): same renames; verify no shadowed globals.
21. `sonarjs/cognitive-complexity` sweep: for each of the 31 sites, apply guard-clause flattening + extract predicates (`isFoo(x)`) to reach ≤15.
22. `sonarjs/no-duplicate-string` sweep: extract 9 offenders into `const` (module-scoped) or shared constants module (e.g. `src/shared/lint-constants.ts` if cross-file).
23. `sonarjs/no-collapsible-if` (2 sites): merge nested `if` into single conditional.
24. Fix the 1 `@typescript-eslint/no-explicit-any`: replace with proper type; if genuinely unknown, use `unknown` + narrow (respect No Explicit Unknown policy: only if in `CaughtError`-shaped position).
25. Add ESLint override guard: no new `max-lines-per-function` regressions by adding a `scripts/check-eslint-baseline.mjs` that fails CI if warning count exceeds 0.
26. Wire the guard into `.github/workflows/ci.yml` after `lint` step (bare `on: push:` unchanged per core rule).
27. Update `.lovable/rules.md` and `spec/coding-guidelines/` to document the four refactor recipes and the "≤40 lines / ≤15 cognitive complexity / no id-denylist" ceiling.
28. Run full test suite (`bun test` + Vitest + Playwright smoke); ensure no baselines regressed (P0-10 double-cast ≤71, unchecked-indexed-access unchanged).
29. Run `pnpm lint --max-warnings=0`; capture green output to `.lovable/audits/eslint-final-24.txt`.
30. Bump minor version, add changelog entry `eslint: clear 265 warnings across 107 files`, update release notes and root README version pin; move this plan file to `.lovable/plans/completed/24-eslint-warnings-cleanup-30.md` with `Status: completed`.

## Verification

- `pnpm lint --max-warnings=0` exits 0.
- `scripts/check-eslint-baseline.mjs` returns 0 in CI.
- Test suites remain green: `bun test`, `vitest run`, Playwright E2E smoke.
- P0-10 double-cast count ≤ 71; `noUncheckedIndexedAccess` unchanged.
- Git diff shows no behavioral changes: only extractions, renames, constant hoists.
- Version bumped in `manifest.json`, `src/constants.ts`, root `readme.md` version pin; changelog entry present.

## Appended from prior pending tasks

Existing pending plans left in place (not folded here; scope is lint-only):
- 10-unified-billing-all-workspaces
- 11-prompts-import-export-section
- 13-per-project-chat-submit-tracker
- 22-prompt-library-test-coverage-50
- 23-prompt-library-relocate-and-light-mode
