# Replacing !row.isDefault Negation in seed-plan-next

**Target:** `standalone-scripts/macro-controller/src/seed/seed-plan-next.ts`
**Rule:** Rule 3 — No negating property access

## Violation

- **L264:** `if (!row.isDefault)` — use semantic inverse:
  ```ts
  const isRowAlternate = !row.isDefault;
  if (isRowAlternate)
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !row.isDefault with isRowAlternate in seed-plan-next
```
