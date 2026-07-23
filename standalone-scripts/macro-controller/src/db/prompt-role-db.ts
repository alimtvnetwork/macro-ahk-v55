/**
 * prompt-role-db.ts - role-scoped Prompt table helpers (plan-14, step 4).
 *
 * `enforceSingleDefaultPerRole(role, keepId)` atomically clears
 * `IsDefault=1` on every Prompt row whose `Role` matches `role` EXCEPT
 * the row identified by `keepId`, and sets that row's `IsDefault=1`.
 * Wrapping BEGIN/COMMIT in a single rawSql payload ensures the two
 * UPDATEs land as one transaction; if the driver rejects the batch,
 * neither statement is applied.
 *
 * Root cause this prevents: without a transactional flip, a concurrent
 * caller could observe zero-defaults or two-defaults for the same role,
 * which would make `getDefaultPromptForRole()` (step 5) return either
 * `undefined` or a nondeterministic row.
 */

import { sendToExtension } from '../ui/prompt-loader';
import { logDiagnosticFromCode } from '../error-utils';
import { DB_NAME } from './db-name';
import { isPromptRole, type PromptRole } from '../types/prompt-role';

export interface EnforceResult {
    ok: boolean;
    error?: string;
}

/** Escape a SQL string literal (single-quote doubling). Exported for CRUD reuse. */
export function sqlLit(s: string): string {
    return "'" + s.replace(/'/g, "''") + "'";
}

/**
 * Clear IsDefault on all rows for `role` except `keepId`, then set
 * `IsDefault=1` on `keepId`. Rejects unknown roles up front so bad
 * data cannot reach the DB layer.
 */
export async function enforceSingleDefaultPerRole(role: PromptRole, keepId: number): Promise<EnforceResult> {
    if (!isPromptRole(role)) {
        const err = 'enforceSingleDefaultPerRole: invalid role ' + String(role);
        logDiagnosticFromCode('DB_ROLE_ENFORCE_E001', { role: String(role), keepId, stage: 'validate-role', reason: 'invalid role' });
        return { ok: false, error: err };
    }
    if (!Number.isInteger(keepId) || keepId <= 0) {
        const err = 'enforceSingleDefaultPerRole: keepId must be a positive integer, got ' + String(keepId);
        logDiagnosticFromCode('DB_ROLE_ENFORCE_E001', { role, keepId: String(keepId), stage: 'validate-keepId', reason: 'keepId must be a positive integer' });
        return { ok: false, error: err };
    }

    const sql = [
        'BEGIN TRANSACTION;',
        'UPDATE Prompt SET IsDefault = 0 WHERE Role = ' + sqlLit(role) + ' AND Id <> ' + keepId + ';',
        'UPDATE Prompt SET IsDefault = 1 WHERE Id = ' + keepId + ' AND Role = ' + sqlLit(role) + ';',
        'COMMIT;',
    ].join('\n');

    try {
        const resp = await sendToExtension('PROJECT_API', {
            project: DB_NAME,
            method: 'SCHEMA',
            endpoint: 'rawSql',
            params: { sql },
        });
        if (resp && resp.isOk) return { ok: true };
        const reason = resp?.errorMessage || 'unknown error';
        const message = 'enforceSingleDefaultPerRole failed: ' + reason;
        logDiagnosticFromCode('DB_ROLE_ENFORCE_E001', { role, keepId, stage: 'rawSql', reason });
        return { ok: false, error: message };
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logDiagnosticFromCode('DB_ROLE_ENFORCE_E001', { role, keepId, stage: 'threw', reason }, err);
        return { ok: false, error: reason };
    }
}
