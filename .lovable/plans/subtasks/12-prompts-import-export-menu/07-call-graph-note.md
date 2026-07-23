# Step 1 note: call-graph audit (Export / Import / IO / Load)

Parent: 12-prompts-import-export-menu
Status: complete
Created: 2026-07-17

## Files read

- `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-io.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-io-dialog.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-manager.ts` (barrel)
- `standalone-scripts/macro-controller/src/ui/prompt-cache.ts`
- `standalone-scripts/macro-controller/src/types/ui-types.ts` (PromptEntry L47-70)
- `schemas/prompts-bundle.schema.json`

## Header wire-up (prompt-dropdown.ts L235-252)

`buildDropdownHeader()` mounts a sticky header with four right-side pills:

1. `buildExportButton()` L313, `_buildHeaderPill('📤 Export', ...)` → dynamic
   `import('./prompt-io').exportPromptsToJson()`. Toast on success/failure.
2. `buildImportButton()` L327, opens a hidden `<input type=file accept=".json">`,
   reads via FileReader, then `_runPromptImport()` L349 →
   `import('./prompt-io').performPromptImport(parsed.valid, {overwrite:true})`.
3. `buildIOButton()` L286, opens `renderPromptIODialog()` from
   `./prompt-io-dialog` (existing modal with textarea + destructive Clear).
4. `buildLoadButton()` L372 → `handleLoadClick()` refreshes cache.

Every handler exists. `onclick` is assigned directly (not a delegated
listener), so a missing bubble path is not possible. The buttons are
`<span>` elements with `cursor:pointer` — pointer events default on.

## Runtime `PromptEntry` (ui-types.ts L47-70)

Fields carried: `name`, `text`, `id?`, `slug?`, `category?`, `isFavorite?`,
`isDefault?`, `tags?`, `excludeFromExport?`, plus dynamic-expansion fields
`isDynamic?`, `replaceKey?`, `replaceValues?`, `slugTemplate?`, and bridge
fields `parentTitle?`, `parentSlug?`, `variantValue?`.

## Current JSON export shape (prompt-io.ts L15-51)

`exportPromptsToJson()` writes `JSON.stringify(exportable, null, 2)` where
`exportable = record.entries.filter(!excludeFromExport)`. **Plain array,
no envelope.** Filename `prompts-export-YYYY-MM-DD.json`.

## Current JSON import shape (prompt-io.ts L54-166)

`parsePromptsText()` accepts either an array OR a single object (wraps to
array). `validatePromptEntry()` requires `name` + `text`, keeps `slug`,
`category` (default `'General'`), `isFavorite`, `isDefault`, `order`,
`version`, `excludeFromExport`. **Drops `tags`, `id`, `isDynamic`,
`replaceKey`, `replaceValues`, `slugTemplate`, `parentTitle`,
`parentSlug`, `variantValue`** — round-trip is lossy for dynamic prompts.

## Schema gap (schemas/prompts-bundle.schema.json)

Existing file targets **build-time bundles** produced by
`aggregate-prompts.mjs` (PascalCase keys: `Version`, `BuildHash`,
`GeneratedAt`, `Source`, `Count`, `Prompts[]`). It is NOT a user
export/import envelope. Plan 12 needs a **new** schema file, e.g.
`schemas/prompts-export-bundle.schema.json`, using camelCase
`{ id, schemaVersion, exportedAt, exporterVersion, entryCount,
  entries[] }`.

## Findings that steer Steps 3–8

- Reuse the current handler names when refactoring so the header wiring
  in `prompt-dropdown.ts` L246-249 does not need to change.
- The import validator must be widened to preserve `tags`, `id`, and the
  dynamic-expansion fields, or `Next ${N}` / `Plan ${N}` prompts lose
  their variants on round-trip.
- A separate export-bundle schema keeps the build-time
  `PromptsBundle` schema unchanged (that one is consumed by CI).

## What could look "inert" (issue 03)

Static reading shows every button has an `onclick`. If the user still
sees no reaction, the likely causes are (a) the deployed extension zip
predates this wiring — plan 12 Step 2 will confirm by exercising the
current build, and (b) the pill span sits inside the dropdown scroll
container; a stale build could have wrapped it under a `pointer-events:
none` overlay. To confirm we need the injected UI, which only mounts
inside Lovable app tabs — see notes-02.
