# Fixing !confirm() Negation in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3 — No negating function calls

## Violation

- **L725:** `if (!confirm('Delete prompt...'))`

## Fix

```ts
const isDeleteConfirmed = confirm('Delete prompt "' + p.name + '"?');
const isDeleteCancelled = !isDeleteConfirmed;
if (isDeleteCancelled) {
  return;
}
```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): fix !confirm negation in prompt-dropdown
```
