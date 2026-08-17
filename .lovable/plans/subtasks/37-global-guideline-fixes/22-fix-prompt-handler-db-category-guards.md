# Fixing DB/Category Guards in prompt-handler

**Target:** `src/background/handlers/prompt-handler.ts`
**Rule:** Rule 3

## Violations

- **L64:** `if (!dbManager)` — extract `const isDbManagerMissing = !dbManager;`
- **L163:** `if (!trimmed)` — extract `const isTrimmedEmpty = !trimmed;`
- **L197:** `if (!categoryId)` — extract `const isCategoryIdMissing = !categoryId;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract db/category guards in prompt-handler
```
