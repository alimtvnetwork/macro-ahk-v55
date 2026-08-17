# Fixing hasAttribute Negation Guard in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3 — No negating method calls

## Violation

- **L368:** `if (!container.hasAttribute('data-prompts-dropdown'))` — extract:
  ```ts
  const isPromptDropdownContainer = container.hasAttribute('data-prompts-dropdown');
  const isNonDropdownContainer = !isPromptDropdownContainer;
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): fix hasAttribute negation in prompt-dropdown
```
