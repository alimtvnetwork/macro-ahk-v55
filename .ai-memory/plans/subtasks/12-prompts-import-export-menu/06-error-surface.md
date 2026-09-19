# SS-06: Error surface for import failures

Parent: 12-prompts-import-export-menu
Slug: error-surface
Status: pending
Created: 2026-07-17

## Requirements

Follow the project's error-manage rules: no swallowed errors, exact path
context, use `Logger.error()`.

## Panel content

- Red banner: short summary (e.g. "JSON validation failed", "ZIP missing
  manifest.json", "SQLite table Prompts is missing column BodyMarkdown").
- Details block: full JSON error list, one line per issue, with jsonPath.
- Copy-to-clipboard button copies the whole panel as Markdown.
- Retry link resets to stage 1 (idle drop zone) without closing the modal.

## Failure classes

1. Read error: file could not be read (permissions, empty, corrupt).
2. Format detect error: magic bytes not recognized.
3. Schema error: JSON/ZIP manifest fails schema validation.
4. Content error: SQLite tables/columns wrong.
5. Commit error: write to `prompt-manager` failed for one or more entries.

Each class maps to a distinct log tag so filtering by tag in the session
log bundle is easy.
