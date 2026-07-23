/**
 * prompt-revision-db.ts - append-only revision history for the Prompt table.
 *
 * Root problem this solves: `upsertPrompt` (prompt-db.ts) overwrites `Body`
 * in place with no pre-image preserved anywhere. A single bad edit or a bad
 * JSON import destroys the previous customization irreversibly, and the only
 * recovery path today is `Reset to default`, which discards every prior user
 * change. This module records a snapshot of the previous row on every
 * successful update, capped to the last N revisions per Slug.
 *
 * Design notes
 * ------------
 * 1. Insert-only. `recordPromptRevision` never mutates existing rows; the
 *    trim step is a plain `DELETE ... WHERE Id NOT IN (SELECT ... ORDER BY
 *    CreatedAt DESC LIMIT N)` which is deterministic per Slug.
 * 2. The table is keyed by `PromptId` (foreign row Id at the time of write)
 *    AND `Slug` (denormalized) so history survives even if the parent row
 *    is deleted and later recreated with a new Id but the same slug.
 * 3. Every helper returns `DbResult<T>` and routes failures through
 *    `logError('PromptRevisionDb', ...)`. No silent swallow.
 */

import { logDiagnosticFromCode } from '../error-utils';
import { DB_NAME } from './db-name';
import { runSql as runSqlBridge, type SqlBridgeResp } from './sql-bridge';
import { sqlLit } from './prompt-role-db';
import type { PromptRow } from './prompt-db';
import { isPromptRole, type PromptRole } from '../types/prompt-role';

/** Maximum revisions retained per Slug. Older revisions are trimmed on write. */
export const PROMPT_REVISION_LIMIT_PER_SLUG = 20;

export interface PromptRevisionRow {
    Id: number;
    PromptId: number;
    Slug: string;
    Name: string;
    Body: string;
    Role: PromptRole;
    ReplaceKey: string;
    ReplaceValues: string;
    CreatedAt: number;
    Reason: string;
}

export interface DbResult<T> {
    ok: boolean;
    value?: T;
    error?: string;
}

type RawSqlOk = SqlBridgeResp;

async function runSql(method: 'QUERY' | 'SCHEMA', sql: string): Promise<RawSqlOk> {
    void DB_NAME;
    return runSqlBridge(method, sql);
}

function fail<T>(where: string, message: string, context?: unknown): DbResult<T> {
    const slug = extractSlugFromContext(context);
    logDiagnosticFromCode('DB_REVISION_E001', { where, slug, reason: message }, context);
    return { ok: false, error: message };
}

function extractSlugFromContext(context: unknown): string {
    if (context && typeof context === 'object' && 'slug' in context) {
        const s = (context as { slug: unknown }).slug;
        if (typeof s === 'string') return s;
    }
    return 'unknown';
}

function rowToRevision(r: unknown): PromptRevisionRow {
    const o = r as Record<string, unknown>;
    return {
        Id: Number(o.Id),
        PromptId: Number(o.PromptId),
        Slug: String(o.Slug),
        Name: String(o.Name),
        Body: String(o.Body),
        Role: String(o.Role) as PromptRole,
        ReplaceKey: String(o.ReplaceKey ?? ''),
        ReplaceValues: String(o.ReplaceValues ?? '[]'),
        CreatedAt: Number(o.CreatedAt),
        Reason: String(o.Reason ?? ''),
    };
}

export interface RecordRevisionInput {
    /** The row as it existed BEFORE the mutation being recorded. */
    previous: PromptRow;
    /** Short reason code: 'upsert' | 'import' | 'reseed' | 'restore' | 'manual'. */
    reason: string;
}

/**
 * Append `previous` as a revision row, then trim to the newest
 * `PROMPT_REVISION_LIMIT_PER_SLUG` rows for that Slug.
 */
