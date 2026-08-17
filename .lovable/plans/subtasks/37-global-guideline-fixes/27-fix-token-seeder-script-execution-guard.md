# Fixing Script Execution Block Guard in token-seeder

**Target:** `src/background/handlers/token-seeder.ts`
**Rule:** Rule 3

## Violation

- **L316:** `if (!canExecuteScript)` — extract `const isScriptExecutionBlocked = !canExecuteScript;`

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !canExecuteScript with isScriptExecutionBlocked in token-seeder
```
