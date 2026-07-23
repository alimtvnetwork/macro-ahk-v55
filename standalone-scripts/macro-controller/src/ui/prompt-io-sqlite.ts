/**
 * Prompts SQLite exporter (plan 12 step 8 / SS-03).
 *
 * Emits a single `.sqlite` file that DB Browser for SQLite can open.
 * Schema per SS-03:
 *
 *   Meta(Key TEXT PK, Value TEXT NOT NULL)
 *   Prompts(Slug TEXT PK, Name, Category, Tags, BodyMarkdown, BodyHtml,
 *           ReplaceKey, ExcludeFromExport INTEGER, UpdatedAt)
 *
 * `sql.js` is dynamically imported so the ~500 kB wasm loader stays out
 * of the injected macro-controller bundle until the user actually clicks
 * "Export as SQLite". Failures are surfaced to the caller (no swallow).
 */

import type { PromptEntry } from '../types/ui-types';
import type { PromptsBundleV1 } from './prompt-bundle-types';
import { buildPromptsBundle } from './prompt-bundle-types';
import { sanitizeSlug } from './prompt-slug-utils';

const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm';

const DDL_META = `CREATE TABLE Meta (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL
);`;

const DDL_PROMPTS = `CREATE TABLE Prompts (
  Slug TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Category TEXT,
  Tags TEXT,
  BodyMarkdown TEXT,
  BodyHtml TEXT,
  ReplaceKey TEXT,
  ExcludeFromExport INTEGER NOT NULL DEFAULT 0,
  UpdatedAt TEXT NOT NULL
);`;



interface SqlDatabase {
  run(sql: string, params?: unknown[]): void;
  export(): Uint8Array;
  close(): void;
}

async function loadSqlJs() {
  return await import('sql.js');
}

async function openDatabase(): Promise<SqlDatabase> {
  const sqlJs = await loadSqlJs();
  const initFn = sqlJs.default;
  const SQL = await initFn({ locateFile: () => SQL_WASM_URL });
  const DatabaseCtor = SQL.Database;
  return new DatabaseCtor() as unknown as SqlDatabase;
}

function insertMeta(db: SqlDatabase, bundle: PromptsBundleV1): void {
  const rows: [string, string][] = [
    ['SchemaVersion', String(bundle.schemaVersion)],
    ['BundleId', bundle.id],
    ['ExportedAt', bundle.exportedAt],
    ['ExporterVersion', bundle.exporterVersion],
    ['EntryCount', String(bundle.entryCount)],
  ];
  rows.forEach(([key, value]) => {
    db.run('INSERT INTO Meta (Key, Value) VALUES (?, ?);', [key, value]);
  });
}

function serializeTags(entry: PromptEntry): string | null {
  const hasTags = Array.isArray(entry.tags) && entry.tags.length > 0;
  return hasTags ? JSON.stringify(entry.tags) : null;
}

function insertPrompts(db: SqlDatabase, entries: PromptEntry[]): void {
  const nowIso = new Date().toISOString();
  entries.forEach((entry, index) => {
    const slugSource = entry.slug ?? entry.name;
    const slug = sanitizeSlug(slugSource, index + 1);
    const params: unknown[] = [
      slug,
      entry.name,
      entry.category ?? null,
      serializeTags(entry),
      entry.text,
      null,                                        // BodyHtml reserved
      entry.replaceKey ?? null,
      entry.excludeFromExport ? 1 : 0,
      nowIso,
    ];
    db.run(
      'INSERT INTO Prompts (Slug, Name, Category, Tags, BodyMarkdown, BodyHtml, ReplaceKey, ExcludeFromExport, UpdatedAt) '
      + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      params,
    );
  });
}

export interface SqliteExportResult {
  bytes: Uint8Array;
  bundle: PromptsBundleV1;
}

/**
 * Build the SQLite blob for the given prompt entries. The caller wraps
 * `bytes` in a Blob and triggers the download.
 *
 * Throws (never swallows) so the UI can render the failure via
 * `error-surface` in SS-06. Every throw carries file+function context
 * per the project's error-management spec.
 */
export async function buildPromptsSqlite(
  entries: PromptEntry[],
  exporterVersion: string,
): Promise<SqliteExportResult> {
  const bundle = buildPromptsBundle(entries, exporterVersion, { format: 'sqlite' });
  const db = await openDatabase();
  try {
    db.run(DDL_META);
    db.run(DDL_PROMPTS);
    insertMeta(db, bundle);
    insertPrompts(db, bundle.entries);
    return { bytes: db.export(), bundle };
  } finally {
    db.close();
  }
}
