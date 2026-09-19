# 08 – Fixing ID Guards in file-storage-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/file-storage-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract ID boolean guards in file-storage-handler` |

---

## Violations

| Line | Current code | Extracted name | Notes |
|---|---|---|---|
| L77 | `if (!projectId)` | `isProjectIdMissing` | First occurrence |
| L81 | `if (!filename)` | `isFilenameMissing` | |
| L123 | `if (!fileId)` | `isFileIdMissing` | First occurrence |
| L162 | `if (!projectId)` | reuse `isProjectIdMissing` | Repeated check |
| L199 | `if (!fileId)` | reuse `isFileIdMissing` | Repeated check |

---

## Fix Instructions

1. **Read** `src/background/handlers/file-storage-handler.ts` and locate all five lines.
2. At L77, immediately before the first `if (!projectId)`:
   ```ts
   const isProjectIdMissing = !projectId;
   if (isProjectIdMissing) {
   ```
3. At L81, immediately before `if (!filename)`:
   ```ts
   const isFilenameMissing = !filename;
   if (isFilenameMissing) {
   ```
4. At L123, immediately before the first `if (!fileId)`:
   ```ts
   const isFileIdMissing = !fileId;
   if (isFileIdMissing) {
   ```
5. At L162, replace the repeated `if (!projectId)` with `if (isProjectIdMissing)` — the variable must already be in scope at that point. If the two occurrences are in separate functions, declare a local `isProjectIdMissing` in each function independently.
6. At L199, replace the repeated `if (!fileId)` with `if (isFileIdMissing)` — same scoping rules apply.
7. Run `pnpm run lint` and fix any reported lint errors before committing.
8. Commit with message:
   ```
   fix(guidelines): extract ID boolean guards in file-storage-handler
   ```

---

## Expected Result

```ts
// Before
if (!projectId) { ... }  // L77
if (!filename) { ... }   // L81
if (!fileId) { ... }     // L123
if (!projectId) { ... }  // L162
if (!fileId) { ... }     // L199

// After (within each function scope)
const isProjectIdMissing = !projectId;
if (isProjectIdMissing) { ... }

const isFilenameMissing = !filename;
if (isFilenameMissing) { ... }

const isFileIdMissing = !fileId;
if (isFileIdMissing) { ... }

// L162 – reuse in same scope or re-declare in different function
if (isProjectIdMissing) { ... }

// L199 – reuse in same scope or re-declare in different function
if (isFileIdMissing) { ... }
```
