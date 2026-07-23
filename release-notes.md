## [v4.366.0] - 2026-07-20 seed-plan-next regression + SDK compile-instruction VERSION fix

### Fixed
- `scripts/compile-instruction.mjs` now reads `version.json` and binds `VERSION` in the evaluator scope, unblocking SDK and payment-banner-hider builds.
- `tests/e2e/seed-plan-next-regression.spec.ts` warm-boot mock queue extended with two `readCurrentBody` legacy-upgrade probe responses; all 4 regression tests pass.

## [v4.365.0] - 2026-07-20 CI em-dash gate audit

### Chore
- Audited the em-dash failure-report checker: already blocking builds via ci.yml + package.json build/preflight scripts. No new wiring required.

## [v4.364.0] - 2026-07-20 Plan 34 Step 5: full-green sweep

### Verification
- Full `pnpm run test` sweep: 486 files / 5274 tests / 7 todo / 0 failing (397s). Plan 34 (Vitest failure cleanup) is closed; regressions blocked by em-dash CI gate + version-alignment-from-version.json.

## [v4.363.0] - 2026-07-20 Plan 34 Step 4: em-dash guard extended

### Fix
- Added `retry-step.ts`, macro-controller `startup.ts`, and `startup-idempotent-check.ts` to the em-dash-in-failure-reports CI gate. Scrubbed 40 legacy em dashes from banner/log strings. 0 offenders after the sweep; Passive-attach and retry-step suites still 8/8 green.

## [v4.362.0] - 2026-07-20 Plan 34 Step 3: FailureReport snapshot key alignment

### Fix
- Regenerated `failure-report-snapshots.test.ts.snap` so keys match the ASCII-renamed `describe` blocks. Cleared 12 obsolete entries; 12/12 tests green with 0 obsolete.

## [v4.361.0] - 2026-07-20 Plan 34 Step 2: version-alignment test + Passive attach ASCII

### Fix
- Rewrote the `Version alignment` regression test to derive the canonical version from `version.json` and assert both `src/shared/constants.ts` and macro-controller `shared-state.ts` route through the shared re-export path. The old regex against `EXTENSION_VERSION = "..."` broke after Plan 29 turned that symbol into a re-export.
- Restored the `Passive attach, no visible UI` doc/log marker in `startup.ts` and `startup-idempotent-check.ts` by replacing em dashes with ASCII commas.

### Verification
- `npx vitest run src/test/regression/macro-controller-recovery.test.ts src/test/regression/passive-injection-panel-gate.test.ts` -> 17 passed, 0 failed.

## [v4.360.0] - 2026-07-20 Plan 34 Step 1: retry-note em-dash fix

### Fix
- Retry-step note builder now emits `Retry of step #N, <note>` (ASCII comma) instead of an em dash. Retry-step test suite green (4/4).
- Startup header comment scrubbed of em dash so banner stdout is ASCII-only.

## [v4.359.0] - 2026-07-20 Plan 33: FailureReportsPanel + StepWaitDialog refactor

### Refactor
- Split `FailureReportsPanel.tsx` (316L) into a thin shell plus `failure-reports-panel/{use-failure-reports-panel.ts, FailureReportsToolbar.tsx, FailureReportRow.tsx}`. State, export/copy handlers, and toolbar/row rendering isolated; zero behavioural change.
- Split `StepWaitDialog.tsx` (282L) into a thin shell plus `step-wait/{use-step-wait-dialog.ts, StepWaitSections.tsx}`. State, hydration, validation, and save/test/clear handlers moved to the hook; selector/kind/condition/timeout fields moved to presentational sections.

## [v4.358.0] - 2026-07-20 Plan 33 Step 9: RecorderVisualisation controller refactor

### Refactor
- Split `use-recorder-visualisation-controller.ts` (244L) into a 10-line composer plus three focused sub-hooks under `recorder/visualisation/` (step selection, step mutations, self-test + export). Every function now under the 15-line cap; zero behavioural change.

## [v4.357.0] - 2026-07-20 Plan 33 Steps 7-8: RecorderStepDetail + RunGroupDialog refactor

