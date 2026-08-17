# Fixing Compound Negation Guards in prompt-handler

**Target:** `src/background/handlers/prompt-handler.ts`
**Rule:** Rule 3

## Violations

- **L322:** `if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0)` — extract:
  ```ts
  const isLegacyPromptsAbsent = !Array.isArray(legacyPrompts) || legacyPrompts.length === 0;
  ```
- **L498:** `if (!name || !text)` — extract `const isNameOrTextMissing = !name || !text;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract compound negation guards in prompt-handler
```
