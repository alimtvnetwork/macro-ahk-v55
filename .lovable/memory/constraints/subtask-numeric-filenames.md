---
name: Subtask numeric filenames
description: Plan subtask files under .lovable/plans/subtasks/**/ must use numeric-sequence names, never SS- prefix
type: constraint
---

Subtask markdown files under `.lovable/plans/subtasks/<plan-slug>/` MUST be named with a two-digit numeric sequence prefix (e.g. `01-inventory.md`, `02-propagate-workflow.md`). Do NOT use `SS-01-*.md`, `ss-*.md`, or any non-numeric prefix.

Every path reference in plan files, changelog, memory, and code comments MUST match the on-disk filename. When renaming a subtask file, immediately rewrite all string references (grep `SS-` across repo).

Enforced by `scripts/check-markdown-filenames.mjs`, which fails CI on:
- filenames starting with `ss-` or `SS-`
- any string containing `/subtasks/<plan>/SS-` (stale reference)

**Why:** Repeated CI failures caused by mixed-case `SS-NN-*.md` filenames and stale references left over after subtask files were renamed to the numeric scheme.

**How to apply:** When creating a subtask, name it `NN-short-slug.md`. When linking to it from a plan or changelog, use the same numeric name. Never introduce the `SS-` prefix.
