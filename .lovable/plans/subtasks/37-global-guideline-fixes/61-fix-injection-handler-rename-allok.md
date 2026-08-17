# 61 – Rename !allOk to isAnyFailed in injection-handler

## Title
Rename `!allOk` to `isAnyFailed` in injection-handler

## Target File
`src/background/handlers/injection-handler.ts`

## Rule
**Rule 3 – Semantic Inverse Naming**
Negated boolean expressions used directly in `if` conditions must be extracted into a named variable whose name reflects the positive inverse semantics.

## Violations
| Location | Offending Code |
|----------|---------------|
| L702 | `if (!allOk)` |
| L726 | `if (!allOk)` |

Both occurrences use a bare negation inside a conditional instead of a semantically named inverse variable.

## Fix
At **each** of the two locations, replace the bare negation with an extracted variable:

```ts
// Before
if (!allOk) {

// After
const isAnyFailed = !allOk;
if (isAnyFailed) {
```

Apply the same transformation independently at L702 and L726 (the variable may be declared separately in each scope where `allOk` is in scope).

## Instructions
1. Open `src/background/handlers/injection-handler.ts`.
2. Locate L702: replace `if (!allOk)` with the two-line form shown above.
3. Locate L726: apply the identical replacement.
4. Run the linter: `npm run lint` (or project-equivalent). Fix any lint errors introduced.
5. Verify no runtime behaviour is changed (pure rename refactor).
6. Commit with message:
   ```
   fix(guidelines): rename !allOk to isAnyFailed in injection-handler
   ```

## Notes
- Do **not** change any other logic, variable names, or surrounding code.
- If the two occurrences share the same enclosing scope, you may declare `isAnyFailed` once before the first `if` and reuse it for the second — only if `allOk` has not been reassigned between the two points.
