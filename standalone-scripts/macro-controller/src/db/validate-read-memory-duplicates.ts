/**
 * Startup validation: detect multiple Read Memory prompt records and
 * auto-disable the duplicates so only the canonical entry
 * (`read-memory-enhanced`) surfaces to the user.
 *
 * This runs AFTER the legacy-slug migration and seeding pass. Any leftover
 * duplicates (user imports, cross-device sync, unknown legacy slugs) are
 * demoted by flipping `IsDefault = 0` and prefixing `Name` with
 * `[duplicate]`. Rows are never deleted here, so users can still recover or
 * inspect them from the prompt library.
 *
 * Idempotent: rows already renamed to `[duplicate] ...` are skipped.
 */

import { log } from '../logger';
import { logDiagnosticFromCode } from '../error-utils';
import { runSql as runSqlBridge } from './sql-bridge';

const CANONICAL_SLUG = 'read-memory-enhanced';
const DUPLICATE_PREFIX = '[duplicate] ';

/**
 * Match rule: any prompt whose Slug OR Name looks like a Read Memory
 * variant, EXCEPT the canonical slug. Keeps the SQL narrow so unrelated
 * prompts are never demoted.
 */
const READ_MEMORY_MATCH_WHERE =
  "(Slug LIKE 'read-memory%' OR Slug LIKE 'rejog%' OR Name LIKE 'Read Memory%' OR Name LIKE 'Rejog%') "
  + "AND Slug <> '" + CANONICAL_SLUG + "' "
  + "AND Name NOT LIKE '" + DUPLICATE_PREFIX + "%'";

interface DuplicateRow { Id: number; Slug: string; Name: string }

function toDuplicateRows(rows: readonly unknown[]): DuplicateRow[] {
  const out: DuplicateRow[] = [];
  for (const raw of rows) {
    const row = raw as { Id?: unknown; Slug?: unknown; Name?: unknown };
    const id = typeof row.Id === 'number' ? row.Id : Number(row.Id);
    const slug = typeof row.Slug === 'string' ? row.Slug : '';
    const name = typeof row.Name === 'string' ? row.Name : '';
    if (Number.isFinite(id) && slug.length > 0) {
      out.push({ Id: id, Slug: slug, Name: name });
    }
  }
  return out;
}

async function findDuplicates(): Promise<DuplicateRow[]> {
  const sql = 'SELECT Id, Slug, Name FROM Prompt WHERE ' + READ_MEMORY_MATCH_WHERE;
  const resp = await runSqlBridge('QUERY', sql);
  if (!resp?.isOk || !Array.isArray(resp.rows)) return [];
  return toDuplicateRows(resp.rows as unknown[]);
}

async function demoteDuplicates(ids: readonly number[]): Promise<boolean> {
  const idList = ids.join(', ');
  const now = Date.now();
  const sql =
    "UPDATE Prompt SET IsDefault = 0, "
    + "Name = '" + DUPLICATE_PREFIX.replace(/'/g, "''") + "' || Name, "
    + 'UpdatedAt = ' + now + ' '
    + 'WHERE Id IN (' + idList + ')';
  const resp = await runSqlBridge('SCHEMA', sql);
  if (!resp?.isOk) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'read-memory-duplicates',
      reason: resp?.errorMessage ?? 'unknown error',
    });
    return false;
  }
  return true;
}

async function invalidateJsonCopy(): Promise<void> {
  try {
    const { clearPromptCache } = await import('../ui/prompt-cache');
    await clearPromptCache();
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'read-memory-duplicates-cache',
      reason: err instanceof Error ? err.message : String(err),
    }, err);
  }
}

export interface ReadMemoryDuplicateReport {
  readonly detected: number;
  readonly disabled: number;
  readonly slugs: readonly string[];
}

/**
 * Detect and auto-disable any duplicate Read Memory rows. Returns a
 * report suitable for logging or telemetry.
 */
export async function validateAndDisableReadMemoryDuplicates(): Promise<ReadMemoryDuplicateReport> {
  try {
    const duplicates = await findDuplicates();
    if (duplicates.length === 0) {
      return { detected: 0, disabled: 0, slugs: [] };
    }
    const ok = await demoteDuplicates(duplicates.map((row) => row.Id));
    if (!ok) {
      return { detected: duplicates.length, disabled: 0, slugs: duplicates.map((row) => row.Slug) };
    }
    await invalidateJsonCopy();
    const slugs = duplicates.map((row) => row.Slug);
    log(
      '[MacroDb] Disabled ' + duplicates.length + ' duplicate Read Memory row(s): '
        + slugs.join(', '),
      'success',
    );
    return { detected: duplicates.length, disabled: duplicates.length, slugs };
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', {
      column: 'read-memory-duplicates',
      reason: err instanceof Error ? err.message : String(err),
    }, err);
    return { detected: 0, disabled: 0, slugs: [] };
  }
}

export const READ_MEMORY_CANONICAL_SLUG_FOR_TEST = CANONICAL_SLUG;
export const READ_MEMORY_DUPLICATE_PREFIX_FOR_TEST = DUPLICATE_PREFIX;
