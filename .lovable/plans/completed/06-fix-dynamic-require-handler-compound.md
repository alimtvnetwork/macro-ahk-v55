# 06 – Fixing Compound Negation Guards in dynamic-require-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/dynamic-require-handler.ts` |
| **Rule violated** | Rule 3 – No compound conditions with more than 2 `&&`; no raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): fix compound negations in dynamic-require-handler` |

---

## Violations

| Line | Current code | Problem |
|---|---|---|
| L57 | `if (!target \|\| !requesterProjectId \|\| !tabId)` | Compound multi-negation with 3 operands |
| L74 | `if (!requester.settings?.allowDynamicRequests)` | Raw `!` negating an optional-chain property access |

---

## Fix Instructions

1. **Read** `src/background/handlers/dynamic-require-handler.ts` and locate L57 and L74.
2. At L57, immediately before the condition, extract:
   ```ts
   const isCallerContextMissing = !target || !requesterProjectId || !tabId;
   if (isCallerContextMissing) {
   ```
3. At L74, immediately before the condition, extract:
   ```ts
   const isDynamicRequestsDisabled = !requester.settings?.allowDynamicRequests;
   if (isDynamicRequestsDisabled) {
   ```
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): fix compound negations in dynamic-require-handler
   ```

---

## Expected Result

```ts
// Before (L57)
if (!target || !requesterProjectId || !tabId) { ... }

// After
const isCallerContextMissing = !target || !requesterProjectId || !tabId;
if (isCallerContextMissing) { ... }

// Before (L74)
if (!requester.settings?.allowDynamicRequests) { ... }

// After
const isDynamicRequestsDisabled = !requester.settings?.allowDynamicRequests;
if (isDynamicRequestsDisabled) { ... }
```
