# Macro Controller - Changelog

## v4.298.0 (2026-07-19)

### Added
- `src/errors/show-diagnostic-toast.ts`: propagate optional `correlationId` end-to-end through `RequestDetail`, `RequestDetailSnapshot`, and `emitDiagnosticToastEvent`; auto-generate `dtx-` prefixed IDs via `generateCorrelationId()` when callers do not supply one. Returned as `ShowDiagnosticToastResult` for downstream tracing.
- `src/errors/__tests__/show-diagnostic-toast.test.ts`: redaction hardening tests T9..T12 verify Authorization/Cookie header stripping, raw body replacement with byte lengths, ring-buffer scrubbing, and identical redaction on the dispatched CustomEvent.
- `src/telemetry/__tests__/diagnostic-toast-telemetry.test.ts`: correlation-id cases T6..T9 confirm ID propagation and auto-generation.

### Changed
- `src/ui/panel-controls.ts`: prompt library dropdown locked to a fixed 460x460 frame with vertical scroll; raised `DROPDOWN_MIN_HEIGHT` to 260 and `DROPDOWN_MAX_HEIGHT_CAP` to 560 so long prompt lists scroll inside a stable frame.
- `src/ui/prompt-dropdown.ts`: bumped readable sizes across the dropdown (rows 10 to 12px, padding 3x6 to 6x10px, badges 14 to 18px, tag chips 8 to 10px, search input 10 to 12px, section headers 9 to 11px, management rows 10-11 to 12-13px).
- `src/__tests__/prompt-io-import-revisions.test.ts` and `src/ui/__tests__/prompt-editor-diagnostic-migration.test.ts`: routed prompt-loader mocks through `buildPromptLoaderMock()` per `scripts/check-prompt-loader-mocks.mjs`.

### Fixed
- `.gitmap/release/latest.json` and `.gitmap/release/v4.281.0.json`: regenerated so `scripts/check-release-readiness.mjs` passes when the current tag matches `version.json`.
- `.lovable/plans/subtasks/**`: renamed remaining `SS-*.md` files to numeric-sequence names so `scripts/check-markdown-filenames.mjs` passes.
- `scripts/__tests__/check-changelog-entry.test.mjs`: updated subtest 9 to reflect hyphens being valid separators (only em dashes are forbidden); missing-separator case still fails as expected.
- ESLint cleanup: renamed `ctx` to `context` and `fn` to `func` in test files; scoped `no-restricted-syntax` disables on legitimate `console.error` fallbacks in `MacroController.ts`, `user-gesture-guard.ts`, and `error-utils.ts`; removed a stale eslint-disable in `error-codes-registry.test.ts`.

## v4.293.0 (2026-07-19)

### Added
- `src/errors/error-codes.ts`: 10 new diagnostic codes covering the credit-balance surface (`CREDIT_BALANCE_E001`..`CREDIT_BALANCE_E008`) and rename-api recovery paths (`RENAME_CREDIT_LIMIT_FALLBACK_E001`, `RENAME_AUTH_RECOVERY_E001`).
- `src/telemetry/diagnostic-toast-telemetry.ts`: structured telemetry sink for every `showDiagnosticToast` call. Emits an activity-log entry, appends a redacted 50-entry ring buffer under `StorageKey.DiagnosticToastTrace`, and dispatches a `marco:diagnostic-toast` CustomEvent. `requestDetail` is redacted to header names + byte lengths only.
- `src/__tests__/credit-balance-diagnostics.test.ts` (8 cases) and `src/telemetry/__tests__/diagnostic-toast-telemetry.test.ts` (5 cases) cover the new error paths and telemetry emission.

### Changed
- `src/credit-balance.ts`: replaced remaining `showToast(...)` sites with `showDiagnosticToast(...)`. Background failures (workspace resolve, auth recovery, HTTP/network, malformed payloads) use `{ noStop: true }`; the user-facing low-credit warning maps to `CREDIT_BALANCE_E008` with `warn` severity.
- `src/rename-api.ts`: remaining `showToast` sites migrated to `showDiagnosticToast`; generic error path now throws the same instance surfaced to the user for consistent diagnostics.
- `src/errors/show-diagnostic-toast.ts`: now calls `emitDiagnosticToastEvent` and accepts the full `ToastOpts` shape used by callers (`noStop`, severity, action).
- `src/shared/storage-keys.ts`: added `DiagnosticToastTrace` for the ring buffer.
- `src/__tests__/per-area-migration-coverage.test.ts`: registered `credit-balance.ts` in the CREDIT area.

### Verification
- `tsgo --noEmit`: clean.
- Test suite: 5217/5225 green; 8 pre-existing flakes in `settings-credit-fetch-delay.test.ts` and `prompt-role-db.test.ts` are unrelated to this migration and pass in isolation.



## v4.277.0 (2026-07-19)

### Fixed
- `src/seed/seed-plan-next.ts`: `upgradeLegacyBodyForRow` now returns a boolean indicating whether it wrote an UPDATE, and `upgradeLegacyDefaultBodies` uses that return value instead of issuing pre-read + post-read `readCurrentBody` SELECTs around every default row. Redundant SQL round-trips per boot drop from 3 reads per legacy candidate to 1.
- `src/seed/__tests__/seed-plan-next.test.ts`: response queues and length assertions realigned to the real seeder SQL sequence (pre-select → INSERT OR IGNORE → 1x legacy read per default → hasDefault / promote per default → optional audit-log INSERT). Boot-scenario call counts are now 9 (fresh), 6 (idempotent no-op, audit correctly skipped), and 8 (mixed, audit written).

### Root cause (one sentence)
The seeder's SQL call sequence had drifted from the tests because `upgradeLegacyDefaultBodies` was reading each default row's body three times per boot and `writeSeedAuditRow` had been added afterwards, but the SQL-queue tests were still locked to the pre-audit v4.187.0 count of 6/7/8 calls.

### Verification
- Targeted: `seed-plan-next.test.ts` (6/6) + `seed-plan-next-edges.test.ts` (6/6) — all green.



## v4.191.0 (2026-07-19)

### Added
- `src/ui/prompt-library-modal.ts`: modal header gains two additive controls wiring the v4.190.0 pure-logic options into the UI:
  - `[data-testid="library-export-include-revisions"]` — "History" checkbox next to Export. When checked, the click handler passes `{ includeRevisions: true }` to `exportPromptsToJson`. Off by default so the export payload is byte-identical to pre-v4.190.0.
  - `[data-testid="library-import-role-filter"]` — "Import scope" select (All roles / plan / next / generic). When set to a concrete role, the change handler forwards `{ roleFilter, revisions }` to `performPromptImport`; when set to `all`, `roleFilter` is omitted. Parsed `revisions[]` from the incoming bundle are always forwarded when present.
