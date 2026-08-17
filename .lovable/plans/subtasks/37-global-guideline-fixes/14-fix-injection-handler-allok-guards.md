# 14 – Fixing !r and !allOk Guards in injection-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract boolean guards for allOk and result in injection-handler` |

---

## Violations

| Line | Current code | Extracted name | Notes |
|---|---|---|---|
| L686 | `if (!r)` | `isResultMissing` | Vague single-char variable — clarify intent |
| L702 | `if (!allOk)` | `isAnyFailed` | First occurrence |
| L726 | `if (!allOk)` | `isAnyFailed` | Repeated — reuse same variable if in scope |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-handler.ts` and locate L686, L702, and L726.
2. At L686, immediately before `if (!r)`:
   ```ts
   const isResultMissing = !r;
   if (isResultMissing) {
   ```
3. At L702, immediately before the first `if (!allOk)`:
   ```ts
   const isAnyFailed = !allOk;
   if (isAnyFailed) {
   ```
4. At L726, replace the repeated `if (!allOk)` with `if (isAnyFailed)` if the variable is still in scope. If it is in a separate function or block scope, declare a new local:
   ```ts
   const isAnyFailed = !allOk;
   if (isAnyFailed) {
   ```
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract boolean guards for allOk and result in injection-handler
   ```

---

## Expected Result

```ts
// Before
if (!r) { ... }       // L686
if (!allOk) { ... }   // L702
if (!allOk) { ... }   // L726

// After
const isResultMissing = !r;
if (isResultMissing) { ... }

const isAnyFailed = !allOk;
if (isAnyFailed) { ... }

// L726 — reuse or re-declare based on scope
if (isAnyFailed) { ... }
```
