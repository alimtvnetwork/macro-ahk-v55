# Configurable Replace Token & N Options (Plan-15)

Slug: configurable-replace-token-and-n-options
Steps: 20 (delivered as 10 pairs across v4.74.0 -> v4.77.0)
Status: completed
Sealed at: v4.77.0 (2026-07-27)

## Goal

Move the Plan / Next chip substitution token (previously hardcoded `{{n}}` / `${n}`) and the numeric chip values (previously hardcoded `[3, 5, 8]` for Plan and `[1, 2, 3]` for Next) into the `Prompt` DB row so each prompt owns its own placeholder key and its own value set. Users must be able to edit the token AND the values from the Prompt Library modal, and the token drift guard must allow intentional renames while still rejecting accidental drops.

## Root cause of the gap being closed

Before Plan-15, the Plan and Next chip renderers read `PLAN_DEFAULT_VALUES` and `NEXT_DEFAULT_VALUES` constants and passed the string `'n'` as the substitution key. There was no way for a user to change either without editing source. The `Prompt` table had no columns to carry per-row configuration, and the token guard treated any `{{n}}` count change as a violation, so renames were impossible even if the schema had existed.

## Delivered scope (20 tasks)

| Tasks | Version | Root-cause fix |
| ----- | ------- | -------------- |
| 1, 2   | v4.74.0 | Added `ReplaceKey TEXT` + `ReplaceValues TEXT` columns via `migratePromptReplaceColumns` in `standalone-scripts/macro-controller/src/db/macro-db.ts`; added `prompt-defaults.ts` validators. |
| 3, 4   | v4.74.0 | `PromptRow` + `UpsertInput` in `prompt-db.ts` extended; `coercePromptEntry` round-trips the new fields in `prompt-bundle-types.ts`. |
| 5, 6   | v4.74.0 | `prompt-token-guard.ts` accepts `{oldKey, newKey}` on `assertParamTokensUnchanged`, so a rename is allowed if counts match. |
| 7, 8   | v4.74.0 | `utils/token-substitute.ts` performs whitespace-tolerant `${key}` / `{{key}}` substitution; `plan-task-ui.ts` and `next-inline-ui.ts` read `ReplaceKey` from the DB row. |
| 9, 10  | v4.74.0 | `ui/configured-chip-values.ts` resolves numeric chip values from the DB; both chip renderers refresh async. Prompt Library modal grew a Token input + live preview badge. |
| 11, 12 | v4.74.0 | `upsertPrompt` accepts `previousReplaceKey`; Library modal adds `valuesInput` (comma-separated) and persists both fields with structured save telemetry. |
| 13, 14 | v4.75.0 | `prompt-cache.ts` + `prompt-io-db-bridge.ts` map new columns end-to-end so import/export no longer resets user config; seeder writes explicit `ReplaceKey='n'` + default arrays so telemetry can verify. |
| 15, 16 | v4.76.0 | Vitest lock-ins: `configured-chip-values.test.ts` (9 cases) and `prompt-io-db-bridge-replace-fields.test.ts` (4 cases). |
| 17, 18 | v4.77.0 | Vitest `prompt-db-rename.test.ts` (5 cases) + Playwright `tests/e2e/prompt-rename-regression.spec.ts` (3 cases) prove the full `upsertPrompt` -> guard -> SCHEMA-UPDATE path accepts rename, rejects drop, and rejects count-mismatched rename. |
| 19, 20 | v4.77.0 | This close-out doc + `bump-version.mjs 4.77.0` cross-repo sync (`check-version-sync.mjs` clean). |

## Verification signals

- `npx vitest run standalone-scripts/macro-controller/src/db/__tests__/prompt-db-rename.test.ts` -> 5/5.
- `npx playwright test tests/e2e/prompt-rename-regression.spec.ts` -> 3/3.
- `node scripts/check-version-sync.mjs` -> `All versions in sync: 4.77.0`.
- `node scripts/check-changelog-entry.mjs` -> matches template for v4.77.0.

## Regression guards left behind

- Drift guard: `checkTokenGuard` in `prompt-db.ts` refuses to write when `previousBody` still contains a token that the new `body` drops, unless `{oldKey, newKey}` are both supplied and their counts match.
- IO round-trip: `collectDbEntriesForExport` clones `ReplaceValues`; `commitDbEntries` forwards `previousReplaceKey`; both are covered by the Task 16 suite so a silent regression would fail CI.
- Seeder telemetry: `seedPlanNextPrompts` writes explicit columns and reports them in `RoleTelemetry`, so any accidental default-drop shows up in the boot log export.

## Follow-ups (deliberately out of scope)

- Per-project override of the Prompt Library defaults (would need a `ProjectPromptOverride` table).
- Multi-token prompts (a prompt with two independent `{{key}}` slots). Guard currently supports the single-key rename case.