### Refactor
- `src/components/options/recorder/RecorderStepDetail.tsx`: split 282-line component. State + handlers moved to `recorder-step-detail/use-recorder-step-detail.ts` (`useRecorderStepDetail`); UI split into `VariableSection`, `DescriptionSection`, `TagsSection`, `LinksSection`, `SelectorsSection`, `FieldBindingSection`, `LinkSlotEditor` in `recorder-step-detail/recorder-step-sections.tsx`. Root component now 40 lines, under the 50-line cap.
- `src/components/options/RunGroupDialog.tsx`: split 155-line component. State + handlers moved to `run-group/use-run-group-controller.ts` (`useRunGroupController`); UI split into `LiveModeToggle`, `IdleBanner`, `RunningBanner`, `RunFooter`, `FailureCard`, `FailureCardDetails` in `run-group/run-group-sections.tsx`. Root component now 42 lines, under the 50-line cap.

### Audit
- ESLint baseline: ~74 -> ~70 warnings (0 errors held). Four more max-lines-per-function/component offenders retired.

### Root cause (one sentence)
Both files fused state wiring with multi-section JSX in a single monolithic component, which is exactly the pattern Plan 33's 15/50-line cap was created to retire.

## [v4.356.0] - 2026-07-20 Plan 33 Steps 5-6: ProjectDetailView + GroupInputsDialog refactor

### Refactor
- `src/components/options/ProjectDetailView.tsx`: split 193-line component. Extracted `OverflowTabMenu`, `ProjectTabsList`, `LazyTabContent`, `PrimaryTabPanels`, `OverflowTabPanels`, and `ProjectTabsBody`. Root component now 26 lines, under the 50-line cap. Removed stale duplicate `export default`.
- `src/components/options/GroupInputsDialog.tsx`: split 190-line component. State + handlers moved to `group-inputs/use-group-inputs-controller.ts` (`useGroupInputsController`); UI split into `DropZone`, `JsonEditor`, `ParseStatus` in `group-inputs/group-inputs-sections.tsx`. Root component now 55 lines (structural JSX only); every helper under the 25-line hook cap.

### Audit
- ESLint baseline: 78 -> ~74 warnings (0 errors held). Four more max-lines-per-function/component offenders retired.

### Root cause (one sentence)
Two more legacy option-page shells hosted all state, tab wiring, and multi-panel JSX inline, which is exactly the pattern Plan 33 was created to retire.

## [v4.355.0] - 2026-07-20 Plan 33 Steps 3-4: csv-input controller + BundleExchangePanel refactor

### Refactor
- `src/components/options/csv-input/use-csv-input-controller.ts`: split 107-line hook into `useCsvParseState`, `useCsvFileReader`, `useCsvFileHandlers`, `useCsvApplyHandler`, plus a pure `buildInitialMappings` helper. Root hook now 17 lines, all pieces under the 25-line cap.
- `src/components/options/BundleExchangePanel.tsx`: split 128-line component into `ExportSection`, `ImportSection`, `IncludeDescendantsField`, `LastExportLine`, `LastImportLine`, and `useImportDropzone`. Root component now 25 lines, under the 50-line cap.

### Audit
- ESLint baseline: 80 -> 78 warnings (0 errors held). Two more max-lines-per-function offenders retired.

### Testing
- `npx eslint src/components/options/csv-input/use-csv-input-controller.ts`: clean.
- `npx eslint src/components/options/BundleExchangePanel.tsx`: clean.
- `npx tsgo --noEmit`: 0 errors.

## [v4.354.0] - 2026-07-20 Fix: Node-20 compatibility for CI scanners

### Fixed
- `scripts/check-em-dash-in-tests.mjs`: replaced `fs.globSync` (Node 22+ only) with a Node-20 compatible `readdirSync` walker. CI on Node 20.20.2 was failing with `SyntaxError: The requested module 'node:fs' does not provide an export named 'globSync'`.
- `scripts/normalize-lovable-frontmatter.mjs`: same fix; replaced `globSync` with a small pattern-aware `globDir()` helper that supports the two glob shapes actually used (`<dir>/*.md` and `<dir>/[0-9]*.md`).

### Root cause (one sentence)
`fs.globSync` was added in Node 22 and does not exist in Node 20, so the ESM import itself threw at module-instantiation time before the scanner could run.

