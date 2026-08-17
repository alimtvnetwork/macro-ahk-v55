# 04 – Fixing isResponseFailed and isListCookiesProhibited Guards in config-auth-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/config-auth-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract response and cookie guards in config-auth-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L738 | `if (!response.ok)` | `isResponseFailed` |
| L885 | `if (!canListCookies)` | `isListCookiesProhibited` |

---

## Fix Instructions

1. **Read** `src/background/handlers/config-auth-handler.ts` and locate L738 and L885.
2. At L738, immediately before the `if (!response.ok)` check, extract:
   ```ts
   const isResponseFailed = !response.ok;
   if (isResponseFailed) {
   ```
3. At L885, immediately before the `if (!canListCookies)` check, extract:
   ```ts
   const isListCookiesProhibited = !canListCookies;
   if (isListCookiesProhibited) {
   ```
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract response and cookie guards in config-auth-handler
   ```

---

## Expected Result

```ts
// Before (L738)
if (!response.ok) { ... }

// After
const isResponseFailed = !response.ok;
if (isResponseFailed) { ... }

// Before (L885)
if (!canListCookies) { ... }

// After
const isListCookiesProhibited = !canListCookies;
if (isListCookiesProhibited) { ... }
```
