# SS-01 Target layout for .lovable/

Slug: target-layout
Parent: 18-lovable-folder-consolidation
Status: pending
Created: 2026-07-17

## Target tree

```
.lovable/
  README.md          # entry index (what the AI reads first)
  MAP.md             # 1-line-per-path machine-friendly map
  rules.md           # consolidated strictly-avoid + hard rules
  plans/
    README.md
    pending/
    completed/
    subtasks/
  issues/
    README.md
    open/
    closed/
  spec/
    commands/
    checklists/
    templates/
    docs/
    ...existing numbered spec folders...
  memory/
    core.md
    refs/
    suggestions/
  audits/
    YYYY-MM-DD-*.md
  cicd/
    README.md
    profile.md
    issues/
  prompts/
    pasted/
    mirrors/       # canonical only, per user memory
  archive/
    YYYY-MM-DD/    # anything removed lives here for 1 turn before deletion
```

## Rules

- No loose `.md` at `.lovable/` root except README/MAP/rules.
- No duplicate content across folders: one file, one home, link from indexes.
- Every folder has a `README.md` (<=40 lines) describing purpose + lifecycle.
- Numeric prefixes stay 2-digit zero-padded (matches existing `XX-slug.md`).
- Frontmatter shape unified across plans/issues/commands (see SS-02).
