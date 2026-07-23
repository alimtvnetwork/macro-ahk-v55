/**
 * Project Chat Submit — SQLite CRUD (plan 13 step 4)
 *
 * Metadata rows for chat-submit captures. Raw text lives in OPFS
 * (see `../storage/chat-submit-opfs-store.ts`); this module stores
 * only pointers + counters so the SQLite bundle stays lean.
 *
 * Schema (created in `initMacroDb` inside `macro-db.ts`):
 *   ProjectChatSubmit(Id, ProjectId, ProjectName, Source, FileId,
 *                     CharCount, CreatedAt, MetaJson)
 *
 * All string interpolation escapes single quotes exactly the way
 * `macro-db.ts` does (`.replace(/'/g, "''")`) — keep consistent with
 * the existing project-api contract. Every DB failure routes through
 * `logError('ProjectChatSubmitDb', ...)`.
 */

import { logDiagnosticFromCode } from '../error-utils';
import { runSql as runSqlBridge } from './sql-bridge';

// Scope tag retained for future logError() call sites during migration to
// DiagnosticError codes. Referenced via void to keep bundlers from tree-
// shaking it out and to satisfy `noUnusedLocals`.
const SCOPE = 'ProjectChatSubmitDb';
void SCOPE;

export type ChatSubmitSource =
  | 'paste'
  | 'repeat'
  | 'next-chip'
  | 'plan-chip'
  | 'manual';

export interface ChatSubmitRow {
  Id: number;
  ProjectId: string;
  ProjectName: string | null;
  Source: ChatSubmitSource;
  FileId: string;
  CharCount: number;
  CreatedAt: number;
  MetaJson: string | null;
}

export interface ChatSubmitInsertInput {
  projectId: string;
  projectName: string | null;
  source: ChatSubmitSource;
  fileId: string;
  charCount: number;
  createdAt: number;
  metaJson: string | null;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteOrNull(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${escapeSqlLiteral(value)}'`;
}

async function runSchemaSql(sql: string, scope: string): Promise<boolean> {
  try {
    const resp = await runSqlBridge('SCHEMA', sql);
    if (resp?.isOk) return true;
    logDiagnosticFromCode('DB_CHAT_SUBMIT_E001', { op: scope, kind: 'schema-failure', reason: resp?.errorMessage || 'unknown error' });
    return false;
  } catch (err) {
    logDiagnosticFromCode('DB_CHAT_SUBMIT_E001', { op: scope, kind: 'schema-threw', reason: err instanceof Error ? err.message : String(err) }, err);
    return false;
  }
}

async function runQuerySql<T>(sql: string, scope: string): Promise<T[]> {
  try {
    const resp = await runSqlBridge('QUERY', sql);
    if (resp?.isOk && Array.isArray(resp.rows)) return resp.rows as T[];
    logDiagnosticFromCode('DB_CHAT_SUBMIT_E001', { op: scope, kind: 'query-failure', reason: resp?.errorMessage || 'no rows' });
    return [];
  } catch (err) {
    logDiagnosticFromCode('DB_CHAT_SUBMIT_E001', { op: scope, kind: 'query-threw', reason: err instanceof Error ? err.message : String(err) }, err);
    return [];
  }
}

export async function insertChatSubmit(input: ChatSubmitInsertInput): Promise<boolean> {
  const sql = `INSERT INTO ProjectChatSubmit
    (ProjectId, ProjectName, Source, FileId, CharCount, CreatedAt, MetaJson)
    VALUES ('${escapeSqlLiteral(input.projectId)}', ${quoteOrNull(input.projectName)},
    '${escapeSqlLiteral(input.source)}', '${escapeSqlLiteral(input.fileId)}',
    ${Math.max(0, Math.floor(input.charCount))}, ${Math.floor(input.createdAt)},
    ${quoteOrNull(input.metaJson)})`;
  return runSchemaSql(sql, 'insertChatSubmit');
}

export async function countChatSubmits(projectId: string): Promise<number> {
  const sql = `SELECT COUNT(*) AS n FROM ProjectChatSubmit WHERE ProjectId = '${escapeSqlLiteral(projectId)}'`;
  const rows = await runQuerySql<{ n: number }>(sql, 'countChatSubmits');
  return rows.length > 0 ? Number(rows[0].n) || 0 : 0;
}

export async function listRecentChatSubmits(projectId: string, limit: number): Promise<ChatSubmitRow[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const sql = `SELECT * FROM ProjectChatSubmit
    WHERE ProjectId = '${escapeSqlLiteral(projectId)}'
    ORDER BY CreatedAt DESC LIMIT ${safeLimit}`;
  return runQuerySql<ChatSubmitRow>(sql, 'listRecentChatSubmits');
}

export async function listOldestChatSubmits(projectId: string, limit: number): Promise<ChatSubmitRow[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const sql = `SELECT * FROM ProjectChatSubmit
    WHERE ProjectId = '${escapeSqlLiteral(projectId)}'
    ORDER BY CreatedAt ASC LIMIT ${safeLimit}`;
  return runQuerySql<ChatSubmitRow>(sql, 'listOldestChatSubmits');
}

export async function deleteChatSubmit(id: number): Promise<boolean> {
  const sql = `DELETE FROM ProjectChatSubmit WHERE Id = ${Math.floor(id)}`;
  return runSchemaSql(sql, 'deleteChatSubmit');
}

export async function deleteAllChatSubmitsForProject(projectId: string): Promise<boolean> {
  const sql = `DELETE FROM ProjectChatSubmit WHERE ProjectId = '${escapeSqlLiteral(projectId)}'`;
  return runSchemaSql(sql, 'deleteAllChatSubmitsForProject');
}

export async function renameProjectChatSubmits(projectId: string, newName: string): Promise<boolean> {
  const sql = `UPDATE ProjectChatSubmit
    SET ProjectName = '${escapeSqlLiteral(newName)}'
    WHERE ProjectId = '${escapeSqlLiteral(projectId)}'`;
  return runSchemaSql(sql, 'renameProjectChatSubmits');
}
