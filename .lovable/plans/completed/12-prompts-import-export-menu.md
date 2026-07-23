# Prompts Import / Export menu (JSON, ZIP, SQLite)

Slug: prompts-import-export-menu
Steps: 30
Status: completed
Created: 2026-07-17

## Context

The prompts dropdown header already renders `Export`, `Import`, `IO`, `Load`
buttons (see screenshot in issue 03) but the click handlers are missing, so
nothing happens. The user wants a full round-trip:

- Export: click Export, see a small popover with three choices. Download the
  entire prompt library as (a) JSON file, (b) ZIP archive with per-prompt
  markdown/HTML plus a manifest, or (c) SQLite database (single-file
  `.sqlite`).
- Import: click Import, see a modal with a file picker and drag/drop zone
  that accepts JSON, ZIP, or SQLite. Validate, show a preview of entries,
  offer merge (skip existing, replace, rename), and commit.

Files most likely involved:

- `standalone-scripts/macro-controller/src/ui/prompt-io.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-io-dialog.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-manager.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-cache.ts`
- `schemas/prompts-bundle.schema.json`

Related commands / issues:

- `.lovable/issues/03-prompts-import-export-inert.md` (bug this plan fixes)
- `.lovable/spec/commands/01-three-strip-decoupled-flow.md` (Plan/Next/Repeat
  decoupling stays intact; import/export is a prompts-only surface)
- `.lovable/question-and-ambiguity/64-compact-plan-next-into-prompts-dropdown.md`
  (defines `excludeFromExport` flag that the exporter must honor)

Supersedes the earlier stub `.lovable/plans/pending/11-prompts-import-export-section.md`;
that file will be moved to `completed/` once this plan lands.

## Steps

1. Read every file listed under Context and map the current call graph from
   `prompt-dropdown.ts` header buttons to `prompt-io*` modules. Note which
   click handlers are missing versus wired-but-silently-failing.
2. Reproduce issue 03 in the browser preview (Playwright): open the prompts
   dropdown, click Import and Export, capture console + network + screenshot
   under `/tmp/browser/issue-03/`.
3. Confirm bundle schema coverage. Verify `schemas/prompts-bundle.schema.json`
   already covers `entries[]`, `excludeFromExport`, timestamps, category,
   slug, tags, and version. Extend the schema if any current runtime field
   (e.g. `replaceKey`, `mirrorPath`) is missing. See ./subtasks/12-prompts-import-export-menu/01-bundle-schema.md.
4. Define a stable bundle envelope `PromptsBundleV1` (id, schemaVersion,
   exportedAt, exporterVersion, entryCount, entries[]) in a new file
   `standalone-scripts/macro-controller/src/ui/prompt-bundle-types.ts`.
5. Refactor `prompt-io.ts` so a single `buildPromptsBundle()` returns the
   canonical envelope. The three exporters (JSON, ZIP, SQLite) all consume
   this same envelope so formats stay in sync.
6. Implement JSON export: pretty-printed `.json` file, filename
   `marco-prompts-YYYY-MM-DD-HHMM.json`, triggered via Blob + object URL,
   toast on success. Honor `excludeFromExport`.
7. Implement ZIP export using a tiny in-repo zip writer (no new npm dep if
   possible; if a dep is needed, evaluate `fflate` first). Layout:
   `manifest.json` at root, `entries/<slug>.md` for each prompt body,
   `entries/<slug>.meta.json` for metadata. See ./subtasks/12-prompts-import-export-menu/02-zip-writer.md.
8. Implement SQLite export by writing a single table `Prompts` with columns
   `Slug TEXT PRIMARY KEY, Name TEXT, Category TEXT, Tags TEXT,
   BodyMarkdown TEXT, BodyHtml TEXT, ReplaceKey TEXT, ExcludeFromExport
   INTEGER, UpdatedAt TEXT` plus a `Meta` table for the envelope fields.
   Use the existing SQLite-in-browser build the SDK already ships.
   See ./subtasks/12-prompts-import-export-menu/03-sqlite-export.md.
9. Wire the Export header button to open a compact popover anchored under
   the button with three rows (JSON / ZIP / SQLite) + entry count + last
   export timestamp. Popover closes on outside click or Esc.
10. Add a "copy JSON to clipboard" secondary action inside the popover as a
    fallback when file download is blocked (some sandboxed embeds do that).
11. Emit a shared "prompts.exported" log line via the existing `log()` helper
    with format, entry count, byte size, and elapsed ms.
