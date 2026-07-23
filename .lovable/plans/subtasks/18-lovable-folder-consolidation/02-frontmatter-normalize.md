# SS-02 Frontmatter normalization

Slug: frontmatter-normalize
Parent: 18-lovable-folder-consolidation
Status: pending
Created: 2026-07-17

## Canonical frontmatter

Plans:
```
Slug: <slug>
Steps: <n>
Status: pending|completed
Created: YYYY-MM-DD
```

Subtasks: add `Parent: XX-<slug>`.

Issues:
```
Slug: <slug>
Status: open|closed
Created: YYYY-MM-DD
Severity: p0|p1|p2
```

Commands:
```
Slug: <slug>
Status: active|retired
Created: YYYY-MM-DD
Scope: <where it applies>
```

## Actions

1. Grep every file under `.lovable/plans/`, `.lovable/issues/`, `.lovable/spec/commands/`.
2. Add missing keys with sensible defaults (Created = file mtime date; Status inferred from folder).
3. Do NOT rewrite bodies. Frontmatter only.
4. Record any file that could not be auto-normalized in `audits/2026-07-17-frontmatter-exceptions.md`.