- `src/ui/__tests__/prompt-library-modal-export-import-controls.test.ts`: 4 focused tests asserting the click/change handlers thread `includeRevisions` and `roleFilter` into `prompt-io` exactly as designed. Every other pre-v4.190.0 modal behaviour remains covered by the existing suite.

### Root cause (one sentence)
The v4.190.0 pure-logic options `includeRevisions` and `roleFilter` had no UI surface, so end-users could not exercise either feature without hand-editing JSON or calling the exports from devtools.

### Verification
- Targeted: `prompt-library-modal-export-import-controls.test.ts` — 4/4 green.
- Regression: 38 modal test files (113 tests) — all green, unchanged.



## v4.190.0 (2026-07-19)

### Added
- `src/ui/prompt-bundle-types.ts`: new `BundleRevisionRow` type and optional `revisions?: BundleRevisionRow[]` field on `PromptsBundleV1`. `buildPromptsBundle` accepts `{ revisions }` and drops rows whose `Slug` is not among the bundle's committed entries so the invariant "every revision row references a live entry" holds. `validatePromptsBundle` coerces malformed revision rows silently (revisions are optional metadata; one bad row must not fail the whole import).
- `src/ui/prompt-io.ts` `exportPromptsToJson({ includeRevisions?: boolean })`: opt-in attaches per-slug revision history (via `listPromptRevisions`) to the JSON export. Default is `false` so pre-v4.190.0 exports remain byte-identical. Per-slug fetch failures are logged and skipped, never fatal.
- `src/ui/prompt-io.ts` `applyRoleFilter(entries, role)`: pure helper that partitions imported entries into `{ kept, droppedCount }` for role-scoped bulk import. Entries with missing/invalid role are treated as non-matching.
- `src/ui/prompt-io.ts` `performPromptImport(entries, { roleFilter, revisions })`: additive options. `roleFilter` gates the DB/JSON commit path to a single role and records the drop count in `results.errors`. `revisions` are grouped by slug and inserted via `insertImportedRevisions` AFTER the entries commit, so foreign-slug references cannot occur; orphaned rows are counted and reported.
- `src/ui/__tests__/prompt-io-revisions-and-role-filter.test.ts`: 8 focused tests covering roleFilter partitioning, bundle build with orphan revision drop, parse round-trip, and end-to-end import with a mocked revision layer.

### Root cause (one sentence)
The bundle envelope schema had no field for revision history and the importer had no role gate, so an "export with history" or a "next-only bulk import" were both structurally impossible without touching the envelope contract and the `performPromptImport` options.

### Notes
- All additions are backward-compatible: `exportPromptsToJson()` still exports the exact same bytes without `includeRevisions:true`, `performPromptImport(entries)` still commits everything without `roleFilter`, and `parsePromptsText` still returns `{ valid, errors }` (with `revisions` added only when the envelope carries them).
- UI wiring (checkbox + role select in the Prompt Library modal) is intentionally not part of this release — the logic surface lands first with its regression suite; UI toggles land in v4.191.0 to keep the modal-tests migration atomic.

### Verified
- Targeted: `bunx vitest run src/ui/__tests__/prompt-io-revisions-and-role-filter.test.ts` runs 8/8 green.
- Full suite regression: expected 254 files / 1896 tests (+8 from 1888 in v4.189.0). Awaiting CI confirmation.


## v4.189.0 (2026-07-19)


### Added
- `src/ui/prompt-injection.ts`: Ctrl+D / Cmd+D toggles the inline diff pane while the prompt editor is open. Ignored variants: Ctrl+Shift+D and Ctrl+Alt+D (reserved for future shortcuts). Listener is document-scoped with a self-removal guard (`document.body.contains(overlay)`) so a stale handler cannot toggle a subsequent, unrelated modal instance.
- `src/ui/__tests__/prompt-editor-diff-shortcut.test.ts`: 5-case regression covering toggle round-trip, Cmd+D on macOS, ignored modifier variants, add-new-mode no-op, and stale-handler cleanup after overlay detach.

### Changed
- `src/ui/prompt-injection.ts` (mount gate at ex-line 483): Rule-0 live pre-save indicator is now mounted for BOTH `plan` and `next` roles (was Plan-only). The save-time gate in `prompt-injection.ts` already rejects Next-role bodies whose declared step count disagrees with the counted steps; the UX now surfaces that check live on every keystroke instead of only at Save click, closing the "click-Save-then-rejected" loop for Next-role editing.
- `src/ui/__tests__/prompt-editor-rule-zero-live.test.ts`: flipped the "role is plan-only" assertion. Next-role opens MUST mount the indicator + badge; Generic-role opens MUST NOT.

### Root cause (one sentence)
The Plan and Next roles share the same save-time Rule-0 gate (`validateRuleZero`) but only the Plan editor mounted the pre-save indicator, so Next editors received identical rejections at click-time with zero live feedback — the diff pane suffered the same paper-cut: mouse-only toggle in an otherwise keyboard-first editor.

### Verified
- `bunx vitest run`: 254/254 files, **1888/1888 tests** (+6 vs v4.188.0 baseline of 1882).
- Targeted: `prompt-editor-rule-zero-live.test.ts` (6 tests) and `prompt-editor-diff-shortcut.test.ts` (5 tests) both green.
- Manual before/after: opened Next-editor with `Steps: 3` / one numbered step → badge now shows `✗ declared 3 ≠ counted 1` and Save is disabled live (previously: no badge, Save enabled, rejection only at click).


## v4.188.0 (2026-07-19)

### Added
- `scripts/check-prompt-loader-mocks.mjs`: CI guard that rejects any `vi.mock('...prompt-loader', ...)` block not routed through `buildPromptLoaderMock()`. Uses a paren/brace/string-aware extractor so factory bodies containing `)` (e.g. `vi.fn(async () => ...)`) are matched correctly. Wired into `.github/workflows/ci.yml` next to the `.d.ts` unknown scanner.

### Changed
- Migrated 47 test files under `standalone-scripts/macro-controller/{src,tests}` from inline `vi.mock('.../prompt-loader', () => ({ ... }))` to `vi.mock('.../prompt-loader', () => buildPromptLoaderMock({ ... }))`. Files include every `src/db/__tests__/prompt-*.test.ts`, `src/seed/__tests__/*seed*.test.ts` + health/reseed suites, and every `src/ui/__tests__/prompt-library-modal-*.test.ts`. Each file now imports `buildPromptLoaderMock` from `src/__tests__/helpers/prompt-loader-mock.ts`.
- `src/__tests__/open-tabs-section.test.ts`, `src/__tests__/prompt-dropdown-tabs-always-visible.test.ts`, `src/__tests__/remix-invalidate-sentinel.test.ts`: hand-migrated to the same factory shape (custom `sendToExtension` passed as an override).

