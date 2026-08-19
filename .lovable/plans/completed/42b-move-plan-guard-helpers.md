# Task 42b: Move plan checks and object/primitive guards to dedicated utils files

Status: completed

## Instructions
1. Move the plan type checks `isFreeTierWorkspace(ws)`, `isProZeroPlan(ws)`, and `isProOnePlan(ws)` to a new file `standalone-scripts/macro-controller/src/types/workspace-plan-utils.ts`. Import them in `credit-totals.ts` and `ws-context-menu.ts`.
2. Move object/primitive guards `isPlainObject(v)`, `isNonEmptyString(value)`, `isTruthy(value)`, and `isFiniteNonNegative(n)` to a new file `standalone-scripts/macro-controller/src/utils/type-guards.ts`.
3. Update all callers to import these helpers instead of defining them inline.
4. Verify changes compile.
