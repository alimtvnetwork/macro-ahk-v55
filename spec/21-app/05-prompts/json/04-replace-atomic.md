# Replace All — Atomic Swap

## Trigger
- Panel ⋯ menu → **Replace All** (destructive; gated behind confirm dialog).

## Confirm dialog
- Title: "Replace all prompts & macros?"
- Body: "This deletes every existing prompt, macro, category, and favorite, then loads the imported bundle. An automatic backup will be saved (kept for 5 replacements)."
- Type-to-confirm: user must type the literal string `REPLACE` (case-sensitive) before the **Replace** button enables.
- Default focus: **Cancel**. ESC cancels.

## Flow
1. Parse + Ajv-validate the incoming bundle (`prompts-bundle.schema.json`). Fail-fast on invalid.
2. Snapshot current state → push onto `chrome.storage.local.PromptsBackupRing` (ring buffer length 5; oldest evicted).
   - Snapshot key: `backup-prompts-bundle-<runId>` where `runId = crypto.randomUUID()`.
   - Snapshot includes `SnapshotAtKL`, `ExtensionVersion`, and the same shape as Export.
3. Begin SQLite transaction:
   - `DELETE FROM PromptCategories; DELETE FROM Prompts; DELETE FROM Macros; DELETE FROM MacroPrompts; DELETE FROM Favorites;`
   - Bulk-insert from incoming bundle.
4. Validate post-state row counts match bundle counts; if mismatch → ROLLBACK, surface error, do NOT consume backup slot.
5. COMMIT.
6. Toast: "Replaced with bundle from <ExportedAtKL>. Backup saved (rollback available)."

## Rollback path
- Panel ⋯ menu → **Restore previous bundle** lists the 5 most recent snapshots (label = `SnapshotAtKL` + counts).
- Selecting one runs the same Replace flow with the snapshot as the source bundle.
- Restoring itself creates a new backup slot (so restore-of-restore works).

## Guards
- Disabled while a macro is `Running` or `Paused` (banner: "Stop the running macro before replacing").
- Disabled if `chrome.storage.local` write quota would be exceeded by the new backup (surface `Reason=BackupQuotaExceeded`).

## Failure log
`Reason ∈ { ConfirmCancelled, SchemaInvalid, BackupFailed, BackupQuotaExceeded, TransactionRolledBack, PostStateMismatch }` with `ReasonDetail` and pre/post row counts.
