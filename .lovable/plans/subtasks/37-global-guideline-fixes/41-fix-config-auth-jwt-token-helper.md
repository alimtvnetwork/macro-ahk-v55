# 41 – Extract isJwtToken() Helper to Fix Triple && at L599 in config-auth-handler

## Target
`src/background/handlers/config-auth-handler.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L599 | `if (typeof token === "string" && token.startsWith("eyJ") && token.split(".").length === 3)` |

Three `&&` operands chained in a single `if` condition.

## Fix

Create a named helper at the top of the file:

```ts
const JWT_SEGMENT_COUNT = 3;

function isJwtToken(token: unknown): boolean {
  return (
    typeof token === 'string' &&
    token.startsWith('eyJ') &&
    token.split('.').length === JWT_SEGMENT_COUNT
  );
}
```

Replace the violation site:

```ts
// Before
if (typeof token === "string" && token.startsWith("eyJ") && token.split(".").length === 3)

// After
if (isJwtToken(token))
```

## Instructions

1. Add the `JWT_SEGMENT_COUNT` constant and `isJwtToken` helper at the top of the file (after imports).
2. Replace the triple-`&&` condition at L599 with `if (isJwtToken(token))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isJwtToken helper replacing triple && in config-auth-handler
   ```
