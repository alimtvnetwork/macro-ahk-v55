---
name: Plan Mode convention
description: Where Plan Mode writes plans, subtasks, and the index; completion flow
type: preference
---

Plan Mode (any `plan N` / plan-authoring invocation) MUST:

1. Write the plan file to `.lovable/plans/pending/NN-slug.md` (numeric prefix, kebab-case slug, lowercase). Never write plans to the project root, `.lovable/plans/` root, or ad-hoc folders.
2. Write subtasks to `.lovable/plans/subtasks/NN-slug/01-*.md`, `02-*.md`, ... (same `NN-slug` as the parent, sequence-first lowercase kebab-case). Never use `ss-` or `SS-` prefixes.
3. Add or update an entry in `.lovable/plans/index.md` for every plan. Columns: `#`, `Plan`, `Subtasks`, `Status` (`pending` / `in-progress` / `completed`), `Updated`. Link the plan file and the subtasks folder relatively.
4. On completion: move `pending/NN-slug.md` to `.lovable/plans/completed/NN-slug.md` and flip the index status to `completed`. Subtasks folder stays in place (link updated if needed).

Never skip the index update. Never leave orphan subtask folders without a parent plan file.
