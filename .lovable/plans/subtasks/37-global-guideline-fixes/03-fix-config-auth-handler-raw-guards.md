# 03 – Fixing isRawDataMissing and isUrlMissing Guards in config-auth-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/config-auth-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract isRawDataMissing isUrlMissing in config-auth-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L592 | `if (!raw)` | `isRawDataMissing` |
| L679 | `if (!url)` | `isUrlMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/config-auth-handler.ts` and locate L592 and L679.
2. At L592, immediately before the `if (!raw)` check, extract:
   ```ts
   const isRawDataMissing = !raw;
   if (isRawDataMissing) {
   ```
3. At L679, immediately before the `if (!url)` check, extract:
   ```ts
   const isUrlMissing = !url;
   if (isUrlMissing) {
   ```
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract isRawDataMissing isUrlMissing in config-auth-handler
   ```

---

## Expected Result

```ts
// Before (L592)
if (!raw) { ... }

// After
const isRawDataMissing = !raw;
if (isRawDataMissing) { ... }

// Before (L679)
if (!url) { ... }

// After
const isUrlMissing = !url;
if (isUrlMissing) { ... }
```
