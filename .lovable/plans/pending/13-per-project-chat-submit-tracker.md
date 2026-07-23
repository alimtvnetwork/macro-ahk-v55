Slug: per-project-chat-submit-tracker
Status: pending
Created: 2026-07-17

# Plan 13: Per-Project Chat-Submit Tracker (OPFS-backed, 300-cap rolling)

**Slug:** per-project-chat-submit-tracker
**Status:** pending
**Created:** 2026-07-17
**Version target:** v4.49.0 (foundation) -> v4.50.x-v4.55.x (stepwise delivery)

## Context

User wants every chat-box submission on lovable.dev to be captured per
project (extracted from `/projects/<uuid>/` URL), stored on disk (OPFS) so
the SQLite bundle stays lean, and rotated at a per-project cap of 300
entries (customizable). Sources include the main chat textarea, Repeat
Loop submissions, the Next chip, and the Plan chip.

Answered ambiguities (see chat 2026-07-17):
- **File store:** OPFS (origin private file system).
- **Retention:** 300 entries per project, customizable, rolling.
- **Rename policy:** backfill old rows when the project name changes.
- **Verbose gate:** respect existing `verboseLogging` toggle for full text;
  metadata row (id, project, source, timestamp, char count) always written.
- **Char limit:** up to 8000-10000 chars per entry.
- **Guide download format:** .md (single file); import accepts .md, .json,
  .db/.sqlite, .zip.

## Steps (10)

1. **LLM authoring guide (v4.49.0, this turn).** Ship `docs/prompts/llm-
   authoring-guide.md` plus inline bundle in `prompt-llm-guide-download.ts`
   with a "📘 LLM Guide" button in the Prompts IO dialog. Wire the file
   input `accept` list to `.md,.json,.db,.sqlite,.zip`.
2. **UI polish for merged Plan+Next in prompts dropdown.** Tighten
   spacing, chip alignment, hover states. Behavior unchanged.
3. **OPFS store module** `standalone-scripts/macro-controller/src/storage/
   chat-submit-opfs-store.ts` with `saveEntry(projectId, text): fileId`,
   `readEntry(projectId, fileId): text`, `deleteEntry(projectId, fileId)`,
   `listProject(projectId): fileId[]`. Directory layout:
   `chat-submits/<projectId>/<uuid>.txt`.
4. **SQLite table** `ProjectChatSubmit(Id, ProjectId, ProjectName,
   Source, FileId, CharCount, CreatedAt, MetaJson)` + migration.
5. **Project ID + name extractor** `standalone-scripts/macro-controller/
   src/util/project-id-from-url.ts` (regex `/\/projects\/([0-9a-f-]{36})/i`)
   with DOM fallback for name (`document.title`, `<header>` scrape).
6. **Capture hooks** in `paste-flow.ts`, `repeat-loop-ui.ts`,
   `next-inline-ui.ts`, `plan-task-ui.ts`. Each writes one row + one
   OPFS file. Full text only when `verboseLogging` is ON.
7. **Rolling-window enforcer** on every insert: if per-project row count
   > cap (default 300, `Project.ChatSubmitCap` config), delete oldest
   row AND its OPFS file atomically.
8. **Rename backfill.** When the extractor detects a name change for a
   known projectId, run `UPDATE ProjectChatSubmit SET ProjectName=? WHERE
   ProjectId=?` on the same transaction.
9. **Panel "Project history"** section: per-project row count, most
   recent 20 with source badges, open-file action (reads OPFS), export
   button (reuses plan-12 JSON exporter, wraps entries into the
   prompts-export-bundle envelope with `format:"json"` and a `Source`
   tag preserved in `MetaJson`).
10. **Tests + docs + release.** Unit tests for rotation and rename
    backfill; integration test for one submit-capture path;
    `standalone-scripts/macro-controller/readme.md` section documenting
    OPFS layout and cap tuning; changelog + release notes; version bump.

## Verification

- Submit 305 prompts on a project; count stays at 300, first 5 are gone.
- Rename project in Lovable UI; historical rows show new name.
- Toggle verbose OFF; new rows have `CharCount>0` but the referenced
  OPFS file contains a redacted placeholder or is absent (TBD in step 6).
- Delete project; OPFS directory + rows purge together.
- Round-trip exported bundle re-imports via Prompts IO dialog.

## Evidence

- Before: pending (only foundation in v4.49.0).
- After: pending until step 10 lands.
- Proof: pending.
