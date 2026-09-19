# 02 – Fixing isAuthTokenMissing Guard in config-auth-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/config-auth-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract isAuthTokenMissing guard in config-auth-handler` |

---

## Violations

| Line | Current code | Problem |
|---|---|---|
| L372 | `if (!authToken)` | Raw `!` in condition |
| L377 | `if (!authToken)` | Same raw negation repeated |
| L382 | `if (!authToken)` | Same raw negation repeated |

---

## Fix Instructions

1. **Read** `src/background/handlers/config-auth-handler.ts` and locate the block containing L372, L377, and L382.
2. **Before** the first `if (!authToken)` check, extract the boolean:
   ```ts
   const isAuthTokenMissing = !authToken;
   ```
3. **Replace** every occurrence of `if (!authToken)` in that block with:
   ```ts
   if (isAuthTokenMissing)
   ```
4. Ensure the extraction is placed once, at the earliest point before the three checks, in a scope that covers all three call sites.
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract isAuthTokenMissing guard in config-auth-handler
   ```

---

## Expected Result

```ts
// Before
if (!authToken) { ... }   // L372
if (!authToken) { ... }   // L377
if (!authToken) { ... }   // L382

// After
const isAuthTokenMissing = !authToken;
if (isAuthTokenMissing) { ... }
if (isAuthTokenMissing) { ... }
if (isAuthTokenMissing) { ... }
```
