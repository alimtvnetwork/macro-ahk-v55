# 44 – Extract isValidJwtAccessToken() Helper in token-seeder

## Target
`src/background/handlers/token-seeder.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L259 | `if (session?.access_token && typeof session.access_token === "string" && session.access_token.startsWith("eyJ"))` |

Three `&&` operands chained in a single `if` condition (optional chaining, type check, and prefix check).

## Fix

Create a helper that accepts the entire session object so callers don't need to reach into it:

```ts
function isValidJwtAccessToken(session: unknown): boolean {
  if (session === null || typeof session !== 'object') return false;
  const token = (session as Record<string, unknown>).access_token;
  return typeof token === 'string' && token.startsWith('eyJ');
}
```

Replace the violation site:

```ts
// Before
if (
  session?.access_token &&
  typeof session.access_token === "string" &&
  session.access_token.startsWith("eyJ")
)

// After
if (isValidJwtAccessToken(session))
```

## Instructions

1. Add the `isValidJwtAccessToken` helper after the import block in `token-seeder.ts` (alongside `isJwtSessionValue` from subtask 43).
2. Replace the triple-`&&` condition at L259 with `if (isValidJwtAccessToken(session))`.
3. Run lint and confirm zero new errors.
4. Commit:
   ```
   fix(guidelines): extract isValidJwtAccessToken helper in token-seeder
   ```
