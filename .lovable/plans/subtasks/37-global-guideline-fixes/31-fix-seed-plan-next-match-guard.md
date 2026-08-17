# Replacing !match.isMatch Negation in seed-plan-next

**Target:** `standalone-scripts/macro-controller/src/seed/seed-plan-next.ts`
**Rule:** Rule 3 — No negating property access

## Violation

- **L407:** `if (!match.isMatch)` — use semantic inverse:
  ```ts
  const isMatchFailed = !match.isMatch;
  if (isMatchFailed)
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !match.isMatch with isMatchFailed in seed-plan-next
```
