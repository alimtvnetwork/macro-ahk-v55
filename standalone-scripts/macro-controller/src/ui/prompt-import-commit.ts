/**
 * Plan 12 step 18 (SS-06): atomic prompt-import commit with rollback.
 *
 * ROOT ROBUSTNESS PROBLEM this file solves (one sentence):
 * `performPromptImport()` writes the merged prompt list to IndexedDB and
 * then clears the derived HTML cache; if the write throws mid-flight
 * (QuotaExceeded, TransactionInactive, SecurityError), the library ends
 * up in a partially-mutated state with NO way to recover — so we snapshot
 * the pre-commit `JsonCopy`, run the import, and on ANY throw restore
 * the snapshot verbatim before re-raising.
 *
 * Contract:
 *   - Snapshot is taken via `readJsonCopy()` BEFORE the import runs.
 *   - Import runs through the standard `performPromptImport(_, options)`.
 *   - On success: audit entry flipped to `committed`, caller gets the
 *     PromptImportResults.
 *   - On failure: `writeJsonCopy(snapshot)` restores prior state, audit
 *     entry flipped to `rolled_back` with the error message, and the
 *     original error is re-thrown so the modal shows its red panel.
 *   - The rollback write itself is wrapped in a try/catch; a failure
 *     there is a "double fault" — logged with a distinct code so ops
 *     can distinguish "we lost the library" from "one import failed".
 *
 * This file is deliberately small and dependency-light so the truth
 * table test in plan step 26 can exercise it directly.
 */

import type { CachedPromptEntry } from './prompt-cache';
import { readJsonCopy, writeJsonCopy } from './prompt-cache';
import { performPromptImport, type PromptImportResults } from './prompt-io';
import {
  beginImportAuditEntry,
  finalizeImportAuditEntry,
  type ImportAuditActionRecord,
  type ImportAuditCounts,
  type ImportAuditFormat,
} from './prompt-import-audit';

import { classifyImportError, ImportCommitError, logStructured } from './prompt-import-errors';

export interface AtomicCommitInput {
  /** Entries the caller wants to insert/overwrite (post-action bucketing). */
  entries: CachedPromptEntry[];
  /** Per-row action decisions for the audit log. */
  actions: ImportAuditActionRecord[];
  /** Original file name (for the audit entry). */
  filename: string;
  /** Detected format of the source file. */
  format: ImportAuditFormat;
  /** Total skipped rows the caller dropped BEFORE calling us. */
  skippedCount: number;
  /** Renamed count the caller applied BEFORE calling us. */
  renamedCount: number;
}

export interface AtomicCommitOutcome {
  auditId: string;
  results: PromptImportResults;
  counts: ImportAuditCounts;
}

function handleCommitSuccess(
  auditId: string,
  results: PromptImportResults,
  input: AtomicCommitInput,
): AtomicCommitOutcome {
  const counts: ImportAuditCounts = {
    added: results.added,
    updated: results.updated,
    renamed: input.renamedCount,
    skipped: input.skippedCount,
  };
  finalizeImportAuditEntry(auditId, { status: 'committed', counts });
  logStructured({
    namespace: 'ImportCommit', code: 'COMMIT_OK', level: 'info',
    fields: {
      auditId,
      added: counts.added, updated: counts.updated,
      renamed: counts.renamed, skipped: counts.skipped,
    },
  });
  return { auditId, results, counts };
}

async function attemptRollback(auditId: string, snapshot: CachedPromptEntry[], classifiedMessage: string): Promise<boolean> {
  try {
    await writeJsonCopy(snapshot);
    logStructured({
      namespace: 'ImportCommit', code: 'ROLLBACK_OK', level: 'info',
      fields: { auditId, restoredEntries: snapshot.length },
    });
    return false;
  } catch (rollbackErr) {
    const rbMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
    logStructured({
      namespace: 'ImportCommit', code: 'COMMIT_DOUBLE_FAULT', level: 'error',
      fields: { auditId, rollbackError: rbMsg, originalError: classifiedMessage },
    });
    return true;
  }
}

async function handleCommitFailure(
  auditId: string,
  err: unknown,
  snapshot: CachedPromptEntry[],
  input: AtomicCommitInput,
): Promise<never> {
  const classified = classifyImportError(err, 'commit');
  logStructured({
    namespace: 'ImportCommit', code: classified.code, level: 'error',
    fields: { auditId, phase: 'commit', error: classified.message },
  });
  const doubleFault = await attemptRollback(auditId, snapshot, classified.message);
  finalizeImportAuditEntry(auditId, {
    status: 'rolled_back',
    counts: { added: 0, updated: 0, renamed: 0, skipped: input.skippedCount },
    error: classified.message,
  });
  throw new ImportCommitError({
    code: doubleFault ? 'COMMIT_DOUBLE_FAULT' : classified.code,
    message: classified.message,
    hint: doubleFault
      ? 'CRITICAL: rollback itself failed. Your prompt library may be inconsistent. Export a backup NOW.'
      : classified.hint,
    auditId,
    cause: err,
  });
}

/**
 * Atomic wrapper around `performPromptImport`. Snapshot -> import ->
 * finalize; rollback on any throw.
 */
export async function commitPromptImportAtomic(
  input: AtomicCommitInput
): Promise<AtomicCommitOutcome> {
  const auditId = beginImportAuditEntry({
    filename: input.filename,
    format: input.format,
    actions: input.actions,
  });
  const snapshotRecord = await readJsonCopy();
  const snapshot: CachedPromptEntry[] = snapshotRecord ? snapshotRecord.entries.slice() : [];
  logStructured({
    namespace: 'ImportCommit', code: 'SNAPSHOT_TAKEN', level: 'info',
    fields: { auditId, snapshotEntries: snapshot.length, filename: input.filename, format: input.format },
  });
  try {
    const results = await performPromptImport(input.entries, { overwrite: true });
    return handleCommitSuccess(auditId, results, input);
  } catch (err) {
    return handleCommitFailure(auditId, err, snapshot, input);
  }
}
