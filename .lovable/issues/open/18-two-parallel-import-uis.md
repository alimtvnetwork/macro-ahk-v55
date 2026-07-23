---
Slug: two-parallel-import-uis
Status: open
Created: 2026-07-23
---

# Two parallel drag-drop import UIs coexist in the macro-controller

## Symptom

`standalone-scripts/macro-controller/src/ui/` ships two import modals:

- `prompt-library-modal.ts` (`openPromptLibraryModal`): root-level drop zone, JSON-only, boolean `overwrite` merge strategy, ~20 dedicated tests, exercised end-to-end by v5.9.0's new drop-import E2E test.
- `prompt-import-modal.ts` (`openPromptImportModal`): six-stage state machine (`idle`->`parsing`->`preview`->`committing`->`done`->`error`), per-row `RowAction` (`add`/`overwrite`/`skip`/`rename`), zip/sqlite/json support, only 1 integration test found.

Panel wiring for the newer modal was not verified in v5.9.0.

## Action

1. `rg -n "openPromptImportModal|openPromptLibraryModal" standalone-scripts/macro-controller/src` to confirm the entry point for each.
2. Retire the one that is not user-facing OR fold its tests into the survivor.
3. If both must coexist (e.g. admin-only), document the split in `.lovable/memory/features/prompts-import-export-user-scope.md`.

## Status

open