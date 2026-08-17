# Fixing !Number.isFinite() Guards in prompt-handler

**Target:** `src/background/handlers/prompt-handler.ts`
**Rule:** Rule 3 — No negating method calls

## Violations

- **L706:** `if (!Number.isFinite(numId))` — extract `const isNumIdInvalid = !Number.isFinite(numId);`
- **L766:** `if (!Number.isFinite(numId))` (repeated) — extract same at function scope

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract isNumIdInvalid guard in prompt-handler
```
