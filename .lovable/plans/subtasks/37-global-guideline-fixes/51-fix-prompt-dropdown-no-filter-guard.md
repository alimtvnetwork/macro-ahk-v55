# 51 – Extract isNoFilterActive() in prompt-dropdown

## Target
`standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition.

## Violation

| Location | Code |
|----------|------|
| L402 | `if (!getPromptCategoryFilter() && !_currentSearchQuery)` |

Double negation compound (already flagged in subtask 37); this subtask creates the canonical shared function.

## Fix

Create a named function near the other filter helpers in the file:

```ts
function isNoFilterActive(): boolean {
  return !getPromptCategoryFilter() && !_currentSearchQuery;
}
```

Replace the violation site:

```ts
// Before
if (!getPromptCategoryFilter() && !_currentSearchQuery)

// After
if (isNoFilterActive())
```

> **Scope note:** If `_currentSearchQuery` is module-level state, `isNoFilterActive()` can reference it directly as a closure. If this function is needed in multiple places, confirm with the team whether it should live in a shared filter-utilities module.

## Instructions

1. Locate L402 in `prompt-dropdown.ts`.
2. Add the `isNoFilterActive` function near other filter-related helpers.
3. Replace the double-negation condition at L402 with `if (isNoFilterActive())`.
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isNoFilterActive function in prompt-dropdown
   ```
