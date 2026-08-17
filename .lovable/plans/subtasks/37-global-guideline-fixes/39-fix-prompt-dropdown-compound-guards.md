# Fixing Compound Guards at L1013 and L1301 in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3

## Violations

- **L1013:** `if (!n || n < 1 || n > 999)` — extract `const isRepeatCountInvalid = !n || n < 1 || n > 999;`
- **L1301:** `if (!updated.name || !updated.text)` — extract `const isPromptDataIncomplete = !updated.name || !updated.text;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract compound guards in prompt-dropdown
```
