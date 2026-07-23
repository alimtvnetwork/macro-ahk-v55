/**
 * prompt-db.ts - CRUD for the `Prompt` table (plan-14, step 5).
 *
 * Every function is a thin wrapper around a single rawSql call so the
 * happy path is auditable line-by-line, and every error is surfaced via
 * `logError('PromptDb', ...)` (never swallowed) and returned to the
 * caller as `{ok:false, error}` so the UI layer can render it.
 *
 * The `deletePromptById` guard blocks removal of the last row for a
 * given role: this prevents `getDefaultPromptForRole()` from returning
 * `undefined` after a well-meaning user deletes the wrong row, which
 * would collapse the Plan / Next chip fire path.
 */

import { sendToExtension } from '../ui/prompt-loader';
import { logDiagnosticFromCode } from '../error-utils';
import { DB_NAME } from './db-name';
import { isPromptRole, type PromptRole } from '../types/prompt-role';
import { enforceSingleDefaultPerRole, sqlLit, type EnforceResult } from './prompt-role-db';
import { assertParamTokensUnchanged } from './prompt-token-guard';
import {
    REPLACE_KEY_DEFAULT,
    REPLACE_VALUES_DEFAULT,
    decodeReplaceValues,
    encodeReplaceValues,
    normalizeReplaceValues,
    validateReplaceKey,
} from './prompt-defaults';

export interface PromptRow {
    Id: number;
    Slug: string;
    Name: string;
    Body: string;
    Role: PromptRole;
    IsDefault: number;
    ReplaceKey: string;
    ReplaceValues: string[];
    CreatedAt: number;
    UpdatedAt: number;
}

export interface DbResult<T> {
    ok: boolean;
    value?: T;
    error?: string;
}

export interface UpsertInput {
    id?: number | undefined;
    slug: string;
    name: string;
    body: string;
    role: PromptRole;
    /** Existing body when editing an existing plan/next row; enables token-guard check. */
    previousBody?: string | undefined;
    /** Previous ReplaceKey on the row (before this edit). Enables the guard to
     *  treat a legitimate token rename (`{{n}}` -> `{{count}}`) as non-drift. */
    previousReplaceKey?: string | undefined;
    /** Optional replace-token key override. Falls back to `REPLACE_KEY_DEFAULT`. */
    replaceKey?: string | undefined;
    /** Optional replace-values override. Falls back to `REPLACE_VALUES_DEFAULT`. */
    replaceValues?: string[] | undefined;
}

interface RawSqlOk { isOk: boolean; rows?: unknown[]; errorMessage?: string; lastInsertId?: number }

async function runSql(method: 'QUERY' | 'SCHEMA', sql: string): Promise<RawSqlOk> {
    const resp = await sendToExtension('PROJECT_API', {
        project: DB_NAME, method, endpoint: 'rawSql', params: { sql },
    });
    return (resp as RawSqlOk) ?? { isOk: false, errorMessage: 'no response' };
}

function fail<T>(where: string, message: string, context?: unknown): DbResult<T> {
    logDiagnosticFromCode('DB_PROMPT_E001', { where, reason: message }, context);
    return { ok: false, error: message };
}

function rowToPrompt(r: unknown): PromptRow {
    const o = r as Record<string, unknown>;
    const rawKey = typeof o.ReplaceKey === 'string' && o.ReplaceKey.length > 0
        ? o.ReplaceKey : REPLACE_KEY_DEFAULT;
    return {
        Id: Number(o.Id), Slug: String(o.Slug), Name: String(o.Name),
        Body: String(o.Body), Role: String(o.Role) as PromptRole,
        IsDefault: Number(o.IsDefault),
        ReplaceKey: rawKey,
        ReplaceValues: decodeReplaceValues(o.ReplaceValues),
        CreatedAt: Number(o.CreatedAt), UpdatedAt: Number(o.UpdatedAt),
    };
}

/**
 * Resolve the `ReplaceKey` / `ReplaceValues` pair for an upsert, honoring
 * caller overrides but always falling back to the plan-14 defaults so cold
 * boot behaviour is byte-identical for un-customized rows.
 */
function resolveReplaceFields(input: UpsertInput): { key: string; valuesJson: string } | { error: string } {
    const key = typeof input.replaceKey === 'string' ? input.replaceKey : REPLACE_KEY_DEFAULT;
    const keyErr = validateReplaceKey(key);
    if (keyErr !== null) return { error: keyErr };
    const values = typeof input.replaceValues === 'undefined'
        ? [...REPLACE_VALUES_DEFAULT]
        : normalizeReplaceValues(input.replaceValues);
    if (values === null) return { error: 'replaceValues must contain at least one non-empty entry' };
    return { key, valuesJson: encodeReplaceValues(values) };
}