### Testing
- `node scripts/check-em-dash-in-tests.mjs`: OK, scanned 173 file(s), 0 offenders.
- `node scripts/normalize-lovable-frontmatter.mjs`: scanned 69, touched 1, exit 0.

## [v4.353.0] - 2026-07-20 Plan 33 Step 1-2: baseline refresh + HttpFailFastBanner refactor

### Refactor
- `src/components/HttpFailFastBanner.tsx`: split monolithic 79-line component into `useHeffLatestDetail`, `useCopyReport`, `HeffBannerHeadline`, `HeffBannerBodySnippet`, `HeffBannerActions`. Root component now 22 lines, under 50-line cap.

### Audit
- Refreshed ESLint baseline: 0 errors, 81 warnings (77 max-lines-per-function, 3 sonarjs/cognitive-complexity, 1 sonarjs/no-collapsible-if). `ctx`/id-denylist errors from Plan 31 draft are already cleared; Plan 33 pivots to the 15-line/50-line function-cap ratchet.
- Reduced warning count from 81 to 80.

### Testing
- `npx eslint src/components/HttpFailFastBanner.tsx`: clean.

## [v4.352.0] - 2026-07-20 Plan 10 close-out (Steps 9 + 10)

### Testing
- `npm run test:preflight` exit 0: both em-dash scanners (tests + emitters) and the failure-report scanner self-test (5/5) pass.
- All Plan 10 invariants held: 0 `act(...)` warnings, 0 timer-leak sites, 0 em-dashes in emitted failure reports, test-mode log gate live, hard-throw act ratchet armed.

### Changed
- Plan 10 moved from `.lovable/plans/pending/` to `.lovable/plans/completed/`; status flipped to `completed`.

### Notes
- Closes Plan 10. Root cause (one sentence): `act(...)` warnings and em-dash drift in emitted failure reports were unenforced invariants, so this plan added shared helpers, two CI scanners, and a hard-throw ratchet that make regressions impossible without a visible failure.

## [v4.351.0] - 2026-07-20 Forbid em/en dashes in emitted failure reports

### Added
- `scripts/check-em-dash-in-failure-reports.mjs`: allow-listed scanner for 9 emitter files (`failure-logger.ts`, `js-step-diagnostics.ts`, condition/instruction adapters, selector evaluator/comparison, drift diff, `failure-toast.ts`); strips comments, fails on U+2013/U+2014 in code content.
- `scripts/__tests__/check-em-dash-in-failure-reports.test.mjs`: 5 hermetic node-test cases.
- `package.json`: `test:preflight` script running both em-dash scanners plus the failure-report self-test; wired both scanners into `build` and `build:dev`.
- `.github/workflows/ci.yml`: three new steps inside the `no-nested-template-literals` preflight job (tests scanner, failure-report scanner, self-test).

### Fixed
- `failure-toast.ts:65`, `selector-attempt-evaluator.ts:105`: replaced em-dashes with commas so emitted strings are ASCII.

### Signal (before, after)
- Scanner: 2 offenders, before. 0 offenders, after.
- Self-test: 5/5 passing. `npm run test:preflight`: exit 0.

### Notes
- Root cause (one sentence): the tests-only checker only prevented drift between tests and emitters, not direct regressions inside emitter source; a matching checker over the emitter allow-list closes the class.

## [v4.350.0] - 2026-07-20 Plan 10 Step 8: hard-throw act(...) warning ratchet

### Added
- `src/test/setup.ts`: `console.error` interceptor that throws on React "not wrapped in act(...)" warnings, pointing offenders to `src/test/support/act-helpers.ts`. One-shot install per worker via `globalThis.__marcoActRatchetInstalled`; escape hatch `MARCO_ALLOW_ACT_WARNINGS=1` downgrades to log-only for triage. All other `console.error` calls pass through untouched.

### Signal (before, after)
- Baseline: 0 warnings after Steps 1-3. Ratchet verified by injecting an unwrapped `setState` into a scratch test: throws `[act-ratchet] React state update not wrapped in act(...)`. Removing the ratchet returns to silent warning.

### Notes
- Root cause (one sentence): nothing prevented a future PR from re-introducing an unwrapped state update, so the regression class stayed open until we failed hard at the same seam React uses to report it.
- Plan 10 Step 8 complete. Unblocks Step 9 (final lint/test sweep + docs) and Step 10 (Plan 10 close-out).