### Rationale
- Closes backlog items 9 (migrate remaining test files) and 10 (CI guard for prompt-loader mocks). Prevents recurrence of the v4.187.0 "No 'sendToExtension' export is defined on the mock" incident: any new test that mocks `prompt-loader` without the factory now fails CI immediately.

### Verified
- `bunx vitest run`: 253/253 files, 1882/1882 tests green (unchanged from v4.187.0 baseline).
- `node scripts/check-prompt-loader-mocks.mjs`: OK, 0 offenders.



## v4.184.0 (2026-07-19)

### Added
- `src/ui/prompt-history-panel.ts`: "imported" badge on revision rows whose `PromptId === 0` (sentinel set by `insertImportedRevisions`). Users can now audit at a glance which entries came from an off-device archive vs native pre-image capture.

### Fixed
- `src/ui/prompt-history-panel.ts::handleImportFile`: added 5 MB byte-size cap and JSON extension/MIME sniff BEFORE `file.text()`. Oversized or non-JSON selections now surface a toast and a `logError('PromptHistoryPanel', ...)` audit line instead of silently loading arbitrary bytes into memory. Mirrors the guard already present in `prompt-library-modal.ts` (`IMPORT_MAX_BYTES`).

### Verified
- Import path rejects files > 5 MB with logged reason (name, size, slug, role); rejects non-`.json` extensions with logged MIME.
- Existing revision rows render unchanged when `PromptId !== 0`; `data-role="imported-badge"` only appears for imported rows.



## v4.78.0 (2026-07-27)

### Added
- `.lovable/plans/completed/15-configurable-replace-token-and-n-options.md` — Plan-15 close-out ledger (20 tasks, v4.74.0 -> v4.77.0).

### Fixed
- `src/capture/__tests__/chat-submit-capture.test.ts`: `project-id-from-url` mock now exports `subscribeProjectNameChange`/`notifyIfProjectRenamed`/`extractProjectIdFromString` (7 pre-existing failures cleared).
- `src/ui/prompt-library-modal.ts`: `buildEditorEl` split into `buildTokenRow` + `buildValuesRow` + orchestrator (60-line cap).

### Verified
- ESLint 0/0, tsc clean, vitest 1293/1293.

## v4.77.0 (2026-07-27)

### Added
- Vitest: `prompt-db-rename.test.ts` (5) locks `upsertPrompt` rename acceptance and token-drift rejection via `previousReplaceKey`.
- Playwright: `tests/e2e/prompt-rename-regression.spec.ts` (3) runs bundled `prompt-db.ts` in Chromium and asserts SQL-level UPDATE/INSERT contracts.

### Changed
- Version bump 4.76.0 -> 4.77.0 (cross-project sync via `bump-version.mjs`).

## v4.76.0 (2026-07-27)

### Added
- Vitest: `configured-chip-values.test.ts` (9) locks fallback vs DB-wins, non-numeric drop, error swallow, and array cloning.
- Vitest: `prompt-io-db-bridge-replace-fields.test.ts` (4) asserts `ReplaceKey`/`ReplaceValues` round-trip and `previousReplaceKey` forwarding.

### Changed
- Version bump 4.75.0 -> 4.76.0.

## v4.75.0 (2026-07-27)

### Added
- IO bridge round-trips `ReplaceKey` + `ReplaceValues` on export/import (via `CachedPromptEntry`).
- Seeder writes explicit `ReplaceKey` / `ReplaceValues` columns and emits `replaceKey` + `replaceValueCount` in role telemetry.

### Changed
- `commitOneEntry` forwards `previousReplaceKey` so re-import of renamed tokens does not trip the drift guard.
- Playwright regression harness asserts new telemetry fields.
- Version bump 4.74.0 -> 4.75.0.

## v4.74.0 (2026-07-26)

### Added
- Plan-15 Tasks 11 & 12: Prompt Library editor now exposes an `N options` comma-separated input alongside the existing `Token` input, both wired into the save handler.
- `UpsertInput.previousReplaceKey` in `src/db/prompt-db.ts` forwards the prior `ReplaceKey` into `assertParamTokensUnchanged({ oldKey, newKey })`, so a legitimate token rename (`{{n}}` -> `{{count}}`) round-trips without triggering the drift guard.
- `handleEditSave` now takes a structured `EditSavePayload` and persists `replaceKey` / `replaceValues` through `upsertPrompt` in a single call. Inline validation blocks saves on invalid values and focuses the offending field; the status bar shows the exact reason instead of silently rejecting.

### Changed
- `src/ui/prompt-library-modal.ts`: `EditorEls` gained `valuesInput` / `valuesError`; the editor renders a live comma-separated preview and validates against `normalizeReplaceValues` on every keystroke.
- Log line on save now includes `key=<replaceKey> values=<count>` so support can confirm the persisted configuration from an exported log without diffing DB rows.
- Version bump 4.73.0 -> 4.74.0.

### Verified
- `npx tsc --noEmit -p tsconfig.macro.build.json` clean.
- Targeted vitest: `prompt-db.test.ts` (23), `prompt-token-guard.test.ts` (16), `prompt-library-modal.test.ts` (14) — 53/53 green.


## v4.73.0 (2026-07-25)

### Added
- Seed telemetry now persists to `localStorage[StorageKey.LastSeedTelemetry]` (`marco_last_seed_telemetry`) as `{ at: ISO, roles: RoleTelemetry[] }`. Root cause of the gap: v4.72.0 emitted a single log line, so telemetry only survived until log rotation trimmed it out of the persisted buffer; support triage on stale sessions could not tell whether the seeder ran, inserted, or preserved defaults. Fix: `persistTelemetry()` in `src/seed/seed-plan-next.ts` writes the last result synchronously after `emitTelemetry()`.
- `formatLogsForExport()` in `src/logging.ts` now prepends a `=== Seed Telemetry ===` block (or `Seed Telemetry: (not run this session)` when the key is absent) so the ZIP/DL export surfaces the last seed run at the top of the file, grep-friendly for support.
- New `StorageKey.LastSeedTelemetry` in `src/types/storage-keys.ts` replaces the previous magic string.
- New vitest case in `src/seed/__tests__/seed-plan-next.test.ts` asserts the persisted payload shape (`at`, `roles[].inserted`, `roles[].promotedDefault`). 6/6 seeder tests green; 13/13 across `src/seed/`.

### Changed
- Version bump 4.72.0 → 4.73.0.


## v4.72.0 (2026-07-25)

### Added
- Boot telemetry for the Plan/Next prompt seeder (`src/seed/seed-plan-next.ts`). `seedPlanNextPrompts()` now returns and logs a per-role summary `{ role, inserted, skipped, promotedDefault, alreadyDefault }`, closing the last observability gap for support triage. Root cause of the gap: the seeder ran silently on every boot; if a user reported "my plan default reverted" there was no log line to distinguish a fresh insert from a promoted default from a preserved user choice.
- Structured log line via existing `log('[SeedPlanNext] ...', 'success')`; no new logger, no new dependency.

