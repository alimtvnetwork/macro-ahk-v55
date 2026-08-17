# Fixing isEntriesEmpty and isHeaderMissing Guards in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3

## Violations

- **L349:** `if (!entries.length)` — extract `const isEntriesEmpty = !entries.length;`
- **L536:** `if (!header)` — extract `const isHeaderMissing = !header;`
- **L942:** `if (!prompt)` — extract `const isPromptMissing = !prompt;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract entry/header guards in prompt-dropdown
```