## [v4.349.0] - 2026-07-20 Plan 10 Step 7: silence noisy OptionsPage logs during tests

### Fixed
- `src/pages/Options.tsx:150` and `src/pages/Options.tsx:246`: gated the two diagnostic `console.log` calls (`[Options] ── INTERACTIVE ──` mount-budget line and `[Options] render branch` state dump) behind `import.meta.env.MODE !== "test"`. Playwright runs against the built extension where `MODE === "production"`, so its live-state marker still fires; Vitest runs (`MODE === "test"`) no longer pollute test output.
- `console.warn` calls for real failures (`GET_SETTINGS failed`, `PERF BUDGET EXCEEDED`) were intentionally left un-gated: they are signal, not noise, and must surface in every environment.

### Signal (before, after)
- `vitest run src/pages/__tests__/Options.test.tsx src/test/snapshots/Options.snapshot.test.tsx` before: 8 stray `stdout` blocks (`[Options] ── INTERACTIVE ──` + `[Options] render branch`) across 5 tests. After: 0 stray stdout blocks, 5/5 passing.

### Notes
- Root cause (one sentence): `Options.tsx` emitted E2E diagnostic `console.log` calls unconditionally, so every Vitest suite that mounted `<OptionsPage />` printed them, and the E2E-only Playwright marker leaked into unit-test output; gating them on `import.meta.env.MODE` scopes the diagnostics to non-test runs without weakening the Playwright contract.
- Plan 10 Step 7 complete. Unblocks Step 8 (hard-throw `act(...)` warning ratchet in `src/test/setup.ts`) with a clean stdout baseline.

## [v4.348.0] - 2026-07-20 Plan 10 Step 6: repository-wide em-dash CI gate for test files

### Added
- `scripts/check-em-dash-in-tests.mjs`: scans `src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs}` for U+2014 (em-dash) and U+2013 (en-dash). Doc comments (JSDoc, `//`, `/* ... */`) are exempt; every other occurrence fails the build with `file:line` output.
- `scripts/__tests__/check-em-dash-in-tests.test.mjs`: 5 node-test cases covering the pass path, em-dash-in-string fail, en-dash-in-label fail, single-line comment exemption, and block-comment exemption.
- Wired the gate into `build` and `build:dev` in `package.json` between `check-forbidden-timezones` and `validate-bundle-schema`, plus a standalone `check:em-dash-in-tests` script for local runs.

### Fixed
- Removed em-dash / en-dash from 60 test files (155 offending lines) across `src/test/regression/`, `src/lib/__tests__/`, `src/components/**/__tests__/`, `src/background/**/__tests__/`, and `src/hooks/__tests__/`. Replacement rule: ` \u2014 ` and ` \u2013 ` collapse to `, `; bare occurrences collapse to `,`. Prose meaning is preserved in every case (`describe("thing, subject")`).

### Signal (before, after)
- `node scripts/check-em-dash-in-tests.mjs`: 60 files / 155 offenders, before. 0 offenders, after (`scanned 173 file(s), 0 offenders`).
- `node --test scripts/__tests__/check-em-dash-in-tests.test.mjs`: 5/5 passing.

### Notes
- Root cause of the recurring drift (one sentence): test-file labels and assertion strings freely used em-dashes, so a formatter regression from `,` to ` \u2014 ` (or vice versa) had no repository-wide gate to catch it, and reviewers only spotted the specific site the failing test exercised. The new gate closes the class, not the instance.
- Plan 10 Step 6 complete. Unblocks Step 7 (silence noisy `OptionsPage` logs during tests).

## [v4.347.0] - 2026-07-20 Plan 10 Step 5: harden formatFailureReport, forbid em/en-dash in emitted body

