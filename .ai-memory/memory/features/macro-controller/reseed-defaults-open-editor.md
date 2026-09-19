# Re-seed defaults auto-opens the default editor

- File: `standalone-scripts/macro-controller/src/ui/chip-gear-menu.ts`
- Trigger: `⚙` gear menu on the Plan and Next inline strips.
- Rows affected: `🔄 Re-seed defaults (safe)` and `⚠️ Force reset defaults`.

## Contract

Both re-seed actions now call `runReseedAndOpen(role, force)` (single helper).
On success the helper:

1. Runs `reseedPromptsOnDemand({ force })`.
2. Shows the toast: `✅ Prompt defaults re-seeded[ (N rows reset)] , opening default row` (success tone).
3. Immediately awaits `openDefaultPromptEditor(role)` so the newly seeded row opens for edit without extra clicks.

On failure the helper still routes through `reportGearFailure('SEED_RESEED_E001', { force, role, reason }, ...)` and does NOT open the editor. The failure diagnostic context now always includes `role` (previously only `force`+`reason`) so PROMPT_EDIT_E005 downstream traces can correlate the reseed source.

Force reset keeps the pre-existing `window.confirm(...)` guard. Confirm cancelled = no toast, no editor.

## Root cause it fixes

Previously "Re-seed defaults" showed a green toast and stopped. Users had to reopen the gear, hunt for "Edit default", and click again to verify the reseeded body. This split action created the illusion the seed had not applied and encouraged double-click loops. Repair flow (`runRepairAndOpen`) already had one-shot editor reopen, so the reseed flow now mirrors that contract.

## Never regress

- Both `reseed` and `reseedForce` gear items MUST call `runReseedAndOpen`, never a "toast-only" variant.
- Editor open MUST be awaited so any adoption/orphan path in `openDefaultPromptEditor` runs before the user interacts.
- Failure branches MUST include `role` in the diagnostic context.
