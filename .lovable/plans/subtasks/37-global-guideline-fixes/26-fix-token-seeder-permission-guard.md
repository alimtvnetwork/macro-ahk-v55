# Fixing Permission Denial Guard in token-seeder

**Target:** `src/background/handlers/token-seeder.ts`
**Rule:** Rule 3

## Violation

- **L308:** `if (!hasPermission)` — extract `const isPermissionDenied = !hasPermission;`

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !hasPermission with isPermissionDenied in token-seeder
```