### Fixed
- `src/background/recorder/failure-logger.ts:507` (`formatVariableLine`): replaced ` — ` with `, ` in the failure-variable line. Downstream regex parsers (support report scraper, AI paste target) and the earlier JsThrew Reason line already used `,`; this brings the Variables tail into the same idiom.
- `src/background/recorder/failure-logger.ts:431` (doc comment): example `Reason: PrimaryMissedFallbackOk` line now uses `,` to match the emitted format.
- `src/background/recorder/__tests__/__fixtures__/failure-report-fixtures.ts` L79 + L186: fixture `FailureDetail` and `Error.message` no longer embed em-dashes; downstream reports built from these fixtures are ASCII-clean.
- `src/background/recorder/__tests__/failure-report-fixtures.test.ts` L193: expectation updated from `Reason: ZeroMatches —` to `Reason: ZeroMatches,` to match the real formatter output.

### Added
- New test `never emits em-dash (U+2014) or en-dash (U+2013) in the formatted body (LOG-format-3)` in `failure-report-fixtures.test.ts`. Iterates every fixture (`ReplayZeroMatches`, `ReplayPrimaryDrift`, `ReplayVariableMissing`, `RecordNoTarget`, `ReplayJsInlineThrew`) in both `NonVerbose` and `Verbose` modes and asserts `formatFailureReport(...)` contains neither `\u2014` nor `\u2013`.

### Signal (before, after)
- `failure-report-fixtures.test.ts`: 1 failing (`Reason: ZeroMatches —` mismatch), 93 passing → 94 passing, 0 failing.
- Repo-wide em-dash count in emitted failure-report text: any → 0 (enforced by test).

### Notes
- Root cause: earlier revisions of `formatVariableLine` used ` — ` as a separator; when `js-step-diagnostics` was later fixed to `,`, this sibling line was missed, producing format drift the CI didn't catch. Adding the LOG-format-3 test locks the invariant.
- Plan 10 Step 5 complete. Unblocks Step 6 (repository-wide `scripts/check-em-dash-in-tests.mjs` CI gate).

## [v4.346.0] - 2026-07-20 Plan 10 Step 4: fake/real timer interleaving audit

### Added
- `.lovable/plans/subtasks/32-plan-10/02-timer-patterns.md`: audit of all 7 Vitest suites that toggle fake/real timers. Documents install/restore symmetry, advance API used, and per-file risk level.

### Findings
- All 7 files pair `useFakeTimers()` with a matching restore (inline or via `afterEach`). No dangling installs.
- `keyword-event-chain.test.ts` installs fake timers inline at 5 sites while relying on the module-level `afterEach` to restore. Works today but brittle if a test body throws mid-flight. Recommendation: migrate to `withFakeTimers(...)` from `src/test/support/act-helpers.ts` in a follow-up wave (non-blocking).
- `LiveRecordedActionsTree.scroll.test.tsx` cross-over back to real timers is now `act(...)`-wrapped (v4.340.0), no regression.
- No `runAllTimers` / `runOnlyPendingTimers` usage anywhere, safer `advanceTimersByTimeAsync(N)` idiom used consistently.

### Signal
- 0 timer-related `act(...)` warnings.
- 0 fake-timer bleed between suites.

### Notes
- No production or test code changed this step; audit is the deliverable.
- Unblocks Step 5 (harden `formatFailureReport` tests and forbid em-dashes in emitted text).

## [v4.345.0] - 2026-07-20 Plan 10 Step 3 batch 3: apply `flushEffects()` to KeywordEventsPanel + BootFailureBanner suites

### Fixed
- `src/components/recorder/__tests__/KeywordEventsPanel.selection.test.tsx`: both tests now `async`, `await flushEffects()` after `render` and after each `openPanel`/`addEvent` cluster, so `KeywordEventsEditor` prop-change setStates, `RecorderControlBar` mount probe, and `FloatingControllerHost` mount probe all resolve inside `act(...)`.
- `src/components/popup/__tests__/BootFailureBanner.report.test.tsx`: added `await flushEffects()` after `render` and after each `fireEvent.click`, so the banner's post-click state updates settle inside `act(...)`.

### Signal (before, after, these two files)
- `not wrapped in act(...)` warnings: 4, 0.
- Test results: 3/3 pass.

### Notes
- Plan 10 Step 3 complete (batches 1+2+3 combined: 47, 0 warnings across 7 files).
- No production code changed. Next up: Step 4 (fake/real timer audit).

# Marco Chrome Extension v4.344.0

