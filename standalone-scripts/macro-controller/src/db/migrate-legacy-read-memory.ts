/**
 * Migration: remove duplicate/legacy Read Memory seed entries from SQLite.
 *
 * Historical installs seeded the Read Memory prompt under one or more legacy
 * slugs (e.g. `rejog-the-memory-v1`, `read-memory`). The canonical slug is
 * `read-memory-enhanced` (see `standalone-scripts/prompts/16-read-memory/info.json`).
 *
 * This migration deletes every legacy row from the `Prompt` table and its
 * revision history from `PromptRevision`, then invalidates the IndexedDB
 * `JsonCopy` cache so the dropdown re-materializes from SQLite on next read.
 *
 * Idempotent: safe to run on every boot. Fresh installs never had the legacy
 * rows and the DELETE statements become no-ops.
 */

import { sendToExtension } from '../ui/extension-relay';
import { log } from '../logger';
import { logDiagnosticFromCode } from '../error-utils';
import { DB_NAME } from './db-name';

/**
 * Legacy Read Memory slugs that MUST be purged. Never re-add the canonical
 * slug `read-memory-enhanced` here.
 */
const LEGACY_READ_MEMORY_SLUGS: readonly string[] = [
  'rejog-the-memory-v1',
  'read-memory',
  'read-memory-imported',
  'read-memory-old',
  'read-memory-v1',
  'read-memory-v2',
];

function sqlLit(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function buildInList(): string {
  return LEGACY_READ_MEMORY_SLUGS.map(sqlLit).join(', ');
}

async function countLegacyRows(): Promise<number> {
  const sql = 'SELECT COUNT(*) AS c FROM Prompt WHERE Slug IN (' + buildInList() + ')';
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME,
    method: 'QUERY',
    endpoint: 'rawSql',
    params: { sql },
  });
  if (!resp?.isOk || !Array.isArray(resp.rows) || resp.rows.length === 0) return 0;
  const row = resp.rows[0] as { c?: unknown };
  const count = typeof row?.c === 'number' ? row.c : Number(row?.c);
  return Number.isFinite(count) ? count : 0;
}

async function deleteLegacyPromptRows(): Promise<void> {
  const inList = buildInList();
  const sql =
    'DELETE FROM PromptRevision WHERE Slug IN (' + inList + '); ' +
    'DELETE FROM Prompt WHERE Slug IN (' + inList + ');';
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME,
    method: 'SCHEMA',
    endpoint: 'rawSql',
    params: { sql },
  });
  if (!resp?.isOk) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'legacy-read-memory',
      reason: resp?.errorMessage ?? 'unknown error',
    });
  }
}

async function invalidateJsonCopy(): Promise<void> {
  try {
    const { clearPromptCache } = await import('../ui/prompt-cache');
    await clearPromptCache();
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'legacy-read-memory-cache',
      reason: err instanceof Error ? err.message : String(err),
    }, err);
  }
}

/**
 * Idempotently remove legacy Read Memory duplicate seed rows so existing
 * installs converge on a single canonical entry (`read-memory-enhanced`).
 */
export async function migrateRemoveLegacyReadMemoryDuplicates(): Promise<void> {
  try {
    const before = await countLegacyRows();
    if (before === 0) return;
    await deleteLegacyPromptRows();
    await invalidateJsonCopy();
    log(
      '[MacroDb] Removed ' + before + ' legacy Read Memory row(s): '
        + LEGACY_READ_MEMORY_SLUGS.join(', '),
      'success',
    );
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'legacy-read-memory',
      reason: err instanceof Error ? err.message : String(err),
    }, err);
  }
}

export const LEGACY_READ_MEMORY_SLUGS_FOR_TEST = LEGACY_READ_MEMORY_SLUGS;