/** List all Prompt rows for `role`, IsDefault DESC then UpdatedAt DESC. */
export async function listPromptsByRole(role: PromptRole): Promise<DbResult<PromptRow[]>> {
    if (!isPromptRole(role)) return fail('listPromptsByRole', 'invalid role ' + String(role));
    const sql = 'SELECT * FROM Prompt WHERE Role = ' + sqlLit(role)
        + ' ORDER BY IsDefault DESC, UpdatedAt DESC';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return fail('listPromptsByRole', resp.errorMessage ?? 'query failed');
    const rows = Array.isArray(resp.rows) ? resp.rows.map(rowToPrompt) : [];
    return { ok: true, value: rows };
}

/** Get the single `IsDefault=1` row for `role`, or `undefined` if none. */
export async function getDefaultPromptForRole(role: PromptRole): Promise<DbResult<PromptRow | undefined>> {
    if (!isPromptRole(role)) return fail('getDefaultPromptForRole', 'invalid role ' + String(role));
    const sql = 'SELECT * FROM Prompt WHERE Role = ' + sqlLit(role)
        + ' AND IsDefault = 1 LIMIT 1';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return fail('getDefaultPromptForRole', resp.errorMessage ?? 'query failed');
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    if (rows.length === 0) return { ok: true, value: undefined };
    return { ok: true, value: rowToPrompt(rows[0]) };
}

/** Get one Prompt row by global slug, regardless of Role. */
export async function getPromptBySlug(slug: string): Promise<DbResult<PromptRow | undefined>> {
    if (slug.trim() === '') {
        return fail('getPromptBySlug', 'slug must not be empty');
    }
    const sql = 'SELECT * FROM Prompt WHERE Slug = ' + sqlLit(slug) + ' LIMIT 1';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) {
        return fail('getPromptBySlug', resp.errorMessage ?? 'query failed');
    }
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    const row = rows.length > 0 ? rowToPrompt(rows[0]) : undefined;

    return { ok: true, value: row };
}

/** Flip the default to `id` for `role` inside a single transaction. */
export async function setDefaultPromptForRole(id: number, role: PromptRole): Promise<EnforceResult> {
    return enforceSingleDefaultPerRole(role, id);
}

interface ResolvedReplace { key: string; valuesJson: string }

function buildInsertSql(input: UpsertInput, resolved: ResolvedReplace, now: number): string {
    const cols = 'Slug, Name, Body, Role, IsDefault, ReplaceKey, ReplaceValues, CreatedAt, UpdatedAt';
    const vals = [
        sqlLit(input.slug), sqlLit(input.name), sqlLit(input.body),
        sqlLit(input.role), '0',
        sqlLit(resolved.key), sqlLit(resolved.valuesJson),
        String(now), String(now),
    ].join(', ');
    return 'INSERT INTO Prompt (' + cols + ') VALUES (' + vals + ')';
}

function buildUpdateSql(input: UpsertInput & { id: number }, resolved: ResolvedReplace, now: number): string {
    return 'UPDATE Prompt SET '
        + 'Slug = ' + sqlLit(input.slug) + ', '
        + 'Name = ' + sqlLit(input.name) + ', '
        + 'Body = ' + sqlLit(input.body) + ', '
        + 'Role = ' + sqlLit(input.role) + ', '
        + 'ReplaceKey = ' + sqlLit(resolved.key) + ', '
        + 'ReplaceValues = ' + sqlLit(resolved.valuesJson) + ', '
        + 'UpdatedAt = ' + String(now)
        + ' WHERE Id = ' + String(input.id);
}

async function resolveInsertedPromptId(input: UpsertInput): Promise<number | null> {
    const sql = 'SELECT Id FROM Prompt WHERE Slug = ' + sqlLit(input.slug)
        + ' AND Role = ' + sqlLit(input.role)
        + ' LIMIT 1';
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return null;
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    const firstRow = rows.length > 0 ? rows[0] as Record<string, object | string | number | null> : null;
    const insertedId = Number(firstRow?.Id ?? 0);
    return Number.isInteger(insertedId) && insertedId > 0 ? insertedId : null;
}

function validateUpsert(input: UpsertInput): string | null {
    if (!isPromptRole(input.role)) return 'invalid role ' + String(input.role);
    if (input.slug.trim() === '') return 'slug must not be empty';
    if (input.name.trim() === '') return 'name must not be empty';
    if (input.body.trim() === '') return 'body must not be empty';
    return null;
}

