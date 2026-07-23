# Plan 5 — Fix all Vitest failures (4 files / 15 tests)

Slug: fix-vitest-15-failures
Steps: 5
Status: pending
Created: 2026-07-20

## Context

CI `pnpm run test` on v4.358.0 (log: `user-uploads://file-55`) reports `Test Files 4 failed | 482 passed`, `Tests 15 failed | 5259 passed`. Failures cluster into four independent root causes: (1) em-dash in the "Retry of step #N" note builder, (2) 11-way `FailureReport` snapshot drift after the Plan 30/31/33 recorder refactors, (3) a stale regex in `macro-controller-recovery.test.ts:132`, and (4) a removed doc comment in `standalone-scripts/macro-controller/src/startup.ts` (also contains a stray em dash in its own header). No user-facing feature change; this is pure test-green work.

Guidelines applied:
- `.lovable/coding-guidelines.md` (present).
- `spec/coding-guidelines/`, `coding-guidelines/`: not present, skipped.
- Error-management folders (`spec/XX-error-manage/`, `coding-guidelines/XX-error-manage/`): not present, skipped.
- Memory rules that gate this plan: `mem://~user` "Never use em dashes", core rule "Zero ESLint warnings/errors", `mem://preferences/test-with-features`, `.lovable/spec/commands/06-function-size-cap-15-lines.md`, `.lovable/prompts/14-release.md` (release ceremony = MINOR bump).

Captured artifacts:
- Issue: `.lovable/issues/open/13-vitest-15-failures-em-dash-and-snapshots.md`
- No new commands captured this turn (the prompt is a bug-fix planning request, not a new convention).

## Steps

1. Fix the em-dash in the retry-step note builder so `retry-step.test.ts:99` passes. Locate the string template that produces `Retry of step #N — from toast`, change the separator to `, ` (ASCII comma + space) to match the test, and grep the whole repo for any other `"Retry of step #" .* —` occurrences to prevent a sibling regression. Also fix the em dash inside the `standalone-scripts/macro-controller/src/startup.ts` header comment (`MacroLoop Controller — Startup` -> `MacroLoop Controller, Startup`) so it stops leaking into stdout. Verify by running only `pnpm vitest run src/background/recorder/__tests__/retry-step.test.ts`. See ./subtasks/34-fix-vitest-15-failures/01-retry-em-dash.md.
2. Restore the missing `Passive attach, no visible UI` doc comment in `standalone-scripts/macro-controller/src/startup.ts`. The regression test at `src/test/regression/macro-controller-recovery.test.ts:132` extracts a version marker via regex and then greps the source for that phrase; both must be present. Read the current file, add the phrase back inside the top-of-file block comment (single line, no em dash), and re-check that the regex on line 132 still matches. Verify with `pnpm vitest run src/test/regression/macro-controller-recovery.test.ts`.
3. Diagnose and fix the 11 `failure-report-snapshots.test.ts` failures. Diff the current `FailureReport` emitted for each case (`UrlTabClick` reasons: TabNotFound, InvalidUrlPattern, SelectorNotFound, UrlPatternMismatch, optional-fields-omitted; Condition: Gate + dedicated ConditionStep; XPath/CSS: XPathSyntaxError, CssSyntaxError, ZeroMatches, Timeout) against the canonical JSON literal each `it(...)` block asserts. For each case, decide per-failure whether (a) the emitter regressed and code must be fixed, or (b) the snapshot is intentionally stale and the JSON literal must be updated. Never blanket-update snapshots. See ./subtasks/34-fix-vitest-15-failures/02-failure-report-snapshots.md.
4. Add one regression guard so em dashes never re-enter emitted user-facing strings: extend `scripts/check-em-dash-in-failure-reports.mjs` (already exists per prior memory) to also scan (a) any string in `src/background/recorder/retry-step.ts` and other retry/replay note builders, and (b) top-of-file block comments in `standalone-scripts/macro-controller/src/**/*.ts` that end up in emitted stdout via `console.log(headerBlock)`. Add a unit test at `scripts/__tests__/check-em-dash-in-failure-reports.test.mjs` that feeds a fixture containing `"Retry of step #1 — x"` and asserts the checker exits non-zero. Wire into `pnpm test:preflight` and `.github/workflows/*.yml` if not already gated.
5. Full green + release ceremony. Run `pnpm run test` and confirm `Test Files 486 passed`, `Tests 0 failed`. Run `pnpm run lint` and confirm no new warnings. MINOR-bump `version.json` (v4.359.0 or whatever is current +1 minor, per `.lovable/prompts/14-release.md`), prepend `changelog.md` and `RELEASE_NOTES.md` with the four root-cause fixes, and bump the version pins in `readme.md`. Then `mv .lovable/plans/pending/34-fix-vitest-15-failures.md .lovable/plans/completed/34-fix-vitest-15-failures.md` and flip `Status: pending` -> `Status: completed` in the same move. Also flip the linked issue to `Status: closed` and move to `.lovable/issues/closed/`.

## Verification

- Step 1: `pnpm vitest run src/background/recorder/__tests__/retry-step.test.ts` exits 0. `rg -n "step #[0-9N]+ —" src/ standalone-scripts/` returns 0 hits.
- Step 2: `pnpm vitest run src/test/regression/macro-controller-recovery.test.ts` exits 0. `rg -n "Passive attach, no visible UI" standalone-scripts/macro-controller/src/startup.ts` returns 1 hit.
- Step 3: `pnpm vitest run src/background/recorder/__tests__/failure-report-snapshots.test.ts` exits 0. Every previously-failing `it(...)` block passes with either a code fix or a deliberate snapshot update (documented in the changelog under Step 5).
- Step 4: `node scripts/check-em-dash-in-failure-reports.mjs` exits 0 on a clean tree, exits 1 against the new fixture. The new test in `scripts/__tests__/` is green.
- Step 5: `pnpm run test` shows `486 passed`, `0 failed`. `version.json` reflects the new minor. Plan file lives only in `.lovable/plans/completed/34-fix-vitest-15-failures.md`; `pending/` has no `34-*` duplicate. Issue file lives only in `.lovable/issues/closed/13-…`.

## Appended from prior pending tasks

Scanned `.lovable/plans/pending/`, `.lovable/plans/subtasks/`, `.lovable/issues/open/`, `.lovable/spec/commands/`, and `mem://index.md`. Prior pending plans stay in `pending/` under their own scope and are NOT rolled into this bug-fix plan:

- `11-prompts-import-export-section.md`
- `13-per-project-chat-submit-tracker.md`
- `22-prompt-library-test-coverage-50.md`
- `23-prompt-library-relocate-and-light-mode.md`
- `24-eslint-warnings-cleanup-30.md`
- `25-eslint-cleanup-continuation-30.md`
- `29-version-json-single-source-of-truth.md` (shipped v4.312.0; needs a status-flip + move as separate housekeeping)
- `30-refactor-oversized-functions-15-line-cap.md`
- `31-lint-cleanup-ctx-denylist-and-15-line-cap.md`
- `33-plan-10.md` (Plan 33 ESLint baseline drive, in-progress across Steps 7-10)

Prior open issues not folded in (they own their own fixes): `01`..`12` under `.lovable/issues/open/`. Only `13-vitest-15-failures-em-dash-and-snapshots.md` (created this turn) is bound to Plan 34.

No new commands captured this turn.
