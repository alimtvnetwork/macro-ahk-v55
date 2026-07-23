# SS-05: Conflict resolution rules

Parent: 12-prompts-import-export-menu
Slug: conflict-resolution
Status: pending
Created: 2026-07-17

## Rules

1. Match incoming entries to existing by `slug` (case-insensitive).
2. Conflict states per row:
   - `new`: slug not present locally.
   - `identical`: slug present, all fields deep-equal. Auto-skip.
   - `update`: slug present, some fields differ. Default action: keep
     incoming. User can flip to keep existing or rename.
   - `duplicate`: slug present, `UpdatedAt` is older on incoming. Default:
     keep existing.
3. Rename policy: append `-imported-YYYYMMDD`; if that also collides, append
   `-imported-YYYYMMDD-<n>` starting at `n=2`.
4. Bulk actions apply the same action to every row that is still on its
   default.
5. Commit is atomic per entry: a single row failing writes a per-row error
   and continues with the rest. Final summary lists success / skip / fail
   counts.

## Logging

Every commit emits a `prompts.import.commit` line with the counts and the
list of failed slugs (if any).
