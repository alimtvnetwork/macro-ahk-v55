# 18 – Fixing isDbManagerMissing Guard in library-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/library-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract isDbManagerMissing in library-handler` |

---

## Violation

| Line | Current code | Extracted name |
|---|---|---|
| L52 | `if (!dbManager)` | `isDbManagerMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/library-handler.ts` and locate L52.
2. Immediately before the `if (!dbManager)` check, extract:
   ```ts
   const isDbManagerMissing = !dbManager;
   if (isDbManagerMissing) {
   ```
3. Run `pnpm run lint` and fix any reported lint errors before committing.
4. Commit with message:
   ```
   fix(guidelines): extract isDbManagerMissing in library-handler
   ```

---

## Expected Result

```ts
// Before (L52)
if (!dbManager) { ... }

// After
const isDbManagerMissing = !dbManager;
if (isDbManagerMissing) { ... }
```