### Changed
- Seeder now pre-queries existing slugs (`SELECT Slug FROM Prompt WHERE Slug IN (...)`) before `INSERT OR IGNORE` so inserted-vs-skipped counts are exact, not inferred. Idempotency and INSERT OR IGNORE ordering unchanged.
- `seedPlanNextPrompts()` return type widened from `{ ok, error? }` to `{ ok, error?, telemetry? }` (additive; callers ignoring the return value are unaffected).
- Test call sequence in `src/seed/__tests__/seed-plan-next.test.ts` updated for the new pre-select query; 5/5 green.
- Version bump 4.71.0 → 4.72.0.


## v4.71.0 (2026-07-25)

### Fixed
- Export/import bundle envelope was silently dropping the `role` field on every re-validate, so any plan/next/generic prompt round-tripped through JSON, ZIP, or SQLite lost its DB classification. Root cause: `PromptEntry` in `src/types/ui-types.ts` did not declare `role`, and `coercePromptEntry` in `src/ui/prompt-bundle-types.ts` did not copy it. Fix: added `role?: PromptRole` to `PromptEntry` and one `isPromptRole(raw.role)` guarded copy in `coercePromptEntry` so JSON, ZIP, and SQLite exporters (all built on `buildPromptsBundle`) now preserve `role` end-to-end.

### Added
- `src/ui/__tests__/prompt-export-role-parity.test.ts` (3 cases): JSON envelope preserves `role` on every entry, ZIP round-trip yields identical `(slug, name, role, text)` tuples as JSON, role histograms match across JSON and ZIP. SQLite is excluded from this suite for the same reason as the existing round-trip test (sql.js wasm cannot load under jsdom); the SQLite exporter uses the same upstream `buildPromptsBundle`, so any envelope-level `role` regression is caught here first.

### Changed
- Version bump 4.70.0 → 4.71.0.


## v4.70.0 (2026-07-25)

### Added
- Prompt Library modal keyboard shortcuts (`src/ui/prompt-library-modal.ts`): `Esc` cancels an open inline editor if one is active, otherwise closes the modal; `Ctrl/Cmd+S` saves the open editor by delegating to the same `handleEditSave` path used by the Save button (so the token drift guard and `previousBody` check still apply).
- Editor lifecycle tracking: `ModalRefs.activeEditor` holds `{ row, save, cancel }` so shortcut handlers reuse the exact click paths; `renderAllRoles` clears it on every re-render.
- Listener teardown per memory rule `timer-and-observer-teardown`: `closeExisting` now removes the `document` keydown listener and the `window.pagehide` listener attached in `buildShell`; a stale-refs guard (`refs.root.isConnected`) self-detaches leftover handlers if a modal was replaced without going through `closeExisting`.
- 3 new vitest cases: Esc-closes-modal, Esc-cancels-editor-only, Ctrl+S-saves-via-upsertPrompt. 14/14 green (was 11).

### Changed
- Version bump 4.69.0 → 4.70.0.

## v4.69.0 (2026-07-25)

### Added
- Prompt Library modal now has role filter chips (`all` / `plan` / `next` / `generic`), a sort selector (`default-first` / `name` / `length`), and click-to-expand body previews per row (`src/ui/prompt-library-modal.ts`). View state (`filterRole`, `sortMode`, `expandedIds`) lives on the `ModalRefs` so filters and expanded rows survive re-renders after Set-default / Duplicate / Edit / Delete actions.
- 3 new vitest cases in `prompt-library-modal.test.ts`: role chip narrows the render, sort=name reorders rows alphabetically, name-click toggles a `[data-testid="row-preview"]` body preview. 11/11 green (was 8).

### Changed
- Version bump 4.68.0 → 4.69.0.

## v4.68.0 (2026-07-25)

### Fixed
- Import dialog now surfaces per-entry errors from `PromptImportResults.errors` (Plan-14 step 12 follow-up). Token-drift rejections and other DB failures produced by the DB-routed import path were being silently swallowed behind the "N added, M updated" success toast in `src/ui/prompt-io-dialog.ts` `_handleFile`. Errors are now logged via `log(..., 'warn')` with full context and rendered as a warn toast that shows a 2-error preview + a "(+N more, see console)" hint when the list is longer.

### Changed
- Version bump 4.67.0 → 4.68.0.

## v4.67.0 (2026-07-25)

### Added
- Prompt Import/Export now round-trips DB-backed prompts (plan-14 steps 12 + 13). New `src/ui/prompt-io-db-bridge.ts` partitions incoming entries by `role`, routes plan/next/generic through `upsertPrompt` (with `previousBody` so the token guard still runs on plan/next edits), and merges DB rows into JSON/ZIP/SQLite exports with DB rows winning on slug collisions.
- `CachedPromptEntry.role` optional field; `validatePromptEntry` preserves it when valid (`plan`/`next`/`generic`), ignores it otherwise.
- `collectAllExportEntries()` in `prompt-io.ts` shared by JSON, ZIP, and SQLite export paths so all three formats now include user edits from the Prompt Library.
- 6 new vitest cases in `prompt-io-db-bridge.test.ts` covering partition, DB read, DB-wins merge, previousBody wiring for edits, brand-new-slug insert, and per-entry error surfacing.

### Changed
- Version bump 4.66.0 → 4.67.0 across manifest.json, version.json, shared-state.ts, instruction.ts, and root readme pins.



## v4.66.0 (2026-07-24)

### Added
- Prompt Library modal now supports **Edit** per row (plan-14 step 11). Editing a `plan`/`next` row passes `previousBody` through `upsertPrompt`, so `assertParamTokensUnchanged` blocks any save that would remove `{{n}}` / `${n}`. Save failures render inline in the modal status bar and via `logError('PromptLibraryModal', ...)`.
- Dropdown header now carries a **🗂 Library** pill that opens `openPromptLibraryModal()` on click (plan-14 step 10 launcher). Lazy `import()` keeps the modal out of the initial dropdown bundle.

### Changed
- Version bump 4.65.0 → 4.66.0 across manifest.json, version.json, shared-state.ts, instruction.ts, and root readme pins.



## v4.11.0 (2026-06-28)

### Fixed
- Inline Plan, Next, and Repeat strips now share a single persisted +/- collapse control above the chat box.
- Added regression coverage for the shared inline-strip group collapse behavior.

### Changed
- Version bump 4.9.1 → 4.11.0 across manifest, version.json, constants.ts, all instruction.ts files, SDK runtime/cache schema, payment-banner-hider, shared-state.ts, and root readme pins.

## v3.53.0 (2026-06-05)

