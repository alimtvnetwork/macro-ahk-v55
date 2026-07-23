/**
 * Plan 12 step 17 (SS-06): append-only audit log for prompt imports.
 *
 * Every commit through `commitPromptImportAtomic()` appends one entry here
 * BEFORE the cache write and one status update AFTER. The log survives
 * across sessions via localStorage, is capped so a runaway macro can't
 * fill the quota, and is JSON-parseable so step 19's error panel can
 * deep-link into a specific entry.
 *
 * Storage layout (localStorage key `marco.prompt-import-audit`):
 *
 *   {
 *     "schemaVersion": 1,
 *     "entries": [
 *       {
 *         "id": "2026-07-17T12:34:56.789Z-a1b2",
 *         "timestamp": 1755000000000,
 *         "filename": "prompts.json",
 *         "format": "json",
 *         "status": "committed" | "rolled_back" | "in_progress",
 *         "counts": { "added": 2, "updated": 1, "renamed": 1, "skipped": 3 },
 *         "actions": [
 *           { "slug": "hello", "action": "add" },
 *           { "slug": "goodbye", "action": "rename", "renamedTo": "goodbye-imported" }
 *         ],
 *         "error"?: "IDB QuotaExceeded: ..."
 *       }
 *     ]
 *   }
 *
 * Rules:
 *   - Append-only inside a single import (we never mutate an entry's `id`,
 *     `timestamp`, `filename`, `format`, or `actions`). The `status` +
 *     `counts` + `error` fields are the ONLY mutable window; they flip
 *     `in_progress -> committed` or `in_progress -> rolled_back` exactly
 *     once via `finalizeImportAuditEntry()`.
 *   - Bounded at MAX_ENTRIES (100). Oldest evicted first (FIFO).
 *   - `schemaVersion` mismatch resets the log (with a warn log line).
 *   - Every read/write is wrapped so a corrupt localStorage payload can
 *     never break the import flow — errors are logged, and we fall back
 *     to a fresh empty log.
 */

import { log } from '../logger';
import { throwDiagnostic } from '../errors/diagnostic-error';

export type ImportAuditRowAction = 'add' | 'overwrite' | 'skip' | 'rename';
export type ImportAuditStatus = 'in_progress' | 'committed' | 'rolled_back';
export type ImportAuditFormat = 'json' | 'zip' | 'sqlite';

export interface ImportAuditActionRecord {
  slug: string;
  action: ImportAuditRowAction;
  renamedTo?: string;
}

export interface ImportAuditCounts {
  added: number;
  updated: number;
  renamed: number;
  skipped: number;
}

export interface ImportAuditEntry {
  id: string;
  timestamp: number;
  filename: string;
  format: ImportAuditFormat;
  status: ImportAuditStatus;
  counts: ImportAuditCounts;
  actions: ImportAuditActionRecord[];
  error?: string;
}

interface ImportAuditFile {
  schemaVersion: 1;
  entries: ImportAuditEntry[];
}

const STORAGE_KEY = 'marco.prompt-import-audit';
const MAX_ENTRIES = 100;
const CURRENT_SCHEMA = 1 as const;

function emptyFile(): ImportAuditFile {
  return { schemaVersion: CURRENT_SCHEMA, entries: [] };
}

function readFile(): ImportAuditFile {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    log('[ImportAudit] localStorage getItem failed: ' + String(err), 'warn');
    return emptyFile();
  }
  if (!raw) return emptyFile();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') throwDiagnostic('PROMPT_IO_AUDIT_E001', { actualType: parsed === null ? 'null' : typeof parsed });
    const file = parsed as Partial<ImportAuditFile>;
    if (file.schemaVersion !== CURRENT_SCHEMA) {
      log('[ImportAudit] schemaVersion mismatch (' + String(file.schemaVersion)
        + ' != ' + CURRENT_SCHEMA + '); resetting log', 'warn');
      return emptyFile();
    }
    if (!Array.isArray(file.entries)) throwDiagnostic('PROMPT_IO_AUDIT_E002', { actualType: file.entries === null ? 'null' : typeof file.entries });
    return { schemaVersion: CURRENT_SCHEMA, entries: file.entries as ImportAuditEntry[] };
  } catch (err) {
    log('[ImportAudit] Corrupt payload, resetting: ' + String(err), 'warn');
    return emptyFile();
  }
}

function writeFile(file: ImportAuditFile): void {
  // FIFO eviction: keep only the most recent MAX_ENTRIES.
  if (file.entries.length > MAX_ENTRIES) {
    file.entries = file.entries.slice(file.entries.length - MAX_ENTRIES);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch (err) {
    // QuotaExceeded / SecurityError: surface but do NOT throw — audit must
    // never break the actual import.
    log('[ImportAudit] Write failed (audit lost, import unaffected): ' + String(err), 'error');
  }
}

function makeId(timestamp: number): string {
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return new Date(timestamp).toISOString() + '-' + rand;
}

/**
 * Append a new `in_progress` entry BEFORE the cache write. Returns the
 * generated `id` so the caller can flip it to `committed` or
 * `rolled_back` via `finalizeImportAuditEntry()`.
 */
export function beginImportAuditEntry(input: {
  filename: string;
  format: ImportAuditFormat;
  actions: ImportAuditActionRecord[];
}): string {
  const timestamp = Date.now();
  const id = makeId(timestamp);
  const entry: ImportAuditEntry = {
    id,
    timestamp,
    filename: input.filename,
    format: input.format,
    status: 'in_progress',
    counts: { added: 0, updated: 0, renamed: 0, skipped: 0 },
    actions: input.actions,
  };
  const file = readFile();
  file.entries.push(entry);
  writeFile(file);
  log('[ImportAudit] begin id=' + id + ' file=' + input.filename
    + ' format=' + input.format + ' actions=' + input.actions.length, 'info');
  return id;
}

/**
 * Finalise the entry started by `beginImportAuditEntry`. Mutates only
 * `status`, `counts`, and `error`. No-op (with warn log) if the id is
 * gone (e.g. evicted by FIFO between begin and finalize).
 */
export function finalizeImportAuditEntry(
  id: string,
  outcome:
    | { status: 'committed'; counts: ImportAuditCounts }
    | { status: 'rolled_back'; counts: ImportAuditCounts; error: string }
): void {
  const file = readFile();
  const entry = file.entries.find((e) => e.id === id);
  if (!entry) {
    log('[ImportAudit] finalize: entry not found id=' + id
      + ' (evicted?) status=' + outcome.status, 'warn');
    return;
  }
  entry.status = outcome.status;
  entry.counts = outcome.counts;
  if (outcome.status === 'rolled_back') entry.error = outcome.error;
  writeFile(file);
  log('[ImportAudit] finalize id=' + id + ' status=' + outcome.status
    + ' added=' + outcome.counts.added
    + ' updated=' + outcome.counts.updated
    + ' renamed=' + outcome.counts.renamed
    + ' skipped=' + outcome.counts.skipped
    + (outcome.status === 'rolled_back' ? ' error=' + outcome.error : ''), 'info');
}

/** Full audit log (newest last). Used by step 19's error panel and tests. */
export function readImportAudit(): ImportAuditEntry[] {
  return readFile().entries.slice();
}

/** Destructive: wipe the audit log. Only surfaced from the settings UI. */
export function clearImportAudit(): void {
  writeFile(emptyFile());
  log('[ImportAudit] Cleared', 'info');
}
