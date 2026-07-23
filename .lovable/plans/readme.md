# Plans

Lifecycle: `pending/NN-*.md` -> `completed/NN-*.md`. Numbering is a stable zero-padded integer (`NN`) assigned at creation and never reused. Subtasks live under `subtasks/NN-<slug>/XX-<subslug>.md`, where `XX` is the sequence-first subtask number.

## Frontmatter (all plan files)

```
Slug: <kebab-case>
Steps: <int>
Status: pending | completed
Created: YYYY-MM-DD
Parent: <plan-slug>   # subtasks only
```

## Rules

- One plan per numeric prefix. Do not renumber after creation.
- On completion: flip `Status: completed` and `mv` the file from `pending/` to `completed/` in the same turn as the final step.
- Loose plan files at `.lovable/` root are forbidden; they must live under `plans/pending/` or `plans/completed/`.
- `index.md` is the human-readable roll-up; keep it terse.
