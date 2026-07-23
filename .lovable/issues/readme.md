# Issues

Two states only: `open/` and `closed/`. Move the file between folders when state changes; do not duplicate.

## Frontmatter

```
Slug: <kebab-case>
Status: open | closed
Created: YYYY-MM-DD
Closed: YYYY-MM-DD   # closed only
Severity: p0 | p1 | p2 | p3
Area: <subsystem>    # e.g. macro-controller, cicd, prompts
```

## Rules

- File name: `<seq>-<slug>.md` where `<seq>` is a stable integer assigned at creation.
- On close: add `Closed:` date, flip `Status`, `mv` file to `closed/` in the same turn.
- Never delete a closed issue file; it is the historical record.
- Legacy `pending-issues/` and `solved-issues/` folders are removed; do not recreate them.
