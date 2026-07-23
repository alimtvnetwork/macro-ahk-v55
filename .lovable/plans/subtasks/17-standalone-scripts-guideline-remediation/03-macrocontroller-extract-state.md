---
Slug: macrocontroller-extract-state
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-03 — Extract controller state (P0-09 cluster 1)

Root cause: `core/MacroController.ts` is imported by 18+ leaf modules because it exports both the class AND the enums/ids/state shape those leaves need. Any leaf that imports one gets the whole class + its dependency chain, forming the cycles.

## Extraction

New file: `standalone-scripts/macro-controller/src/core/controller-state.ts`. Pure value module — no class, no side effects, no imports from `ui/**` or `db/**`.

Move OUT of `MacroController.ts`:

- `enum RunPhase`
- `enum StepKind`
- `type ControllerState`
- `type RunEvent` discriminated union
- ID constants (`RUN_ID_PREFIX`, `MACRO_ROOT_ID`, etc.)
- Default-config constants

Keep IN `MacroController.ts`: the class + its methods.

## Import rewrite

Every consumer that only needed the values switches to `import { RunPhase, ... } from '../core/controller-state';`. Only the 3-4 sites that actually need the class keep importing `MacroController`.

## Verification

- `npx madge --circular --extensions ts standalone-scripts/macro-controller/src | wc -l` drops from 57 to ≤ 40.
- `regression-baseline.test.ts` "Macro run trigger" describe block passes with no assertion changes.
- `tsc --noEmit -p tsconfig.macro.build.json` green.
- No behavior change: `MacroController` class shape unchanged, event ordering unchanged.