### Changed
- Removed residual hardcoded timezone examples from runtime fixtures and remaining spec documents.
- Version bump 3.52.0 → 3.53.0 across manifest, version.json, constants.ts, all 8 instruction.ts, and shared-state.ts.

## v3.52.0 (2026-06-05)

### Changed
- Removed hardcoded timezone formatting from source code, default prompts, metadata, and `.lovable` cleanup targets.
- CSV export timestamps now store UTC ISO strings; UI timestamp displays resolve the user's local timezone at render time.
- Credit Totals reset timestamp now uses local-midnight semantics instead of fixed-offset calculations.
- Version bump 3.51.0 → 3.52.0 across manifest, version.json, constants.ts, all 8 instruction.ts, and shared-state.ts.

## v3.51.0 (2026-06-04)

### Added
- Playwright E2E skeleton for Credit Totals modal (sort → drag → filter → CSV).
- Close-out of `.lovable/plans/credit-totals-and-macro-ux-20-step.md` — every Step 1–20 fix shipped with matching tests; no-autorun guard verified, parseInt radix verified, Task-Next right-anchored, Credit Totals modal sort/drag/filter/CSV/projects-column live.

### Changed
- Version bump 3.50.0 → 3.51.0 across manifest, version.json, constants.ts, all 8 instruction.ts, shared-state.ts.

## v3.38.0 (2026-05-30)


### Added
- **Issue 125 — Dashboard Summary Bar, Auth Relocation & Expire Badge Color Fix.**
  - Compact summary strip below the title row with three pills: `🪪 N Pro (M exp)`, `💳 Available / Total` (Pro credits), `⚡ Available` (Free credits). Numbers recompute in one frame against the currently visible workspace set after any filter change (search, chips, Focus Current, etc.).
  - `Auth Diagnostics` moved from its top-level panel position into the `Tools & Logs` accordion, collapsed by default. Preference persisted under `Ui.ToolsLogs.AuthDiagExpanded`.
  - `visible-workspaces-store.ts` tiny pub/sub selector drives both the workspace list and the summary bar.
  - Expire badge tone fix per `workspace-badge-display` memory contract: `expire-soon` → amber, `canceled` → muted gray (NOT red), `expire` → muted red-orange.
  - Tests: `compute-summary.test.ts` (aggregator), `classifier-tone.test.ts` (tone snapshot), `panel.integration.test.ts` (mount location + reactivity).
- **Issue 126 — Ctrl+Shift+Down script attach regression fix.**
  - `runScriptsFromShortcut` now reads the active tab URL, applies the `isNewTabOrBlankUrl` guard, resolves eligible scripts via `resolveScriptsForShortcut`, and always force-reloads (popup Run button parity).
  - Empty-set abort now logs `tabId`, `url`, `project`, `source`, `reason`, and a URL auto-attach candidate list so the silent-abort regression cannot recur.
  - Tests: `shortcut-command-handler.test.ts` (5 tests: active-project, no-active-project, empty-scripts, non-array defensive, probe-failure).
- **Issue 127 — Prompts dropdown: restored Plan row + Task Next right-anchor fix.**
  - Re-added `Plan` row inline in the Prompts dropdown body (below Task Next), wired to existing `plan-task-ui.ts` opener.
  - Task Next sub-menu now anchors **right** of its row by default (`left = rowRect.right + GAP`) with a stacked-below fallback when viewport space is insufficient. Never opens leftward off-screen.
  - Same right-anchor rule applied to the Plan sub-menu for consistency.
  - Tests: `task-next-right-anchor.test.ts` (10 tests), `plan-row-in-prompts-dropdown.test.ts` (row presence + opener wiring). Existing `tasks-right-anchor.test.ts`, `tasks-toggle-hover-open.test.ts`, `plan-task-ui.test.ts`, and `prompts-panel-layout.test.ts` still pass.
- **Issue 128 — Queue auto-resume when loop running.**
  - `readQueueCount()` with 3-tier selector waterfall (primary XPath → header walk via `data-panel-open` → aria-button walk from Pause/Resume button) returns the exact integer or `null` for invalid/missing.
  - `autoResumeQueueIfNeeded()` integrated into the loop heartbeat tick (`refreshStatus`). When the loop engine is running, the queue has ≥1 task, and the queue is paused (Pause visible, Resume hidden), it clicks Resume once per tick. No retry; no click when `document.hidden`.
  - Tests: `queue-count.test.ts` (10 tests, all 3 selector strategies), `auto-resume.test.ts` (9 tests, all 6 policy branches + safety guards).

### Added
- **Issue 124 — Loop Run-State Gate + Queue Pause/Resume + Project-Lock detection.**
  - `loop-run-state/` (`isRunActive` / `isRunIdle` / `waitForRunIdle`) observes the composer Submit button + STOP icon via XPath. **Read-only — STOP is never clicked.** Timeout 120s, poll 1s, single-shot.
  - `queue-control/` (`pauseQueue` / `resumeQueue` / visibility helpers) clicks only the `Pause queue` / `Resume queue` buttons.
  - `project-lock/` detector (HTTP 423, body `project_locked`, body `project is locked`, optional DOM banner) + `LoopProjectLockEvent` SQLite store via `marco.kv` with 1s dedupe per `(workspace, project, reason)`.
  - `loop-move-gate.ts` wraps `moveToWorkspace` from both `ws-adjacent` paths (fresh + cached fallback). Behaviour when flag ON: wait-idle → pause source → move → poll 15s for Resume → click once. Resume-missing logs and returns; no retry.
  - `feature-flags.ts` with `Loop.RunStateGate.Enabled` (now defaulting ON in v3.37.0; overridable via `window.marco.featureFlags`).
- **Issue 124 — 31 tests, all passing**: `loop-run-state` (7), `queue-control` (6), `project-lock/detector` (7), `project-lock/store` (6), `loop-move-gate` integration (5). The integration suite asserts via click-spy that the composer Submit/STOP button is never clicked.

### Changed
- **`Loop.RunStateGate.Enabled` default flipped to `true`** (Issue 124 §6). Set `window.marco.featureFlags['Loop.RunStateGate.Enabled'] = false` to revert.
- Version bump: 3.36.0 → 3.37.0.

## v3.36.0 (2026-05-30)

### Added
- **Issue 122a closeout — `pro_1` enrichment unit tests** (`src/credit-balance/__tests__/pro-one-enrichment.test.ts`, 9 tests) — overlay onto `pro_1` rows, case-insensitive/whitespace-trimmed plan literal, non-`pro_1` left untouched, cache-miss no-op, missing-id skip, negative-value clamping (`available`/`totalCreditsUsed`/`dailyUsed` ≥ 0), fractional rounding, multi-row batch counts.
- **Issue 122a closeout — `ws-move` post-move credit-balance refresh test** (`src/__tests__/ws-move-post-refresh.test.ts`, 2 tests) — verifies the destination workspace's `/credit-balance` is force-refreshed via `fetchAndPersist(id, { force: true, source: 'manual' })` after a successful move, bypassing the 10s per-ws throttle, and that the refresh is fire-and-forget (move still resolves on refresh failure).

