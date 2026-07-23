/**
 * Leaf module: `authRecoveryExhausted` flag shared by rename-api and rename-bulk.
 *
 * Extracted from `rename-bulk.ts` (Plan-17 step 8) to break the runtime cycle
 *   rename-api.ts <-> rename-bulk.ts
 * observed by `scripts/check-madge-cycles.mjs`. `rename-api` needs to read /
 * clear the flag when a 401 recovery attempt runs, and `rename-bulk` needs to
 * reset it at the start of every bulk pass, but neither should have to import
 * the other's module graph.
 *
 * Must remain dependency-free (no imports). Do NOT add logging or DOM helpers
 * here — the whole point is that this file is a leaf.
 *
 * Behavior parity: the flag was previously an instance field on
 * `BulkRenameManager` (a singleton), so a module-scope variable is
 * equivalent. `bulkRename()` still resets it to `false` at pass start
 * (rename-bulk.ts line 202).
 */

let authRecoveryExhausted = false;

export function getAuthRecoveryExhausted(): boolean {
  return authRecoveryExhausted;
}

export function setAuthRecoveryExhausted(value: boolean): void {
  authRecoveryExhausted = value;
}
