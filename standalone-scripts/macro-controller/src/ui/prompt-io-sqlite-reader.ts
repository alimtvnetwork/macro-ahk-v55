/**
 * Prompts SQLite importer (plan 12 step 11).
 *
 * Opens the `.sqlite` bytes with a lazy-loaded `sql.js`, validates the
 * `Meta` + `Prompts` tables produced by `prompt-io-sqlite.ts`, hydrates
 * each row back into a `PromptEntry`, and returns a fully-formed
 * `PromptsBundleV1` for the merger.
 *
 * Errors surface with file+function context; nothing is swallowed.
 */

import type { PromptEntry } from '../types/ui-types';
import type { PromptsBundleV1 } from './prompt-bundle-types';
import { PROMPTS_BUNDLE_SCHEMA_VERSION } from './prompt-bundle-types';
import { throwDiagnostic } from '../errors/diagnostic-error';

const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm';

type SqlJsModule = typeof import('sql.js');

interface SqlStatement {
  bind(values?: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}

interface SqlDatabaseRO {
  prepare(sql: string): SqlStatement;
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  close(): void;
}

async function openDatabaseFrom(bytes: Uint8Array): Promise<SqlDatabaseRO> {
  const sqlJs = await import('sql.js');
  const initFn: SqlJsModule['default'] = sqlJs.default;
  const SQL = await initFn({ locateFile: () => SQL_WASM_URL });
  const DatabaseCtor = SQL.Database;
  return new DatabaseCtor(bytes) as unknown as SqlDatabaseRO;
}

function readMeta(db: SqlDatabaseRO): Map<string, string> {
  const stmt = db.prepare('SELECT Key, Value FROM Meta;');
  const meta = new Map<string, string>();
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const key = String(row.Key ?? '');
      const value = String(row.Value ?? '');
      if (key.length > 0) meta.set(key, value);
    }
  } finally {
    stmt.free();
  }
  return meta;
}

function requireMeta(meta: Map<string, string>, key: string): string {
  const value = meta.get(key);
  if (!value) throwDiagnostic('PROMPT_IO_SQLITE_E001', { missingKey: key });
  return value as string;
}

function parseTags(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((t): t is string => typeof t === 'string');
}

function rowToEntry(row: Record<string, unknown>): PromptEntry {
  const name = String(row.Name ?? '').trim();
  const text = typeof row.BodyMarkdown === 'string' ? row.BodyMarkdown : '';
  if (!name) throwDiagnostic('PROMPT_IO_SQLITE_E002', { rowId: String(row.rowid ?? row.Slug ?? 'unknown') });
  const entry: PromptEntry = { name, text };
  if (typeof row.Slug === 'string' && row.Slug.length > 0) entry.slug = row.Slug;
  if (typeof row.Category === 'string' && row.Category.length > 0) entry.category = row.Category;
  const tags = parseTags(row.Tags);
  if (tags) entry.tags = tags;
  if (typeof row.ReplaceKey === 'string' && row.ReplaceKey.length > 0) entry.replaceKey = row.ReplaceKey;
  const excludeRaw = row.ExcludeFromExport;
  if (typeof excludeRaw === 'number') entry.excludeFromExport = excludeRaw !== 0;
  return entry;
}

function readPrompts(db: SqlDatabaseRO): PromptEntry[] {
  const stmt = db.prepare(
    'SELECT Slug, Name, Category, Tags, BodyMarkdown, BodyHtml, ReplaceKey, ExcludeFromExport, UpdatedAt FROM Prompts;',
  );
  const entries: PromptEntry[] = [];
  try {
    while (stmt.step()) entries.push(rowToEntry(stmt.getAsObject()));
  } finally {
    stmt.free();
  }
  return entries;
}

function assertSchema(db: SqlDatabaseRO): void {
  const rows = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Meta','Prompts');");
  const names = new Set<string>();
  rows.forEach((r) => r.values.forEach((v) => names.add(String(v[0]))));
  if (!names.has('Meta')) throwDiagnostic('PROMPT_IO_SQLITE_E003', { tableName: 'Meta' });
  if (!names.has('Prompts')) throwDiagnostic('PROMPT_IO_SQLITE_E003', { tableName: 'Prompts' });
}

export interface SqliteImportResult {
  bundle: PromptsBundleV1;
}

/**
 * Parse a prompts SQLite bundle. Never swallows: every failure throws
 * with a message the error surface (SS-06) can render as-is.
 */
export async function parsePromptsBundleSqlite(bytes: Uint8Array): Promise<SqliteImportResult> {
  const db = await openDatabaseFrom(bytes);
  try {
    assertSchema(db);
    const meta = readMeta(db);
    const schemaVersion = Number(requireMeta(meta, 'SchemaVersion'));
    if (schemaVersion !== PROMPTS_BUNDLE_SCHEMA_VERSION) {
      throwDiagnostic('PROMPT_IO_SQLITE_E004', { actualVersion: schemaVersion, expectedVersion: PROMPTS_BUNDLE_SCHEMA_VERSION });
    }
    const entries = readPrompts(db);
    const bundle: PromptsBundleV1 = {
      id: requireMeta(meta, 'BundleId'),
      schemaVersion: PROMPTS_BUNDLE_SCHEMA_VERSION,
      exportedAt: requireMeta(meta, 'ExportedAt'),
      exporterVersion: requireMeta(meta, 'ExporterVersion'),
      entryCount: entries.length,
      format: 'sqlite',
      entries,
    };
    return { bundle };
  } finally {
    db.close();
  }
}
