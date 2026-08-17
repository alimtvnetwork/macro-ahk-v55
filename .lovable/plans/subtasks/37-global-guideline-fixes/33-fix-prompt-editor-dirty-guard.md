# Replacing !isClean with isDirty in prompt-editor

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-editor.ts`
**Rule:** Rule 3 — Use positive semantic inverse

## Violation

- **L382:** `if (!isClean)` — use:
  ```ts
  const isDirty = !isClean;
  if (isDirty)
  ```

## Instructions

Apply fix, run lint, commit:

```
fix(guidelines): replace !isClean with isDirty in prompt-editor
```
