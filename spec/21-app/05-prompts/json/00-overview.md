# JSON I/O — Overview
Four operations on Prompts / Macros / Categories bundles:
| Op | Scope | Trigger | Output |
|----|-------|---------|--------|
| **Save** | single prompt or macro | row menu → Save | `<Slug>.v<Version>.json` download + clipboard copy |
| **Export** | full bundle | panel ⋯ menu → Export All | `prompts-bundle-<ISO8601-KL>.json` download |
| **Import (merge)** | full or partial bundle | panel ⋯ menu → Import, or drag-drop `.json` | merge-by-Slug with conflict UI |
| **Replace** | full bundle | panel ⋯ menu → Replace All | atomic swap, auto-backup, rollback path |
## File naming
- Single: `<Kind>.<Slug>.v<Version>.json` (Kind ∈ `prompt` | `macro` | `macro-prompt`).
- Bundle: `prompts-bundle-YYYYMMDD-HHmm-local time.json` .
- Backup: `backup-prompts-bundle-<runId>.json` in `chrome.storage.local` key `PromptsBackupRing` (ring of 5).
## Conventions
- All payloads are UTF-8, LF line endings, 2-space indent, trailing newline.
- Top-level key order is fixed (see `01-save-single.md`, `02-export-all.md`) for deterministic diffs.
- All payloads carry `SchemaVersion: 1` and `ExportedAtKL` (the user's local timezone ISO8601).
- All operations validate against `schemas/*.schema.json` via Ajv before write/apply.
- Failures follow the mandatory failure-log shape (Reason, ReasonDetail, VariableContext[], SelectorAttempts[] where applicable).
