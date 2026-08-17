# 43 – Extract isJwtSessionValue() Helper to Fix Triple && at L125 in token-seeder

## Target
`src/background/handlers/token-seeder.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L125 | `if (sessionLookup.value !== null && sessionLookup.value.startsWith("eyJ") && sessionLookup.value.split(".").length === 3)` |

Three `&&` operands chained in a single `if` condition.

## Fix

Create a type-predicate helper at the top of the file:

```ts
function isJwtSessionValue(value: string | null): value is string {
  return (
    value !== null &&
    value.startsWith('eyJ') &&
    value.split('.').length === 3
  );
}
```

Replace the violation site:

```ts
// Before
if (
  sessionLookup.value !== null &&
  sessionLookup.value.startsWith("eyJ") &&
  sessionLookup.value.split(".").length === 3
)

// After
if (isJwtSessionValue(sessionLookup.value))
```

The type predicate `value is string` also narrows the type of `sessionLookup.value` inside the `if` block, eliminating any downstream null-checks.

## Instructions

1. Add the `isJwtSessionValue` helper function after the import block in `token-seeder.ts`.
2. Replace the triple-`&&` condition at L125 with `if (isJwtSessionValue(sessionLookup.value))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isJwtSessionValue helper in token-seeder
   ```
