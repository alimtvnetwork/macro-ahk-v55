---
Slug: use-step-library-refactor
Status: pending
Created: 2026-07-20
Parent: 31-lint-cleanup-ctx-denylist-and-15-line-cap
---

# SS-03 `use-step-library.ts` refactor

Target: `src/hooks/use-step-library.ts` (`useStepLibrary` 278L, inner arrow 70L, `seedExampleData` 44L).

## Extraction plan

Create `src/hooks/step-library/` and split by concern:

- `use-step-library-load.ts` — `loadStepLibrary()` and cache hydration
- `use-step-library-mutations.ts` — create/update/delete step group actions
- `use-step-library-seed.ts` — `seedExampleData()` split into `buildSeedRows()` + `insertSeedRows()`
- `use-step-library-selection.ts` — active-group state and selection reducer
- `use-step-library-import-export.ts` — bundle round-trip helpers

`useStepLibrary` becomes an orchestrator hook (<=15 body lines) that composes the sub-hooks. Every extracted function stays under 15 body lines.

## Contract preservation

- Public export signature unchanged.
- All returned callbacks memoized identically (React refs stable).
- `DiagnosticError` + `correlationId` propagation preserved on every failure branch.

## Tests

- `src/hooks/step-library/__tests__/*.test.ts` per sub-module.
- Component-level regression: `src/options/sections/__tests__/StepGroupLibraryPanel.regression.test.tsx` exercises load/seed/import through the composed hook.
