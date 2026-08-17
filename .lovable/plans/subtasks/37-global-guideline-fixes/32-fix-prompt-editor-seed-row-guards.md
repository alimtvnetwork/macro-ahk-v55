# Fixing isSeedMissing and isRowMissing Guards in prompt-editor

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-editor.ts`
**Rule:** Rule 3

## Violations

- **L249:** `if (!seed)` — extract `const isSeedMissing = !seed;`
- **L269:** `if (!seed)` (repeated) — reuse `isSeedMissing`
- **L642:** `if (!row)` — extract `const isRowMissing = !row;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract seed/row guards in prompt-editor
```
