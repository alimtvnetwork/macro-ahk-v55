# 13 – Fixing Mixed Polarity Condition at L182 in injection-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-handler.ts` |
| **Rule violated** | Rule 3 – Never mix positive `isX` and `!isY` in the same condition |
| **Commit message** | `fix(guidelines): extract isCacheStale mixed-polarity in injection-handler` |

---

## Violation

| Line | Current code | Problem |
|---|---|---|
| L182 | `if (cachedPayload && !cacheMatchesRequest)` | Mixed polarity — truthy positive `&&` negated term |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-handler.ts` and locate L182.
2. Immediately before the condition, extract:
   ```ts
   const isCacheStale = cachedPayload !== null && !cacheMatchesRequest;
   if (isCacheStale) {
   ```
   > **Note:** Use `cachedPayload !== null` (strict equality) rather than the implicit truthy `cachedPayload` to make the intent explicit, unless the original code relied on a broader falsy check (e.g., also catching `undefined`). In that case use `cachedPayload != null` (loose inequality) or the appropriate truthiness check that matches the original semantics.
3. Remove the original `if (cachedPayload && !cacheMatchesRequest)` line.
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract isCacheStale mixed-polarity in injection-handler
   ```

---

## Expected Result

```ts
// Before (L182)
if (cachedPayload && !cacheMatchesRequest) {
  // invalidate cache
}

// After
const isCacheStale = cachedPayload !== null && !cacheMatchesRequest;
if (isCacheStale) {
  // invalidate cache
}
```
