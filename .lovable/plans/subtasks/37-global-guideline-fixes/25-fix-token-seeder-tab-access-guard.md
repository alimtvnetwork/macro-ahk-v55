# Fixing Tab Access Denial Guard in token-seeder

**Target:** `src/background/handlers/token-seeder.ts`
**Rule:** Rule 3

## Violation

- **L106:** `if (!hasTabAccess)` — replace with positive semantic inverse:
  ```ts
  const isTabAccessDenied = !hasTabAccess;
  if (isTabAccessDenied)
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !hasTabAccess with isTabAccessDenied in token-seeder
```
