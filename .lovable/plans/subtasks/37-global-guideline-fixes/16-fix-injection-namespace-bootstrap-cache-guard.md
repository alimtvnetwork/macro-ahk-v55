# 16 – Fixing Cache Set.has() Negation in injection-namespace-bootstrap

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-namespace-bootstrap.ts` |
| **Rule violated** | Rule 3 – No negating method calls inline in if-conditions |
| **Commit message** | `fix(guidelines): extract isCacheMiss guard in injection-namespace-bootstrap` |

---

## Violation

| Line | Current code | Problem |
|---|---|---|
| L91 | `if (!_llmGuideCache.has(guideKey))` | Negating a method call (`Set.has`) directly in the condition |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-namespace-bootstrap.ts` and locate L91.
2. Immediately before the `if (!_llmGuideCache.has(guideKey))` check, extract:
   ```ts
   const isCacheMiss = !_llmGuideCache.has(guideKey);
   if (isCacheMiss) {
   ```
3. Remove the original inline condition.
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract isCacheMiss guard in injection-namespace-bootstrap
   ```

---

## Expected Result

```ts
// Before (L91)
if (!_llmGuideCache.has(guideKey)) {
  // populate cache
}

// After
const isCacheMiss = !_llmGuideCache.has(guideKey);
if (isCacheMiss) {
  // populate cache
}
```
