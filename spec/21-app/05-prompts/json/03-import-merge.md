# Import — Merge by Slug

## Trigger
- Panel ⋯ menu → **Import**.
- Drag-drop `.json` onto Prompts panel (see `08-drag-drop-import.md`).

## Algorithm
1. Parse + Ajv-validate against `prompts-bundle.schema.json` (or single-item schema).
2. Build incoming index keyed by `(Kind, Slug)`.
3. For each incoming item, classify:
   - **New** — no existing `(Kind, Slug)` → add.
   - **Identical** — existing item's `Checksum` matches → skip.
   - **Conflict** — exists with different `Checksum` → queue for conflict UI.
4. Present **Dry-run preview** dialog: counts of New / Identical / Conflict, expandable list per kind.
5. User chooses per-conflict resolution:
   - **Keep mine** — leave existing untouched.
   - **Use theirs** — overwrite existing (preserve existing `CreatedAtKL`, update `UpdatedAtKL`).
   - **Rename** — incoming `Slug` gets suffix `-imported-<n>` (auto-increment until unique).
   - **Apply to all conflicts** checkbox for bulk choice.
6. Apply transaction:
   - Snapshot current state to `PromptsBackupRing` (see `04-replace-atomic.md`).
   - Apply all decisions in a single SQLite transaction.
   - Re-validate post-state; rollback if invalid.
7. Toast summary: "Imported N new, M overwritten, K renamed, J skipped."

## Conflict UI rules
- Default selection: **Keep mine** (safe default).
- Show diff hint (e.g., "Version 2 → 3", "12 lines changed in Body").
- ESC cancels entire import (no partial apply).

## Failure log
`Reason ∈ { ParseFailed, SchemaInvalid, ConflictUnresolved, TransactionRolledBack, BackupFailed }` with `ReasonDetail` and `SelectorAttempts[]` for any slug-collision resolution.
