# Fixing Vague !rc Guard in prompt-editor

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-editor.ts`
**Rule:** Rule 3 — Vague variable name + raw negation

## Violation

- **L201:** `if (!rc)` — extract `const isRcMissing = !rc;` (and if possible rename `rc` to a more descriptive name like `rowContext`)

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): extract isRcMissing from vague !rc guard in prompt-editor
```