export async function recordPromptRevision(input: RecordRevisionInput): Promise<DbResult<number>> {
    const { previous, reason } = input;
    if (!Number.isInteger(previous.Id) || previous.Id <= 0) {
        return fail('recordPromptRevision', 'previous.Id must be a positive integer');
    }
    if (!isPromptRole(previous.Role)) {
        return fail('recordPromptRevision', 'invalid role ' + String(previous.Role));
    }
    if (typeof previous.Slug !== 'string' || previous.Slug.trim() === '') {
        return fail('recordPromptRevision', 'previous.Slug must be a non-empty string');
    }

    const replaceValuesJson = Array.isArray(previous.ReplaceValues)
        ? JSON.stringify(previous.ReplaceValues)
        : '[]';
    const now = Date.now();
    const cols = 'PromptId, Slug, Name, Body, Role, ReplaceKey, ReplaceValues, CreatedAt, Reason';
    const vals = [
        String(previous.Id),
        sqlLit(previous.Slug),
        sqlLit(previous.Name),
        sqlLit(previous.Body),
        sqlLit(previous.Role),
        sqlLit(previous.ReplaceKey),
        sqlLit(replaceValuesJson),
        String(now),
        sqlLit(reason),
    ].join(', ');
    const insertSql = 'INSERT INTO PromptRevision (' + cols + ') VALUES (' + vals + ')';
    const insertResp = await runSql('SCHEMA', insertSql);
    if (!insertResp.isOk) {
        return fail('recordPromptRevision', insertResp.errorMessage ?? 'insert failed');
    }
    const insertedId = Number(insertResp.lastInsertId ?? 0);

    // Trim to newest PROMPT_REVISION_LIMIT_PER_SLUG entries per slug.
    const trimSql =
        'DELETE FROM PromptRevision WHERE Slug = ' + sqlLit(previous.Slug) +
        ' AND Id NOT IN (SELECT Id FROM PromptRevision WHERE Slug = ' + sqlLit(previous.Slug) +
        ' ORDER BY CreatedAt DESC, Id DESC LIMIT ' + String(PROMPT_REVISION_LIMIT_PER_SLUG) + ')';
    const trimResp = await runSql('SCHEMA', trimSql);
    if (!trimResp.isOk) {
        // Trim failure is not fatal: the insert succeeded, history is preserved
        // (just over-cap). Log so we notice recurring cases.
        logDiagnosticFromCode('DB_REVISION_TRIM_E001', { stage: 'record', slug: previous.Slug, reason: trimResp.errorMessage ?? 'unknown error' });
    }
    return { ok: true, value: insertedId };
}

/**
 * List revisions for a slug, newest first. Empty array if the slug has no
 * history yet or if the row was created but never edited.
 */
export async function listPromptRevisions(slug: string): Promise<DbResult<PromptRevisionRow[]>> {
    if (typeof slug !== 'string' || slug.trim() === '') {
        return fail('listPromptRevisions', 'slug must be a non-empty string');
    }
    const sql =
        'SELECT * FROM PromptRevision WHERE Slug = ' + sqlLit(slug) +
        ' ORDER BY CreatedAt DESC, Id DESC';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return fail('listPromptRevisions', resp.errorMessage ?? 'query failed');
    const rows = Array.isArray(resp.rows) ? resp.rows.map(rowToRevision) : [];
    return { ok: true, value: rows };
}

/** Fetch one revision by Id (used by the future restore UI). */
export async function getPromptRevisionById(id: number): Promise<DbResult<PromptRevisionRow | undefined>> {
    if (!Number.isInteger(id) || id <= 0) {
        return fail('getPromptRevisionById', 'id must be a positive integer');
    }
    const sql = 'SELECT * FROM PromptRevision WHERE Id = ' + String(id) + ' LIMIT 1';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return fail('getPromptRevisionById', resp.errorMessage ?? 'query failed');
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    if (rows.length === 0) return { ok: true, value: undefined };
    return { ok: true, value: rowToRevision(rows[0]) };
}

/**
 * Bulk-insert imported revision rows for a given slug. Preserves each row's
 * original `CreatedAt` and `Reason` (unlike `recordPromptRevision` which is
 * for live pre-image capture). The `PromptId` column is written as `0` to
 * mark the row as "imported from an off-device archive", since the source
 * database's Ids do not exist here. After insertion, the standard trim to
 * `PROMPT_REVISION_LIMIT_PER_SLUG` newest rows is applied per slug.
 *
 * Introduced in v4.183.0 as the inverse of `buildRevisionExportPayload`.
 */
export interface ImportedRevisionInput {
    Slug: string;
    Name: string;
    Body: string;
    Role: PromptRole;
    ReplaceKey: string;
    ReplaceValues: string;
    CreatedAt: number;
    Reason: string;
}

