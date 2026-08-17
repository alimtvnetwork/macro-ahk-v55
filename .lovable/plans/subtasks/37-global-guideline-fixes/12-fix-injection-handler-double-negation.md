# 12 – Fixing Double Negation Compound at L164 in injection-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-handler.ts` |
| **Rule violated** | Rule 3 – Never mix `&&` and `!` in the same condition |
| **Commit message** | `fix(guidelines): extract isCacheEligible compound in injection-handler` |

---

## Violation

| Line | Current code | Problem |
|---|---|---|
| L164 | `if (!isForceRun && !hasInlineSyntaxError)` | Double negation compound — two `!` operands joined by `&&` |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-handler.ts` and locate L164.
2. Immediately before the condition, extract:
   ```ts
   const isCacheEligible = !isForceRun && !hasInlineSyntaxError;
   if (isCacheEligible) {
   ```
3. Remove the original `if (!isForceRun && !hasInlineSyntaxError)` line.
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract isCacheEligible compound in injection-handler
   ```

---

## Expected Result

```ts
// Before (L164)
if (!isForceRun && !hasInlineSyntaxError) {
  // use cache
}

// After
const isCacheEligible = !isForceRun && !hasInlineSyntaxError;
if (isCacheEligible) {
  // use cache
}
```
