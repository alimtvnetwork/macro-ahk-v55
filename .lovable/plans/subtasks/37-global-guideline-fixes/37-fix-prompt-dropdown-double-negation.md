# Fixing Double Negation at L402 in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3 — No double negation compound

## Violation

- **L402:** `if (!getPromptCategoryFilter() && !_currentSearchQuery)` — extract:
  ```ts
  const hasNoFilterActive = !getPromptCategoryFilter() && !_currentSearchQuery;
  if (hasNoFilterActive) {
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): extract hasNoFilterActive guard in prompt-dropdown
```
