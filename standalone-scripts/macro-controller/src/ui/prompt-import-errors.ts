/**
 * Plan 12 step 19-20: structured error codes + typed log helper for the
 * prompts import pipeline.
 *
 * WHY: modal error panel showed `String(err)`; ops could not grep on a
 * stable field; step 27's Playwright E2E needs a machine-readable code
 * to assert on. This file gives every import-path failure a stable
 * `ImportErrorCode`, a user-facing `hint`, and a `logStructured()`
 * emitter that formats every field as `key=value` so shell grep and
 * downstream log aggregators can slice cleanly.
 */

import { log } from '../logger';

export type ImportErrorCode =
  | 'PARSE_INVALID_JSON'
  | 'PARSE_ZIP_CORRUPT'
  | 'PARSE_SQLITE_INVALID'
  | 'PARSE_UNKNOWN_FORMAT'
  | 'PARSE_SCHEMA_MISMATCH'
  | 'PARSE_EMPTY_BUNDLE'
  | 'COMMIT_QUOTA_EXCEEDED'
  | 'COMMIT_IDB_UNAVAILABLE'
  | 'COMMIT_TRANSACTION_ABORTED'
  | 'COMMIT_DOUBLE_FAULT'
  | 'COMMIT_UNKNOWN';

export interface ClassifiedImportError {
  code: ImportErrorCode;
  message: string;
  /** Short user-facing sentence rendered in the modal error panel. */
  hint: string;
  /** Original error, for the `<pre>` details block. */
  original: unknown;
}

function classifyCommitError(err: unknown, name: string, message: string): ClassifiedImportError {
  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    return {
      code: 'COMMIT_QUOTA_EXCEEDED', message, original: err,
      hint: 'Browser storage is full. Delete some prompts or clear the extension\'s IndexedDB and retry.',
    };
  }
  if (/indexeddb is not defined|idb.*unavailable|SecurityError/i.test(message) || name === 'SecurityError') {
    return {
      code: 'COMMIT_IDB_UNAVAILABLE', message, original: err,
      hint: 'IndexedDB is disabled or blocked. Enable third-party storage for this origin.',
    };
  }
  if (name === 'TransactionInactiveError' || /transaction.*(inactive|abort)/i.test(message)) {
    return {
      code: 'COMMIT_TRANSACTION_ABORTED', message, original: err,
      hint: 'The write transaction was aborted mid-flight. Changes were rolled back; retry the import.',
    };
  }
  if (/DOUBLE_FAULT/.test(message)) {
    return {
      code: 'COMMIT_DOUBLE_FAULT', message, original: err,
      hint: 'CRITICAL: rollback itself failed. Your prompt library may be inconsistent. Export a backup NOW.',
    };
  }
  return {
    code: 'COMMIT_UNKNOWN', message, original: err,
    hint: 'Import failed for an unrecognised reason. Changes were rolled back.',
  };
}

function classifyParseError(err: unknown, message: string): ClassifiedImportError {
  if (/JSON envelope invalid|Unexpected token|Failed to parse JSON/i.test(message)) {
    return { code: 'PARSE_INVALID_JSON', message, hint: 'The JSON file is malformed. Open it in a text editor to verify.', original: err };
  }
  if (/zip|EOCD|central directory|compressed/i.test(message)) {
    return { code: 'PARSE_ZIP_CORRUPT', message, hint: 'The ZIP bundle is corrupt or uses compression. Re-export as a store-only ZIP.', original: err };
  }
  if (/sqlite|Meta table|SchemaVersion/i.test(message)) {
    return { code: 'PARSE_SQLITE_INVALID', message, hint: 'The SQLite bundle is missing required tables or the schema version is wrong.', original: err };
  }
  if (/Unknown bundle format|Unknown prompt bundle format|First 16 bytes|PROMPT_IO_FORMAT_E001/i.test(message)) {
    return { code: 'PARSE_UNKNOWN_FORMAT', message, hint: 'File format not recognised. Accepted: JSON, ZIP, SQLite.', original: err };
  }
  if (/schemaVersion/i.test(message)) {
    return { code: 'PARSE_SCHEMA_MISMATCH', message, hint: 'This bundle was made by a newer version. Update the extension and retry.', original: err };
  }
  return { code: 'PARSE_INVALID_JSON', message, hint: 'Failed to parse the file. Check the format and retry.', original: err };
}

/**
 * Best-effort classification of a thrown value into a stable code.
 * Delegates to phase-specific helpers so each stays under the
 * cognitive-complexity threshold.
 */
export function classifyImportError(err: unknown, phase: 'parse' | 'commit'): ClassifiedImportError {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  return phase === 'commit'
    ? classifyCommitError(err, name, message)
    : classifyParseError(err, message);
}

/**
 * Custom error thrown by the atomic commit path so callers can pattern
 * match on `err.code` instead of parsing strings. `cause` preserves the
 * original error for stack-trace forensics.
 */
export class ImportCommitError extends Error {
  readonly code: ImportErrorCode;
  readonly auditId: string;
  readonly cause: unknown;
  readonly hint: string;
  constructor(input: { code: ImportErrorCode; message: string; hint: string; auditId: string; cause: unknown }) {
    super(input.message);
    this.name = 'ImportCommitError';
    this.code = input.code;
    this.auditId = input.auditId;
    this.hint = input.hint;
    this.cause = input.cause;
  }
}

/**
 * Structured log emitter. Formats fields as `key=value` pairs in a
 * single line so grep and log aggregators can slice by any field.
 * Values with spaces are wrapped in double quotes.
 *
 *   logStructured({ namespace: 'ImportCommit', code: 'COMMIT_OK',
 *     level: 'info', fields: { auditId: 'x', added: 3 } })
 *
 *   -> [ImportCommit] code=COMMIT_OK auditId=x added=3
 */
export function logStructured(input: {
  namespace: string;
  code: string;
  level: 'info' | 'warn' | 'error';
  fields?: Record<string, string | number | boolean | null | undefined>;
}): void {
  const parts: string[] = ['code=' + input.code];
  if (input.fields) {
    Object.keys(input.fields).forEach((k) => {
      const v = input.fields![k];
      if (v === undefined) return;
      const value = v === null ? 'null' : String(v);
      const needsQuote = /[\s"=]/.test(value);
      parts.push(k + '=' + (needsQuote ? '"' + value.replace(/"/g, '\\"') + '"' : value));
    });
  }
  log('[' + input.namespace + '] ' + parts.join(' '), input.level);
}
