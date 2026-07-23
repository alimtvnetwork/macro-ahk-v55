---
name: Prompts import/export scoped to user-added
description: Import/export bundles include only isDefault=false rows; existing defaults are protected on import; defensive isDefault=false on every incoming entry
type: feature
---

# Prompts import/export: user-added scope (v4.400.0)

## Rule
All prompt import/export pipelines (JSON, ZIP, SQLite) operate on
user-added prompts only. A row is "user-added" when `isDefault !== true`
(cache entry) or `IsDefault !== 1` (DB row).

## Export
- `exportPromptsToJson` in `src/ui/prompt-io.ts` calls
  `filterUserAddedEntries()` right after `collectAllExportEntries()`. If the
  resulting set is empty, it shows the toast `Only default prompts exist,
  nothing to export` and skips the download.
- ZIP and SQLite paths in `src/ui/prompt-dropdown-io.ts` go through the same
  `filterUserAddedEntries()` helper via `readUserAddedEntries()`. All three
  format toasts report `Exported N user prompts (D defaults skipped)`.

## Import
- `validatePromptEntryDetailed` forces `isDefault: false` on every incoming
  entry so a crafted bundle cannot re-mark a slug as default.
- `mergePrompts` (JSON-cache path) short-circuits when the existing target
  has `isDefault === true`, incrementing `PromptImportResults.defaultsProtected`.
- `prompt-io-db-bridge.commitOneEntry` refuses to upsert when the existing
  DB row has `IsDefault = 1`, returning `default-protected`; the count is
  aggregated in `DbCommitResults.defaultsProtected` and propagated back onto
  `PromptImportResults.defaultsProtected`.

## Rationale
Default prompts are managed exclusively by the re-seed pipeline
(`seed/seed-plan-next.ts` + `reseed-command.ts`). Allowing import to touch
them would let a stale bundle overwrite the freshly-seeded canonical body,
breaking the `{{n}}` substitution + validator guards documented in
`mem://features/prompts-authoring-and-release`.

## Tests
- `src/ui/__tests__/prompt-io-export-user-only.test.ts`
- `src/ui/__tests__/prompt-io-import-protect-defaults.test.ts`
- `src/ui/__tests__/prompt-io-export-round-trip-user-only.test.ts`

## Non-goals
- Not a schema change (`IsDefault` column already exists).
- Does not alter the re-seed pipeline or `upsertPrompt`'s hard-coded
  `IsDefault=0` on insert.
