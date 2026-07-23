Slug: prompts-import-export-section
Status: pending
Created: 2026-07-17

# Prompts Import/Export Section

**Slug:** prompts-import-export-section
**Status:** pending
**Created:** 2026-07-17

## Context

The prompts dropdown in the macro-controller inline UI currently supports only
runtime editing. The user wants a dedicated Import / Export section so full
prompt libraries can be shared across machines and browsers, exchanged with
teammates, and version-controlled outside the extension. Requirements will be
detailed by the user in a follow-up message. This plan captures the intent so
it is not lost; step content stays high-level until the user pins the scope.

Related existing modules:

- `standalone-scripts/macro-controller/src/ui/prompt-io.ts` (existing exporter
  helpers, respects `excludeFromExport` flag from ambiguity note 64)
- `standalone-scripts/macro-controller/src/ui/prompt-io-dialog.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-manager.ts`
- `schemas/prompts-bundle.schema.json` (JSON schema for round-trip bundles)

## Steps (draft, awaiting user detail)

1. Confirm scope with the user: dropdown-only, options-page-only, or both.
2. Design the section layout inside the prompts dropdown (Import row, Export
   row, and a small preview of the last bundle).
3. Wire the Export button to `prompt-io.ts` and offer JSON download plus a
   copy-to-clipboard fallback.
4. Wire the Import button to a file picker + drop zone, validate against
   `prompts-bundle.schema.json`, and merge with conflict resolution
   (replace vs. skip vs. rename).
5. Persist last-imported metadata (source filename, entry count, timestamp)
   in the prompts config so the UI can surface it.
6. Add a per-prompt "exclude from export" checkbox that flips the
   `excludeFromExport` flag (already supported in the type per ambiguity 64).
7. Ship tests: unit for the merger, one E2E that round-trips a bundle.

## Verification

- Import a known-good bundle, confirm entry count matches.
- Export, delete a prompt, re-import, confirm restoration.
- Toggle `excludeFromExport` on one entry, export, confirm it is absent.

## Evidence

- Before: pending (no import/export surface in the dropdown).
- After: pending until execution.
- Proof: pending.