function checkTokenGuard(input: UpsertInput): string | null {
    const isRoleGuarded = input.role === 'plan' || input.role === 'next';
    const hasPrevious = typeof input.previousBody === 'string';
    if (!isRoleGuarded) return null;
    if (!hasPrevious) return null;
    try {
        const oldKey = typeof input.previousReplaceKey === 'string' ? input.previousReplaceKey : undefined;
        const newKey = typeof input.replaceKey === 'string' ? input.replaceKey : undefined;
        assertParamTokensUnchanged(input.previousBody as string, input.body, { oldKey, newKey });
        return null;
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
}

/**
 * Insert-or-update a Prompt row. For rows where `role in ('plan','next')`
 * and `previousBody` is provided, `assertParamTokensUnchanged` is enforced
 * (plan-14, step 7). Optional `replaceKey` / `replaceValues` overrides are
 * validated and normalized before write (plan-15, task 3).
 */
export async function upsertPrompt(input: UpsertInput): Promise<DbResult<number>> {
    const invalid = validateUpsert(input);
    if (invalid !== null) return fail('upsertPrompt', invalid);
    const tokenErr = checkTokenGuard(input);
    if (tokenErr !== null) return fail('upsertPrompt', tokenErr);
    const resolved = resolveReplaceFields(input);
    if ('error' in resolved) return fail('upsertPrompt', resolved.error);
    const now = Date.now();
    const isUpdate = typeof input.id === 'number';
    // Snapshot the pre-image BEFORE overwriting so a bad edit can be rolled back.
    // Failure to read the previous row is not fatal: proceed with the write and
    // log; a missing history row is strictly better than blocking the save.
    const preImage = isUpdate ? await readPromptRow(input.id as number) : null;
    const sql = isUpdate
        ? buildUpdateSql({ ...input, id: input.id as number }, resolved, now)
        : buildInsertSql(input, resolved, now);
    const resp = await runSql('SCHEMA', sql);
    if (!resp.isOk) return fail('upsertPrompt', resp.errorMessage ?? 'write failed');
    const insertedId = Number(resp.lastInsertId ?? 0);
    const resolvedInsertedId = isUpdate || insertedId > 0 ? null : await resolveInsertedPromptId(input);
    const id = isUpdate ? (input.id as number) : insertedId > 0 ? insertedId : resolvedInsertedId;
    if (id === null) return fail('upsertPrompt', 'insert succeeded but inserted Prompt Id could not be resolved');
    if (preImage !== null) {
        // Fire-and-await revision snapshot. Errors surface via logError inside
        // recordPromptRevision; we never fail the upsert on history failure.
        const { recordPromptRevision } = await import('./prompt-revision-db');
        const revResult = await recordPromptRevision({ previous: preImage, reason: 'upsert' });
        if (!revResult.ok) {
            logDiagnosticFromCode('DB_PROMPT_REVISION_SNAPSHOT_E001', { slug: preImage.Slug, reason: revResult.error ?? 'unknown error' });
        }
    }
    return { ok: true, value: id };
}

async function countRowsForRole(role: PromptRole): Promise<number> {
    const sql = 'SELECT COUNT(*) AS c FROM Prompt WHERE Role = ' + sqlLit(role);
    const resp = await runSql('QUERY', sql);
    if (!resp.isOk) return -1;
    const row = Array.isArray(resp.rows) && resp.rows.length > 0
        ? (resp.rows[0] as Record<string, unknown>) : null;
    return row ? Number(row.c ?? 0) : 0;
}

async function readPromptRow(id: number): Promise<PromptRow | null> {
    const resp = await runSql('QUERY', 'SELECT * FROM Prompt WHERE Id = ' + String(id) + ' LIMIT 1');
    if (!resp.isOk) return null;
    const rows = Array.isArray(resp.rows) ? resp.rows : [];
    return rows.length > 0 ? rowToPrompt(rows[0]) : null;
}

/**
 * Delete a Prompt by Id. Refuses to delete the last remaining row for
 * its role so `getDefaultPromptForRole()` cannot return undefined.
 */
export async function deletePromptById(id: number): Promise<DbResult<void>> {
    if (!Number.isInteger(id) || id <= 0) return fail('deletePromptById', 'id must be a positive integer');
    const row = await readPromptRow(id);
    if (row === null) return fail('deletePromptById', 'row ' + id + ' not found');
    const count = await countRowsForRole(row.Role);
    if (count <= 1) return fail('deletePromptById', 'refuse to delete last row for role ' + row.Role);
    const resp = await runSql('SCHEMA', 'DELETE FROM Prompt WHERE Id = ' + String(id));
    if (!resp.isOk) return fail('deletePromptById', resp.errorMessage ?? 'delete failed');
    return { ok: true };
}