### Changed
- Version bump: 3.34.2 → 3.36.0 (synced with root).

---

## v3.34.2 (2026-05-29)

### Changed
- **Totals modal "Remaining" tile adopts `remaining / granted` framing** (Issue 122 follow-up) — visual parity with workspace-row 💰 chips. `0/100` instead of bare `0` when the pool is fully consumed; falls back to bare number when `granted=0`. New regression test `issue-122-totals-modal-remaining-over-granted.test.ts` (4 tests); existing modal suite (16 tests) unaffected.

---

## v3.34.1 (2026-05-29)

### Fixed
- **Issue 121 follow-up — Pro credit-sort filter restores naturally-expired workspaces** — `isProExpiringWs()` no longer drops rows whose display.kind collapses to `'canceled'` when the underlying `subscriptionStatus` is `'expired'` (recovery candidates). Only literal `canceled`/`cancelled` subscriptions are excluded. E2E `run-credit-sort-e2e.test.ts` 7/7 pass.

---

## v3.34.0 (2026-05-29)

### Added
- **Issue 123 — Credit-totals test matrix (51 tests / 5 files)** — every account type (`pro_1`, `pro_3`, `lite`, `ktlo`, `pro_0`, `FREE`) gets 10+ positive/negative function-based assertions plus an 11-test end-to-end suite that drives realistic Lovable `/api/user/workspaces` JSON payloads through `parseLoopApiResponse → aggregateCreditTotals`. Locks down the Issue 120 (billing-only for non-`pro_0`) and Issue 122 (P0065 100/100 = 0 remaining) regressions with explicit `.not.toBe(105)` / `.not.toBe(999)` checks so future refactors can't silently re-introduce sum-of-pools behavior.

---

## v3.33.0 (2026-05-29)


### Fixed
- **Issue 122 — credit-bar pool chips show "remaining/limit"** — `renderCreditBar()` (`credit-api.ts`) now formats 💰 Monthly / 🔄 Rollover / 📅 Free / 🎁 Bonus as `remaining/limit` (e.g. `💰 0/100`) instead of bare remaining (`💰 0`). Fully-consumed pools are no longer confused with absent pools. Caller `buildWsRow` in `ws-list-renderer.ts` now passes through `billingLimit`, `rolloverLimit`, `dailyLimit`, and `freeGranted` from the workspace record. Regression test: `__tests__/issue-122-credit-bar-pool-denominator.test.ts`.

---

## v3.32.0 (2026-05-29)


### Fixed
- **Issue 120 — pro_1 Credit Totals over-reporting** — `aggregateCreditTotals()` now reads billing-period fields (`ws.limit` / `ws.billingAvailable` / `ws.used`, mapped from `billing_period_credits_limit` / available / used) for non-`pro_0` plans (`pro_1`, `pro_3`, `lite`, `ktlo`). The previous behaviour summed all five credit pools (granted+daily+billing+topup+rollover) and inflated `Total` / `Remaining` for every paid `pro_1` workspace. `pro_0` still uses the enriched `/credit-balance` fields; `FREE` tier remains excluded. New `pro_1`-specific regression test in `__tests__/credit-totals.test.ts` plus updated fixtures (11/11 + 83/83 credit-totals suite green).

---

## v3.17.0 (2026-05-25)

### Fixed
- Refill-soon filter now sorts highest-credit workspaces first. Previously, enabling the "Refill-soon" chip showed all rows with `Refill 1d` in raw API order — so workspaces with `available=0` sat above ones with hundreds of credits. `ws-list-renderer.ts::filterAndSortWorkspaces` now applies `sortByRefillPriority` whenever the refill-soon filter is active (in addition to when the refill-priority sort toggle is on). Added `__tests__/ws-refill-soon-sort.test.ts` (source-invariant + 7-row behavioural test mirroring the reported screenshot).

---

## v3.16.0 (2026-05-25)

### Added
- 20-step plan Step 4 — `Plan Task` + `Task Next` controls now render in a right-anchored floating panel attached to the prompts dropdown's right edge (was a stacked inline group). Keeps the prompts list focused; hidden by default; toggled by the `🎯 Tasks` header button. 5 new source-invariant tests in `src/__tests__/tasks-right-anchor.test.ts`; existing `prompts-panel-layout.test.ts` updated for the new cssText shape.

### Fixed
- `credit-totals-modal.ts` open-projects double-click handler — replaced silent `/* ignore */` catch with `logError('creditTotalsModal.openProjects', ...)` per Code-Red contract (exact URL + reason).

---

## v3.15.3 (2026-05-25)

### Fixed
- `gitsync-api.ts`: HTTP 401/403 responses now map to `{ status: 'not_linked' }` (same as 404), so right-clicking a workspace whose project the user can't access shows the friendly "No GitHub repo linked" toast and caches the result, instead of the scary `❌ Failed to fetch GitHub repo: http_403` error toast.

---

## v3.15.2 (2026-05-25)

### Fixed
- pro_0 workspaces with `available === 0` or `totalCredits === 0` no longer crash with `[CODE RED] calcAvailableCredits() called for plan=pro_0`. `ui/ui-status-renderer.ts` and `ws-list-renderer.ts` switched the legacy-fallback expressions from `||` to `??`, so enriched zero values from `pro-zero-credit-calculator` are preserved instead of triggering the legacy aggregator guard.

---

## v3.15.1 (2026-05-25)

### Internal
- Version bump: 3.15.0 → 3.15.1 — synced with extension release v3.15.1 (root `readme.md` pinned to new tag). No functional changes.

---



## v3.15.0 (2026-05-25)

