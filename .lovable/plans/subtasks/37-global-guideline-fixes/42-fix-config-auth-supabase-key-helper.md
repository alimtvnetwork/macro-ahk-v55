# 42 – Extract isSupabaseAuthKey() Helper to Fix Triple && at L613 in config-auth-handler

## Target
`src/background/handlers/config-auth-handler.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L613 | `if (key && key.startsWith("sb-") && key.includes("-auth-token"))` |

Three `&&` operands chained in a single `if` condition.

## Fix

Create a named helper near the other key-check helpers in the file:

```ts
function isSupabaseAuthKey(key: unknown): boolean {
  return (
    typeof key === 'string' &&
    key.startsWith('sb-') &&
    key.includes('-auth-token')
  );
}
```

Replace the violation site:

```ts
// Before
if (key && key.startsWith("sb-") && key.includes("-auth-token"))

// After
if (isSupabaseAuthKey(key))
```

> **Note:** The original condition uses a truthy check (`key &&`). The helper strengthens this to a proper type guard (`typeof key === 'string'`) which is safer and satisfies Rule 3.

## Instructions

1. Add the `isSupabaseAuthKey` helper function at the top of the file (after imports, alongside `isJwtToken` from subtask 41).
2. Replace the triple-`&&` condition at L613 with `if (isSupabaseAuthKey(key))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isSupabaseAuthKey helper in config-auth-handler
   ```
