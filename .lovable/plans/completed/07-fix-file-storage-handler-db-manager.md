# 07 – Fixing isDbManagerMissing Guard in file-storage-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/file-storage-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract isDbManagerMissing in file-storage-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L45 | `if (!dbManager)` | `isDbManagerMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/file-storage-handler.ts` and locate L45.
2. Immediately before the `if (!dbManager)` check, extract:
   ```ts
   const isDbManagerMissing = !dbManager;
   if (isDbManagerMissing) {
   ```
3. Run `pnpm run lint` and fix any reported lint errors before committing.
4. Commit with message:
   ```
   fix(guidelines): extract isDbManagerMissing in file-storage-handler
   ```

---

## Expected Result

```ts
// Before (L45)
if (!dbManager) { ... }

// After
const isDbManagerMissing = !dbManager;
if (isDbManagerMissing) { ... }
```