Plan 10 Step 3 batch 2: applied `flushEffects()` to `DiagnosticsPanel.test.tsx`, `ProjectsSection.test.tsx`, and `ProjectEditor.test.tsx` (which was already act-safe). Warnings on these three files dropped 13 → 0 across 22 tests. Running cumulative across batch 1 + 2: 50 of 54 baseline warnings eliminated. Batch 3 (KeywordEvents + BootFailureBanner) remains.

---

# Marco Chrome Extension v4.343.0

Plan 10 Step 3 batch 1: applied shared `flushEffects()` to `src/pages/__tests__/Popup.test.tsx` (4 tests) and `src/test/snapshots/Options.snapshot.test.tsx` (1 test). Warnings on these two files dropped 37 → 0. In the process, exposed and fixed a latent fixture bug in the popup-data mock: `injections: []` didn't match the `InjectionStatus | null` prop contract and threw once the lazy `InjectionStatusPanel` actually mounted post-flush; corrected to `null`. Batch 2 (Diagnostics/Projects/ProjectEditor) and batch 3 (KeywordEvents/BootFailureBanner) remain.

---

# Marco Chrome Extension v4.342.0

Plan 10 Step 2 complete: shipped shared `act(...)` test helpers at `src/test/support/act-helpers.ts` (barrel at `src/test/support/index.ts`). `flushEffects`, `actRerender`, `waitRealMs`, `withFakeTimers`, all under the 15-line cap. 4 smoke tests with a scoped `console.error` spy verify each helper silences the exact warning class it targets (async-mount, prop-change, real-timer). Step 3 will migrate the 7 offending suites onto these helpers.

---

# Marco Chrome Extension v4.341.0

Plan 10 Step 1 complete: captured full Vitest `act(...)` warning inventory (54 warnings across 7 files, dominated by async-mount effects in `SessionCopyButton`/`DiagnosticsPanel`/`PopupFooter`/`InjectionCopyButton`). Fixed the JS-step diagnostic contract test (em dash to comma to match `formatFailureReport` output) and wrapped the `LiveRecordedActionsTree` pulse-clear real-timer wait in `act(...)`. Suite green with 0 failures; inventory drives Steps 2-8.

---

# Marco Chrome Extension v4.338.0

Plan 31 Step 7 (batch 4b): refactored `BatchRunDialog` (266L) by extracting `useBatchRunState`, `applyInputSnapshot`, `emitGroupWebhook`, `emitBatchCompleteWebhook`, `executeBatch` helpers, plus `BatchToolbar`, `TraceSection`, `OrderRow`, `OrderList`, `BatchFooter`, `BatchRunBody` sub-components. Repo warnings 84 to 81.

---

# Marco Chrome Extension v4.337.0


Plan 31 Step 7 (batch 4a): refactored `BatchRenameDialog` (237L) by extracting `useBatchRenameForm` hook and 7 sub-components (`ReplaceTab`, `AffixTab`, `SequenceTab`, `ModeTabs`, `PreviewSummary`, `PreviewRowItem`, `PreviewList`). Repo warnings 86 to 84.

---

# Marco Chrome Extension v4.336.0

Plan 31 Step 7 (batch 3): refactored `payload-builders.ts` by extracting `parseNonNegativeMs`, `validateUrlTabClickForm`, `buildUrlTabClickPayloadObject`, and `validateGenericPayload` helpers. Repo warnings 90 to 86 (cognitive-complexity 20 eliminated).

---

# Marco Chrome Extension v4.335.0

Plan 31 Step 7 (batch 2): refactored `parseCsv` (139L to 29L orchestrator + 6 helpers), `injectSentinel` (42L to 15L with `buildSentinelArgs`/`handleSentinelError`), and `isRestrictedUrl` (long if-chain to prefix table). Repo warnings 94 to 90; 20/20 tests pass.

---

# Marco Chrome Extension v4.334.0

Plan 31 Step 7 (batch 1): four background modules split under the `max-lines-per-function` cap.

`schema.applySchema` now delegates to `createTables`, `seedStepKinds`, and `recordMigration`; behavior preserved (single transaction, `INSERT OR IGNORE` seed idempotency, `PRAGMA user_version` bump only when the on-disk version is behind the code baseline).