export async function insertImportedRevisions(
    slug: string,
    rows: readonly ImportedRevisionInput[],
): Promise<DbResult<number>> {
    if (typeof slug !== 'string' || slug.trim() === '') {
        return fail('insertImportedRevisions', 'slug must be a non-empty string');
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: true, value: 0 };
    }
    let inserted = 0;
    for (const r of rows) {
        if (r.Slug !== slug) {
            return fail('insertImportedRevisions', 'row slug ' + r.Slug + ' does not match target ' + slug);
        }
        if (!isPromptRole(r.Role)) {
            return fail('insertImportedRevisions', 'invalid role ' + String(r.Role));
        }
        const cols = 'PromptId, Slug, Name, Body, Role, ReplaceKey, ReplaceValues, CreatedAt, Reason';
        const vals = [
            '0',
            sqlLit(r.Slug),
            sqlLit(r.Name),
            sqlLit(r.Body),
            sqlLit(r.Role),
            sqlLit(r.ReplaceKey),
            sqlLit(r.ReplaceValues),
            String(Number.isFinite(r.CreatedAt) ? r.CreatedAt : Date.now()),
            sqlLit(r.Reason || 'import'),
        ].join(', ');
        const insertSql = 'INSERT INTO PromptRevision (' + cols + ') VALUES (' + vals + ')';
        const resp = await runSql('SCHEMA', insertSql);
        if (!resp.isOk) {
            return fail('insertImportedRevisions', resp.errorMessage ?? 'insert failed');
        }
        inserted += 1;
    }
    // Trim per-slug to newest N.
    const trimSql =
        'DELETE FROM PromptRevision WHERE Slug = ' + sqlLit(slug) +
        ' AND Id NOT IN (SELECT Id FROM PromptRevision WHERE Slug = ' + sqlLit(slug) +
        ' ORDER BY CreatedAt DESC, Id DESC LIMIT ' + String(PROMPT_REVISION_LIMIT_PER_SLUG) + ')';
    const trimResp = await runSql('SCHEMA', trimSql);
    if (!trimResp.isOk) {
        logDiagnosticFromCode('DB_REVISION_TRIM_E001', { stage: 'import', slug, reason: trimResp.errorMessage ?? 'unknown error' });
    }
    return { ok: true, value: inserted };
}

/**
 * Return the highest `Id` currently present in `PromptRevision`, or `0` if
 * the table is empty. Used as a snapshot marker BEFORE bulk-inserts so an
 * undo path can identify the just-inserted rows by `Id > snapshot`.
 *
 * Introduced in v4.186.0 to back the Undo affordance on Import JSON.
 */
export async function getMaxRevisionId(): Promise<DbResult<number>> {
    const resp = await runSql('QUERY', 'SELECT MAX(Id) AS MaxId FROM PromptRevision');
    if (!resp.isOk) return fail('getMaxRevisionId', resp.errorMessage ?? 'query failed');
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    const first = rows.length > 0 ? (rows[0] as Record<string, unknown>) : {};
    const raw = first.MaxId;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return { ok: true, value: Number.isFinite(n) ? n : 0 };
}

/**
 * Delete imported-only (`PromptId = 0`) revision rows for `slug` whose `Id`
 * exceeds `sinceId`. Used by the Import Undo path to remove exactly the
 * rows that a completed import wrote, without touching any native or
 * previously-imported history. Safe against post-import trim: trim only
 * removes rows (never renumbers), so `Id > sinceId AND PromptId = 0 AND
 * Slug = ?` still targets the correct subset.
 *
 * Introduced in v4.186.0.
 */
export async function deleteImportedRevisionsAfter(
    slug: string,
    sinceId: number,
): Promise<DbResult<number>> {
    if (typeof slug !== 'string' || slug.trim() === '') {
        return fail('deleteImportedRevisionsAfter', 'slug must be a non-empty string');
    }
    if (!Number.isFinite(sinceId) || sinceId < 0) {
        return fail('deleteImportedRevisionsAfter', 'sinceId must be a non-negative finite number');
    }
    const sql = 'DELETE FROM PromptRevision WHERE Slug = ' + sqlLit(slug)
        + ' AND PromptId = 0 AND Id > ' + String(Math.floor(sinceId));
    const resp = await runSql('SCHEMA', sql);
    if (!resp.isOk) return fail('deleteImportedRevisionsAfter', resp.errorMessage ?? 'delete failed');
    // rawSql does not surface a changes() count reliably across all shims,
    // so callers should not rely on the returned number for anything beyond
    // "the DELETE ran without error". Return 0 as a stable sentinel.
    return { ok: true, value: 0 };
}


