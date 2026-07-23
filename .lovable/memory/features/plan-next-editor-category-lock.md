---
name: Plan/Next chip editor locks category to role
description: When editing a role-scoped (plan or next) prompt, the Category combo must default to the role name and be disabled. The role IS the category; free-form category on role-scoped prompts is drift.
type: feature
---
**Contract.** `openPromptCreationModal` in `standalone-scripts/macro-controller/src/ui/prompt-injection.ts` MUST, when `options.role === 'plan' || 'next'`:

1. Force `initialData.category = options.role` before building the body.
2. Set `initialData.__lockedCategory = options.role` so `_buildCategorySelect` disables the `<select>` + custom input and relabels to "Category (locked to <role>)".
3. Ensure the role name exists as a real `<option>` even when no other entry has surfaced it (inject before the custom-category sentinel).

**Why.** Role-scoped saves flow through `saveRoleScopedPrompt` -> `upsertPrompt` which persists by `role`, not `category`. If the picker showed "— No category —" or drifted to a different value, users would assume it was persisted and lose trust. Locking the picker enforces governance and matches the "category = role" invariant already used by the Prompt Library filter chips.

**Guarded by.** UI logic in `prompt-injection.ts` (`__lockedCategory` branch). Do not remove without updating this memory and the accompanying regression test.