12. Implement Import modal shell: full-screen overlay, dark theme, matches
    the existing dialog style used by `prompt-io-dialog.ts`.
    See ./subtasks/12-prompts-import-export-menu/04-import-modal.md.
13. Import modal accepts drag/drop and a file picker restricted to
    `.json,.zip,.sqlite,.db`. Detect format by magic bytes first, then by
    extension, then by content sniff.
14. JSON importer: parse, validate against `PromptsBundleV1` (use the
    schema from step 3), reject with a clear per-field error list on failure.
15. ZIP importer: unzip in memory, read `manifest.json`, then walk
    `entries/*.meta.json` + matching `.md` bodies, hydrate into
    `PromptsBundleV1`, validate.
16. SQLite importer: open the uploaded file with the sqlite-wasm loader,
    SELECT from `Prompts` and `Meta`, rehydrate into `PromptsBundleV1`,
    validate.
17. Preview stage inside the modal: table with columns Slug, Name, Category,
    Size, and Conflict (new / update / duplicate). User picks per-entry
    action: keep incoming, keep existing, rename incoming
    (`slug-imported-YYYYMMDD`). Bulk actions apply-to-all.
    See ./subtasks/12-prompts-import-export-menu/05-conflict-resolution.md.
18. Commit stage: apply chosen actions via `prompt-manager.ts` write API,
    flush to `prompt-cache.ts`, emit `prompts.imported` log line, refresh the
    dropdown list without a full page reload.
19. Persist last-imported metadata (source filename, format, entry count,
    timestamp) in the prompts config so the Export popover can show it.
20. Add per-prompt "exclude from export" checkbox in the prompt row editor
    that flips the `excludeFromExport` flag. Exporter honors it in all three
    formats; importer preserves the flag round-trip.
21. Harden filenames: sanitize slugs, cap length, strip control chars, avoid
    Windows-reserved names (`CON`, `PRN`, `NUL`, `COM1`, etc.) in ZIP layout.
22. Handle oversized bundles: cap import at a sane byte size (e.g. 25 MB),
    warn beyond 5 MB. Streamed parse for ZIP so we do not blow the tab heap.
23. Fail-fast error surface: any parse/validate failure shows a full error
    panel inside the modal with copy-to-clipboard for the JSON error list.
    No silent swallow (per project error-manage rules).
    See ./subtasks/12-prompts-import-export-menu/06-error-surface.md.
24. Wire the `IO` and `Load` buttons in the same header. `IO` opens a small
    combined menu (Export + Import launchers), `Load` re-reads prompts from
    cache and rebuilds the dropdown. Confirm with user if `Load` should also
    hit remote; capture ambiguity if unclear.
25. Add unit tests for the bundle round-trip: JSON, ZIP, SQLite each go
    export -> reimport -> deep-equal. Runs under vitest.
26. Add a component test for the Export popover: click Export, click JSON,
    assert a download blob was created with the expected filename shape.
27. Add a Playwright E2E: open prompts dropdown, click Export -> JSON,
    intercept download; open Import, drop the same file back, assert entry
    count and no conflicts.
28. Update `standalone-scripts/macro-controller/readme.md` and root
    `changelog.md` with a `v4.32.0` entry summarizing the three formats and
    the exclude-from-export honor.
29. Run the full pipeline gates: `node scripts/check-version-sync.mjs`,
    `node scripts/check-changelog-entry.mjs`, `node scripts/check-installer-contract.mjs`,
    `bunx tsgo --noEmit`, and vitest. All must pass.
30. Move this file to `.lovable/plans/completed/12-prompts-import-export-menu.md`
    with `Status: completed`, and move
    `.lovable/plans/pending/11-prompts-import-export-section.md` to
    `.lovable/plans/completed/` at the same time (it is a stub this plan
    supersedes). Close `.lovable/issues/03-prompts-import-export-inert.md`.

## Verification

- Step 2 attaches a screenshot proving Import / Export are inert today.
- Steps 6/7/8 each produce a downloadable artifact opened in a fresh
  Chrome profile to confirm the file is readable outside the extension.
- Step 17 preview is verified with a bundle that intentionally collides on
  two slugs; the modal must show correct conflict status per row.
- Step 25 vitest run posts `PASS` for the three round-trip suites.
- Step 27 Playwright run posts a green trace zip under `/tmp/browser/`.
- Step 29 CI gates print green; no changelog / version drift.

## Appended from prior pending tasks

- `.lovable/plans/pending/10-unified-billing-all-workspaces.md` (unrelated,
  left in place, not folded here).
- `.lovable/plans/pending/11-prompts-import-export-section.md` (folded;
  step 30 above moves it to completed).
