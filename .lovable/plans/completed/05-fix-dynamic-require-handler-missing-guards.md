# 05 – Fixing isRequesterMissing and isResolutionFailed Guards in dynamic-require-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/dynamic-require-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract missing-value guards in dynamic-require-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L67 | `if (!requester)` | `isRequesterMissing` |
| L85 | `if (!resolved)` | `isResolutionFailed` |
| L106 | `if (!code)` | `isCodeMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/dynamic-require-handler.ts` and locate L67, L85, and L106.
2. At L67, immediately before the `if (!requester)` check, extract:
   ```ts
   const isRequesterMissing = !requester;
   if (isRequesterMissing) {
   ```
3. At L85, immediately before the `if (!resolved)` check, extract:
   ```ts
   const isResolutionFailed = !resolved;
   if (isResolutionFailed) {
   ```
4. At L106, immediately before the `if (!code)` check, extract:
   ```ts
   const isCodeMissing = !code;
   if (isCodeMissing) {
   ```
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract missing-value guards in dynamic-require-handler
   ```

---

## Expected Result

```ts
// Before
if (!requester) { ... }  // L67
if (!resolved) { ... }   // L85
if (!code) { ... }       // L106

// After
const isRequesterMissing = !requester;
if (isRequesterMissing) { ... }

const isResolutionFailed = !resolved;
if (isResolutionFailed) { ... }

const isCodeMissing = !code;
if (isCodeMissing) { ... }
```
