# Issue 03: Prompts menu Import / Export / IO / Load buttons are inert

Status: closed (resolved in v4.47.0 via plan 12)
Created: 2026-07-17
Reported by: user (voice + screenshot)

## Symptom

In the prompts dropdown header (screenshot: file-9), the row of buttons
`Export`, `Import`, `IO`, `Load` renders correctly but clicking Import or
Export does nothing. No dialog, no toast, no console error visible.

## Repro

1. Open Lovable chat page with Marco extension mounted.
2. Click the "Prompt" chip to open the prompts dropdown.
3. Click `Import` or `Export` in the header row.
4. Nothing happens.

## Expected

- Export: opens a small popover with 3 choices (JSON file, ZIP bundle,
  SQLite DB) and downloads the selected format.
- Import: opens a modal that accepts JSON, ZIP, or SQLite DB files
  (file picker + drag/drop), validates, previews entries, then merges.

## Files likely involved

- `standalone-scripts/macro-controller/src/ui/prompt-io.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-io-dialog.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-manager.ts`
- `schemas/prompts-bundle.schema.json`

## Related plan

`.lovable/plans/pending/12-prompts-import-export-menu.md` (30-step plan).
Supersedes the earlier stub `.lovable/plans/pending/11-prompts-import-export-section.md`.
