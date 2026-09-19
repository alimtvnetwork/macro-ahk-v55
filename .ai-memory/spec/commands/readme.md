# Commands

Capture files for standing user commands the AI must honor across sessions. Each file is normative: violating it is a regression.

## Frontmatter

```
Slug: <kebab-case>
Status: active | superseded
Created: YYYY-MM-DD
Superseded-By: <slug>   # superseded only
```

## Rules

- File name: `<seq>-<slug>.md`; sequence is stable and never reused.
- One command per file. If a command evolves, mark the old file `superseded` and add a new file; do not rewrite history.
- The AI must read every `active` file here before starting substantive work; treat them as project-scoped hard rules on par with `.lovable/rules.md`.
- Do not delete superseded files; they document intent drift.