`db.reorderGroups` splits sibling-set validation (`assertReorderIdsOwned`) from the `BEGIN;/COMMIT;/ROLLBACK;` update loop (`runReorderTransaction`); it still refuses partial/mixed reorders that would corrupt `OrderIndex`.

`db.appendStep` splits `RunGroup` invariant checks (`assertAppendStepInvariants`) from the actual INSERT (`insertStepRow`); the `RETURNING StepId` path is unchanged.

`storage-migration.runStorageMigrations` now extracts `assertMigrationCeiling` (guard against forbidden PascalCase migrations) and `applyMigration`. Subtle correctness fix: `lastApplied` only advances after `chrome.storage.local.set` persists the new version. Previously it advanced before persistence, so a `set` failure could report `toVersion=<failing version>` even though nothing was written.

`url-matches-backfill.backfillScriptUrlMatches` splits into `readStoredArrays`, `collectPatternsForScript`, `applyPatternsToScript`, `processScript`; cognitive complexity 21 -> well under 15, function 56L -> 22L. Same idempotency: scripts with non-empty `urlMatches` are skipped, only unbound scripts get logged, and storage is only written when at least one script mutated.

Verified: eslint 8 warnings -> 0 on the touched files, repo-wide `100 -> 94` warnings, 230/230 background tests, `tsgo` clean.

## Previous release (v4.333.0)

Plan 31 Step 6: `useVisibilityPausedInterval` and `useStepGroupImport` split under the `max-lines-per-function` cap.

# Marco Chrome Extension v4.333.0

Plan 31 Step 6: `useVisibilityPausedInterval` and `useStepGroupImport` split under the `max-lines-per-function` cap.

`use-visibility-paused-interval.ts` now delegates to `createTimerControls` and `installVisibilityLoop` module helpers, dropping the hook body from 43 lines to 12 while preserving the exact contract (immediate tick on mount, pause on `document.hidden`, catch-up tick + re-arm on visible, teardown on unmount/enabled=false, SSR fallback).

`use-step-group-import.ts` extracts `readFileBytes`, `libNotReady`, `runImportForBytes`, and `toastImportSuccess` to module scope, and moves the async pipeline into two typed helper hooks (`useImportFile`, `useHandleSuccess`). Success ordering is preserved: `onAfterImport?.()` first, then `setLastImport` / `setSummaryState` / `toast.success`, so callers still see the refreshed library before the summary dialog opens. Failure path still routes through `explainImportFailure` into `setErrorState`.

Verified: `eslint` on the two touched files -> 0 problems (was 3 warnings). Repo-wide lint -> `100 problems, 0 errors, 100 warnings` (was 103). `vitest run src/hooks` -> 52/52. `tsgo --noEmit` clean.

## Previous release (v4.332.0)

Plan 31 Step 5: `useStepLibrary` split into internal helper hooks.

# Marco Chrome Extension v4.332.0

Plan 31 Step 5: `useStepLibrary` split into internal helper hooks. The 247-line hook body is now 42 lines and clears the `max-lines-per-function` cap.

New `src/hooks/use-step-library-types.ts` extracts the public type surface (`StepLibraryLoadError`, `UseStepLibraryState`, `UseStepLibraryApi`). New `src/hooks/step-library/step-library-hooks.ts` houses six typed helper hooks (`useBootstrap`, `useRemoteBytesSync`, `useLibraryMutations`, `useGroupInputMutations`, `useResetAndRetry`, `useAssembleApi`) plus pure helpers (`moveWithinArray`, `findOwningGroupId`, `makeApplyLoadError`, `makeApplySuccess`, `runBootstrapSequence`). Each helper hook stays under the 40-line cap and preserves the exact prior behavior: same setter order on success, same seed shape, same discriminated load-error propagation, same cross-tab `BroadcastChannel("marco-sync-activity")` notification.

Verified: `eslint` on the three touched files -> 0 problems. Repo-wide lint -> `103 problems, 0 errors, 103 warnings` (was 142 problems / 36 errors / 106 warnings at Plan 31 Step 1 baseline). `tsgo --noEmit` clean. `vitest run src/hooks` -> 52/52 passed.

## Previous release (v4.331.0)

Plan 31 Step 4 (partial): `use-step-library.ts` bootstrap arrow and `seedExampleData` refactored under the cap.