### Fixed
- **Toolbar minimize/expand button squish** (Issue 117, 5-step RCA) — Root cause: `toggleMinimize` / `restorePanel` / `_restoreMinimizedPanel` wiped `bodyElements` inline `display` styles (e.g. `btnRow`'s `display:flex`) by setting `el.style.display = ''`, causing `gap` / `justify-content` / `align-items` to become inert after every expand cycle. Durable fix stashes `el.style.display` into `data-macro-prev-display` on minimize and restores it on expand via `_hideBodyElement()` / `_showBodyElement()` helpers. Added 5 regression tests (`panel-minimize-expand-display.test.ts`).

### Internal
- Version bump: 3.14.2 → 3.15.0 (synced with extension release).

---

## v3.14.2 (2026-05-25)

### Internal
- Version bump: 3.14.1 → 3.14.2 (synced with extension release).

---

## v3.14.1 (2026-05-25)

### Added
- **Credit Totals Modal** (Issue 116) — `💰 Credit Totals` right-click menu entry opens a summary modal:
  - `This Billing Cycle` card (total granted / used / remaining) and `Free Daily Credits` card (used today / 5 daily).
  - Per-workspace breakdown table with `Credits Used / Granted` and `Available`.
  - Missing-data warning row for workspaces without cached credit data.
  - `↻ Refresh` button re-renders from the latest snapshot.
- A11y: focus trap + `Escape` to close (`aria-modal="true"`, `tabIndex="-1"`).
- 25 unit tests (credit totals logic, modal rendering, dialog lifecycle, a11y handlers).

### Internal
- Version bump: 3.13.0 → 3.14.1.

---

## v3.13.0 (2026-05-25)

### Fixed
- **Chatbox prompts dropdown header** — `📋 Click to paste into editor` + `✏️ Edit` no longer wraps/clips inside the 180px-wide dropdown. Header text shortened to `Click to paste` (full label moved to `title=` tooltip), Edit button collapsed to icon-only with `flex:0 0 auto` so it never wraps.
- **Floating Task Next submenu vertical overflow** (`save-prompt-task-next.ts`): the 13-row flyout (`Next 1..40 tasks` + Custom + Settings) now caps at `max-height:80vh` with internal scroll, and `positionSubmenu()` clamps `top` upward when the menu would extend past the viewport bottom. Horizontal clamp also respects an 8px viewport pad.

### Internal
- Version bump: 3.12.0 → 3.13.0 (pinned across manifest.json, src/shared/constants.ts, standalone-scripts/macro-controller/src/shared-state.ts, standalone-scripts/macro-controller/src/instruction.ts).

## v3.12.0 (2026-05-25)

### Changed
- **Workspace status badges — unified label system** (Issue 115):
  - `expired-canceled`, `fully-expired`, plain `expired` all collapse to a single muted gray **`Cancel`** badge (light yellow text on slate-500). The legacy red `Expired` pill is gone for canceled rows.
  - `about-to-expire` (past_due) → **`Expire {N}d`** (amber). When the past_due event already lapsed (`daysSince ≥ 1`) → **`Expired {N}d`** (red).
  - `about-to-refill` → **`Refill {N}d`** / **`Refill today`** (sky/info). Inline `R Nd` chip auto-suppressed to prevent double-badging.
- `ws-list-renderer.ts` + `ws-hover-card.ts` now share a single classifier (`classifyFromStatus`) and tone resolver (`resolveBadgeStyle`). The duplicate `STATUS_PILL_STYLES` / `PILL_STYLES` maps are removed.

### Added
- `workspace-display-status.ts` — pure classifier that maps `WorkspaceStatus` → `WorkspaceDisplayStatus` (kind + label + tone + tooltip).
- `workspace-badge-styles.ts` — single-source tone→CSS resolver. `muted` tone guaranteed never to contain red palette fragments.
- **Refill-soon filter chip** in the workspace filter menu (`loop-ws-refill-soon-filter`). Shows only workspaces currently classified as `about-to-refill`.
- 28 new tests (13 classifier + 6 tone resolver + 5 composition + 4 chip).

### Internal
- Version bump: 3.11.1 → 3.12.0.

## v3.11.1 (2026-05-25)


### Fixed
- **Issue 114 — `pro_0` Credit Balance Calculation**: `pro_0` plans now display correct credit totals and availability. Legacy `calcTotalCredits` / `calcAvailableCredits` aggregators that double-counted `daily_limit` for `pro_0` are bypassed in favor of the server-authoritative `/credit-balance` fields.
  - `Total` = `total_granted` (was summing `*_limit` fields).
  - `Available` = `total_remaining` (was subtracting `*_used` independently).
  - `TotalUsed` = `total_billing_period_used`.
  - `Billing`, `Daily`, `Topup`, `Bonus`, `Rollover` sub-buckets derived from `grant_type_balances[].remaining`.

### Added
- Pure calculator module `pro-zero-credit-calculator.ts` with `calculateProZeroCreditSummary()` — no I/O, no globals.
- 35 unit tests across 4 groups (calculator, wiring, renderers, E2E fixtures).
- 6 anonymized E2E JSON fixtures under `tests/e2e/credit-balance/fixtures/`.
- Node E2E harness `run-credit-balance-e2e.test.ts` with invariant checks.
- Defensive `assertNotLegacyCalcForProZero()` guard in `calcTotalCredits` / `calcAvailableCredits` — throws in dev/test, CODE-RED logs in prod.

### Tests
- Group A (12): calculator mappings for Total, Available, Used, Daily, Billing, Topup, Bonus, Rollover, Ledger, Source, ExpiringSoon.
- Group B (8): wiring invariants — `buildSummary` delegation, `applySummaryToRow` verbatim copy, legacy-guard throw/log, non-pro_0 regression.
- Group C (6): renderer integration — credit bar, hover card title, compact/non-compact status bar, Copy-JSON payload.
- Group D (9): E2E fixture validation with sanitized IDs/emails.

## v3.9.0 (2026-05-24)

### Fixed
- Prompts dropdown portals to `document.body` to escape `overflow: hidden` clipping.
- Viewport-aware flip (up/down) + clamp (left/right) with dynamic `max-height`.
- `Task Next` submenu scrolls into view when parent dropdown opens upward.

## v3.5.1 (2026-05-22)

### Projects Modal — 15-Step Improvement (Steps 1–14)

- **Step 1 — Spec**: Wrote `spec/projects-modal/00-overview.md` documenting the `projects.list` / `projects.get` flow, the HTTP 405 root cause, and the target cache-backed behavior.
- **Step 2 — 405 Fix**: Dropped the deprecated `projects.get` endpoint (returned HTTP 405). CSV export now sources git/activity fields directly from the enriched `projects.list` response, eliminating N extra HTTP calls.
- **Step 3 — Name resolution**: Multi-source fallback for blank project names — `projects.list` → open-tab title → SQLite cache. No CSV row emits raw ID when a human-readable name exists.
- **Steps 4–7 — SQLite cache**: Added `projects-cache.ts` with `MacroProjectListCache:*` KV keys. Default TTL 48 h, user-tunable via Settings → Debugging (`projectsCacheTtlHours`). Cache hit/miss logged to activity log.
- **Step 9 — Workspace credits**: Per-workspace header now shows `name · creditsUsed / creditsTotal`.
- **Step 10 — Search bar**: Case-insensitive substring filter across project `name` + `id`.
- **Step 11 — Workspace chips**: Toggle filter chips to show/hide entire workspace blocks.
- **Step 12 — Row badges**: `⎇ repo:branch` pill and clickable `↗` open-in-new-tab icon on every project row.
- **Step 13 — Empty/error UX**: Friendly states for "no workspaces", "no matches" (with clear-filters button), per-block load failures, and per-block "no projects yet".
- **Step 14 — E2E verification**: Added `scripts/verify-projects-cache.mjs` — 7 scenarios, 18 checks (round-trip, miss, TTL expiry, clear, malformed JSON, wrong shape, KV unavailable). All green.
- **Dropped**: Step 8 (inter-fetch delay slider) — eliminated along with the `projects.get` sequential fetch loop.

### Version Alignment

- Bumped macro-controller version to **3.5.1** in sync with extension manifest.

---

## v2.1.0 (2026-04-03)

### Version Alignment

- Bumped version from 1.74.0 → 2.1.0 to match extension manifest v2.1.0.0
- Eliminates version mismatch banner in popup

---

## v1.74.0 (2026-03-31)

### Code Quality Audit — Full CQ Compliance

- **var elimination**: Converted all legacy `var` declarations to `const`/`let` — 0 remaining
- **CQ11 (module-level `let`)**: All mutable module-level state encapsulated in singleton classes (`BulkRenameManager`, `PromptLoaderState`, `AuthRecoveryManager`, `ToastManager`, etc.) — 0 violations
- **CQ12 (global mutation)**: All shared array/map mutations replaced with immutable data flow — 0 violations
- **CQ13 (C-style `for` loops)**: 13 justified exceptions documented (index-based APIs: `localStorage.key(i)`, `snapshotItem(i)`, reverse iteration)
- **CQ16 (nested named functions)**: Resolved all 60 violations across 25+ files
  - `auth-bridge.ts`: `finish`/`onResponse`/`onPong` → `finishBridgeAttempt`/`handleBridgeResponse`/`handleRelayPong` with `BridgeAttemptCtx`/`RelayPingCtx`
  - `prompt-loader.ts`: 5 closures → `finishRelay`/`handleRelayResponse`/`handlePromptRelayResponse`/`finishLegacyLoad`/`_fetchFromExtensionAttempt` with `RelayCtx`/`PromptRelayCtx`
  - `rename-bulk.ts`: Recursive `doNext` closures → private methods `_doNextRename`/`_doNextUndo` on `BulkRenameManager`
  - `task-next-ui.ts`: `doNextTask` → module-scope with `TaskNextLoopCtx`; `tryClickAndAdvance` with `ClickContext`
  - `bulk-rename.ts`: 9 named functions → `const` arrow assignments (drag handlers, preview, ETA, start-num bindings)
  - `database-modal.ts`: `switchTab` → `switchDbTab` at module scope
  - `settings-ui.ts`: `switchTab`/`onEsc` → `switchSettingsTab`/`onSettingsEsc` at module scope
  - `loop-controls.ts`, `check-button.ts`, `prompt-injection.ts`, `async-utils.ts`, `menu-helpers.ts`, `menu-builder.ts`, `startup-global-handlers.ts`, `prompt-dropdown.ts`, `save-prompt-dropdown.ts`: Various nested helpers extracted to module scope with context interfaces
  - `hot-reload-section.ts`, `save-prompt.ts`, `section-auth-diag.ts`, `section-ws-history.ts`, `panel-controls.ts`, `ws-dialog-detection.ts`, `ws-move.ts`, `startup-persistence.ts`, `startup-token-gate.ts`, `macro-looping.ts`: Final 12 closures converted
  - `auth-diag-waterfall.ts` (`renderWaterfall`), `database-json-migrate.ts` (`checkDone`), `save-prompt-prompt-list.ts` (`updateStyles`), `save-prompt-task-next.ts` (`positionSubmenu`), `settings-tab-panels.ts` (`makeToggle`): Last 5 nested functions → `const` assignments
- **Type safety**: 4 `any` (3 test, 1 facade) and 2 `as unknown as` (SDK window access) — all justified
- **`Record<string, any>`**: 0 remaining

### Audit Report

- Full audit documented in `.lovable/memory/audit/macro-controller-cq-audit-2026-03-31.md`
- Compliance: CQ11/CQ12 100%, CQ13 100% (exceptions documented), CQ16 100% (all 60/60 fixed) ✅
- Version bump: 1.73.0 → 1.74.0

---

## v1.73.0 (2026-03-28)

### Performance Audit (MC-01 → MC-08, EXT-01 → EXT-03)

- **MC-01**: Replaced all hot-path `innerHTML` assignments with `textContent` for XSS safety and performance
- **MC-02**: Converted `element.style.cssText` bulk assignments to individual `style.*` properties where applicable
- **MC-03**: Replaced `setInterval` countdown timer with `requestAnimationFrame` for smoother rendering
- **MC-04**: Narrowed `MutationObserver` scope — `childList: true` on main container without `subtree`
- **MC-05**: Added conditional polling — diagnostics and status updates pause when tab is hidden or panel collapsed
- **MC-06**: Replaced `querySelector` lookups with cached `getElementById` where IDs exist
- **MC-07**: Deduplicated repeated DOM style strings into shared constants
- **MC-08**: Reduced macro controller bundle size by 12% (389 KB → 344 KB)
- **EXT-01**: Removed `framer-motion` dependency (0 KB saved in bundle, replaced with native CSS transitions)
- **EXT-02**: Tree-shook unused Radix UI subpath imports
- **EXT-03**: Lazy-loaded `MonacoCodeEditor` via `React.lazy()` + `Suspense` to defer ~2 MB Monaco bundle

### Type System Cleanup

- Eliminated **all** `as unknown as` double-casts (111 → 0) across the entire codebase
- Added index signatures to `XPathConfig`, `TimingConfig`, `TaskNextSettings`, and `LogManagerConfig` interfaces
- Changed `CreditManager.getState()` return type from `Record<string, unknown>` to `LoopCreditState`
- Added `taskNextDeps?` to `PanelBuilderDeps` interface (was accessed via double-cast)
- Replaced `resolve._timer` monkey-patch in auth recovery with a proper `Map<resolve, timer>`
- Added `MarcoSDK` interface to `globals.d.ts` for typed `window.marco` access
- Replaced `this as unknown as HTMLElement` patterns with direct element references
- Explicit `ThemePreset` construction in `resolvePreset()` schema v1 fallback (no more structural cast)
- Final audit: 0 `as unknown as`, 1 justified `as any` (class→facade window assignment)

### UIManager Registration & Bootstrap Refactor

- **Fixed**: `MacroController: UIManager not registered` error — `UIManager` was defined but never instantiated
- Wired up `new UIManager()` → `setCreateFn()` → `mc.registerUI()` in `macro-looping.ts`
- Refactored `bootstrap()` in `startup.ts` to use `mc.ui.create()` instead of `deps.createUI()`
- Removed `createUI` and `destroyPanel` from bootstrap dependency injection — UIManager now owns full lifecycle

### Housekeeping

- Archived completed performance audit specs to `spec/archive/`
- Version bump: 1.72.0 → 1.73.0 (all components synchronized)
