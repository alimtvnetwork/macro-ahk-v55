## Goal

Scope the prompt library **Import** and **Export** actions to user-added prompts only (rows with `isDefault=false`). Default/seed prompts stay untouched on export and are never overwritten on import. Cover the new behavior with e2e tests.

## Current state (verified)

- `CachedPromptEntry.isDefault` already exists (`prompt-io.ts:213`, `prompt-io-db-bridge.ts:49`) and mirrors the DB `IsDefault` column (`prompt-db.ts:36`).
- `exportPromptsToJson` (`prompt-io.ts:36`) currently exports every entry returned by `collectAllExportEntries()`, honoring only `excludeFromExport`. It does not filter on `isDefault`.
- Import merge lives in `mergePrompts` (`prompt-io.ts:242`) and the commit path in `prompt-import-commit.ts`; neither currently skips defaults.
- Modal wiring is in `prompt-library-modal.ts` + `prompt-dropdown-io.ts`, exposed from `chip-gear-menu.ts`.

## Changes

1. **Export filter (`prompt-io.ts`)**
   - In `exportPromptsToJson`, after `collectAllExportEntries()`, drop entries where `isDefault === true` before the `excludeFromExport` pass.
   - Adjust the empty-state toast: `"Only default prompts exist, nothing to export"` when the filter empties the set.
   - Success toast becomes `Exported N user prompts (D defaults skipped)`.
   - Same filter applied in ZIP + SQLite exporters (`prompt-io-zip.ts`, `prompt-io-sqlite.ts`) so all three formats agree.
   - Revisions collection (`collectRevisionsForEntries`) already keys off the filtered entries, so it inherits the scope automatically.

2. **Import filter (`prompt-io.ts` + `prompt-import-commit.ts`)**
   - In `mergePrompts` / commit path, force `isDefault=false` on every imported entry (defensive: incoming bundle from an older export could still carry `isDefault=true`).
   - Skip any incoming entry whose slug matches an existing `isDefault=true` row; surface it in the import summary as `skipped: N (protected defaults)`.
   - Skipped entries recorded via existing `prompt-import-audit` channel.

3. **UI copy**
   - `prompt-library-modal.ts` and `chip-gear-menu.ts`: relabel actions to `Export user prompts` / `Import user prompts` and add a one-line helper: `Defaults are managed by re-seed and never included.`

4. **E2E tests** (`src/ui/__tests__/`)
   - `prompt-library-modal-export-user-only.e2e.test.ts`: seed a mix of default + user prompts, click Export, assert downloaded bundle contains only user rows and the summary toast reports skipped defaults.
   - `prompt-library-modal-import-protect-defaults.e2e.test.ts`: pre-seed a default `plan` prompt, import a bundle whose entry collides on that slug, assert default row unchanged, import summary reports protection skip, and non-colliding entries land as `isDefault=false`.
   - `prompt-io-export-round-trip-user-only.test.ts`: export → parse → re-import, verify defaults untouched across the round trip.

5. **Docs / memory**
   - Update `.lovable/memory/features/` with a new note `prompts-import-export-user-scope.md` capturing the filter rule and rationale, and link it from `.lovable/memory/index.md`.

## Technical notes

- Filter helper `isUserAddedEntry(e: CachedPromptEntry): boolean => e.isDefault !== true` colocated in `prompt-io.ts` so ZIP/SQLite exporters can share it.
- `mergePrompts` returns a `PromptImportResults` shape; extend with `defaultsProtected: number` (additive, backwards compatible).
- Existing tests that assumed all entries export (`prompt-io-export-empty.test.ts`, `prompt-library-modal-import-export.test.ts`, `prompt-library-modal-round-trip.test.ts`) will be updated to seed with `isDefault=false` where the assertion depends on the entry appearing in the export.
- No schema migration — the `IsDefault` column already exists.

## Out of scope

- Changing the default-prompt seed mechanism.
- Any UI beyond relabeling the two buttons + helper line.
- The still-outstanding `PROMPT_LOAD_E001` / workspace-move v2 verification (tracked separately).
