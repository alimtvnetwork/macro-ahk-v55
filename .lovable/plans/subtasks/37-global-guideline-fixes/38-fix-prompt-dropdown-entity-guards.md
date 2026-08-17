# Fixing Entity Guards in prompt-dropdown

**Target:** `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
**Rule:** Rule 3

## Violations

- **L630:** `if (!resolved)` — extract `const isResolutionFailed = !resolved;`
- **L656:** `if (!p.text)` — extract `const isTextEmpty = !p.text;`
- **L778:** `if (!cat)` — extract `const isCatMissing = !cat;`
- **L1081:** `if (!variantValue)` — extract `const isVariantValueMissing = !variantValue;`
- **L1160:** `if (!p.slug)` — extract `const isSlugMissing = !p.slug;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract entity guards in prompt-dropdown
```
