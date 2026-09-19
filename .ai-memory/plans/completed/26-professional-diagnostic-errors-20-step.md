# Professional, diagnostic error messages with unique codes (20-step)

Slug: professional-diagnostic-errors-20-step
Steps: 20
Status: completed
Created: 2026-07-19
Completed: 2026-07-19
Shipped in: v4.251.0 through v4.263.0

## Context
Overhaul every error surface in the macro-controller extension so each failure emits a unique, greppable error code plus a full variable-context object, and the human message is professional and actionable. Driven by user command `.lovable/spec/commands/04-professional-diagnostic-error-messages.md` and issue `.lovable/issues/open/08-error-messages-not-diagnostic.md`. Primary code area: `standalone-scripts/macro-controller/src/` (error-utils, ui/prompt-*, db/*, seed/*, chip-gear-menu, repair-report-modal). Follows `.lovable/coding-guidelines.md` and any `spec/*error-manage*/` folder rules (mandatory for coding tasks).

## Appended from prior pending tasks
- 10-unified-billing-all-workspaces
- 11-prompts-import-export-section
- 13-per-project-chat-submit-tracker
- 22-prompt-library-test-coverage-50
- 23-prompt-library-relocate-and-light-mode
- 24-eslint-warnings-cleanup-30
- 25-eslint-cleanup-continuation-30
(Left in place; not merged into these 20 steps.)

## Steps

1. Read all existing error-management specs (`.lovable/coding-guidelines.md`, any `spec/*error-manage*/`, `standalone-scripts/spec/`) and produce `.lovable/plans/subtasks/26-professional-diagnostic-errors-20-step/01-audit-of-error-sites.md` listing every `throw`, `Logger.error`, and toast-error site with current message + missing variables.
2. Define the error-code taxonomy (`<AREA>_<ACTION>_E<NNN>`) and areas (PROMPT, SEED, DB, REPAIR, CHIP, HISTORY, HEALTH, INSTALL, RELEASE, TELEMETRY). Write `02-taxonomy.md`.
3. Create `standalone-scripts/macro-controller/src/errors/error-codes.ts` as the single registry: `{ code, area, severity, humanTemplate, requiredContextKeys }`. Export a frozen record.
4. Create `standalone-scripts/macro-controller/src/errors/diagnostic-error.ts` with `class DiagnosticError extends Error` carrying `{ code, context, cause? }` and a `toReport()` serializer that masks sensitive keys per verbose-logging rules.
5. Add `formatDiagnosticToast(code, context)` in `errors/format.ts` returning `{ title, body, footerCode }`; enforces professional wording (no profanity, no bare "Failed", must include attempt+cause+next-fix).
6. Wire `Logger.error(code, context, cause?)` overload in the namespace logger so every diagnostic error flows through one path and lands in the diagnostics ZIP with the code as an indexable field.
7. Refactor `error-utils.ts` to prefer `DiagnosticError` and re-export helpers; keep back-compat for legacy call sites during migration.
8. Migrate `ui/prompt-editor.ts` throw/toast sites to `DiagnosticError` codes `PROMPT_EDIT_E001..E0xx` capturing `{ role, slug, action: 'add'|'edit'|'save'|'reset', tokensExpected, tokensActual, ruleId, bodyLength }`.
9. Migrate `ui/prompt-injection.ts` and `ui/prompt-utils.ts` validation errors to `PROMPT_VALIDATE_E0xx` capturing `{ role, slug, ruleId, expected, actual, sampleTokens, cursorLine }` and structured multi-line toast via `formatDiagnosticToast`.
10. Migrate `seed/seed-plan-next.ts` and `seed/prompt-health-check.ts` to `SEED_E0xx` / `HEALTH_E0xx` capturing `{ boot, inserted, promoted, upgraded, dbVersion, telemetryId }`.
11. Migrate `db/*` (macro-db, prompt row IO) to `DB_E0xx` capturing `{ table, op, pkey, sqliteCode, statementHash }` and never leak raw SQL to toasts.
12. Migrate `ui/chip-gear-menu.ts` repair action + `ui/repair-report-modal.ts` to `REPAIR_E0xx` capturing `{ role, before, after, fixed, stillBroken, newlyFlagged, durationMs }`.
13. Migrate `ui/prompt-history-panel.ts` slug-resolution errors to `HISTORY_E0xx` capturing `{ requestedSlug, role, fallbackChain, resolved, promptId }`.
14. Add ESLint rule / grep-based CI check `scripts/check-error-codes-unique.mjs` that fails when: a code is defined twice, a code is thrown from >1 file, or a throw/`Logger.error` lacks a code. See `./subtasks/26-professional-diagnostic-errors-20-step/03-lint-check.md`.
15. Add ESLint restriction (`no-restricted-syntax`) banning bare `new Error('...')` inside `standalone-scripts/macro-controller/src/**` outside `errors/`; allow `DiagnosticError` only.
16. Add Vitest suite `errors/__tests__/error-codes.test.ts` verifying: registry uniqueness, requiredContextKeys enforced at throw time, `formatDiagnosticToast` output shape, no forbidden words.
17. Add per-area migration tests (`prompt-editor.errors.test.ts`, `seed.errors.test.ts`, `repair.errors.test.ts`) asserting each known failure path throws the expected code with the expected context keys populated.
18. Update diagnostics ZIP exporter to include `error-code-index.json` (code → count → last context) and a human `errors.md` grouped by area/severity. See `./subtasks/26-professional-diagnostic-errors-20-step/04-diagnostics-export.md`.
19. Update `readme.md` + `standalone-scripts/readme.md` "Troubleshooting" with the code registry link and a "How to report a bug" section instructing users to copy the error code + context block.
20. Release: bump MINOR (v4.246.0), add changelog entry summarizing the taxonomy + migrated areas + CI checks, pin version in root readme, run `scripts/update-stale-version-refs.mjs` and `scripts/check-version-sync.mjs`, then move this file to `.lovable/plans/completed/26-professional-diagnostic-errors-20-step.md` and flip Status to `completed`.

## Verification
- `scripts/check-error-codes-unique.mjs` passes in CI; intentional dupe in a scratch branch fails it.
- Vitest suites in step 16-17 green; coverage report shows every migrated file exercised.
- Manual: trigger a Plan save with too-few `{{n}}` tokens; toast shows professional sentence + code `PROMPT_VALIDATE_E0xx`; console has full context object; diagnostics ZIP contains the code in `error-code-index.json`.
- Manual: run Repair action; modal footer shows `REPAIR_E000` success or a specific failure code with role/before/after.
- Grep: `rg "new Error\('"` under `standalone-scripts/macro-controller/src` (excluding `errors/`) returns zero hits.
- Release checks: `check-version-sync.mjs`, `check-release-readiness.mjs`, manifest diff all clean before publish.

## Subtasks
- `./subtasks/26-professional-diagnostic-errors-20-step/01-audit-of-error-sites.md`
- `./subtasks/26-professional-diagnostic-errors-20-step/02-taxonomy.md`
- `./subtasks/26-professional-diagnostic-errors-20-step/03-lint-check.md`
- `./subtasks/26-professional-diagnostic-errors-20-step/04-diagnostics-export.md`
