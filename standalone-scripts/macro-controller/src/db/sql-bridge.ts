/**
 * db/sql-bridge.ts - adaptive SQLite bridge.
 *
 * Backend v2 rejects `method: 'QUERY'` and restricts `method: 'SCHEMA'` to
 * `ALTER TABLE` statements. See spec/db-bridge/01-rawsql-contract-v2.md.
 *
 * Every historical caller passed `method: 'QUERY' | 'SCHEMA'` with a raw
 * SQL string. This module preserves that signature but transparently:
 *
 *   1. Classifies the SQL into SELECT / ALTER / WRITE.
 *   2. Tries a per-class list of candidate method names, in order.
 *   3. Caches the first name the backend accepts (per class) for the
 *      lifetime of the page so subsequent calls skip the probe.
 *   4. Retries only on contract-shape errors ("Unsupported method: ..."
 *      and "only ALTER TABLE statements are allowed"). Real SQL errors
 *      (syntax, missing table, no rows) are returned to the caller
 *      unchanged.
 *
 * Return shape matches the historical `{ isOk, rows?, errorMessage?,
 * lastInsertId? }` contract so callers do not need to change.
 */

// NOTE: import via `ui/prompt-loader` (which re-exports `sendToExtension`
// from `ui/extension-relay`) so the historical test mocks that only stub
// `ui/prompt-loader` continue to intercept bridge traffic without every
// call site having to add a second `vi.mock('../ui/extension-relay', ...)`.
import { sendToExtension } from '../ui/prompt-loader';
import { DB_NAME } from './db-name';

export interface SqlBridgeResp {
    isOk: boolean;
    rows?: unknown[];
    errorMessage?: string;
    lastInsertId?: number;
}

export type LegacyMethod = 'QUERY' | 'SCHEMA';
export type Bucket = 'SELECT' | 'ALTER' | 'WRITE';

// Candidate method names, in probe order. The background handler accepts both
// the legacy names and the bridge fallbacks. The fallbacks remain for older
// bundled backgrounds and for future API method-name churn.
const CANDIDATES: Record<Bucket, string[]> = {
    SELECT: ['QUERY', 'SELECT', 'READ', 'EXEC', 'RUN'],
    WRITE: ['SCHEMA', 'EXEC', 'RUN', 'WRITE', 'MUTATE', 'QUERY'],
    ALTER: ['SCHEMA'],
};

// Process-local cache of the winning method per bucket. A fresh page load
// re-probes so a backend rollback heals automatically.
const winning: Partial<Record<Bucket, string>> = {};

export interface SqlBridgeRejection {
    bucket: Bucket;
    method: string;
    message: string;
    at: string; // ISO timestamp
}

// Per-bucket rolling history of contract-shape rejections. Bounded so a long
// session cannot grow unbounded. Consumed by the diagnostics export.
const REJECTION_LIMIT = 10;
const rejections: Record<Bucket, SqlBridgeRejection[]> = {
    SELECT: [], WRITE: [], ALTER: [],
};

function recordRejection(bucket: Bucket, method: string, message: string): void {
    const arr = rejections[bucket];
    arr.push({ bucket, method, message, at: new Date().toISOString() });
    if (arr.length > REJECTION_LIMIT) arr.splice(0, arr.length - REJECTION_LIMIT);
}

export interface SqlBridgeState {
    winning: Record<Bucket, string | null>;
    rejections: Record<Bucket, SqlBridgeRejection[]>;
    candidates: Record<Bucket, string[]>;
}

/**
 * Read the current adaptive-bridge state. Pure and synchronous — safe to call
 * from UI code at click time. Consumed by `seed-diagnostics-panel` to include
 * the accepted rawSql method plus every contract-shape rejection in the
 * downloaded diagnostics ZIP.
 */
export function getSqlBridgeState(): SqlBridgeState {
    const w: Record<Bucket, string | null> = {
        SELECT: winning.SELECT ?? null,
        WRITE: winning.WRITE ?? null,
        ALTER: winning.ALTER ?? null,
    };
    return {
        winning: w,
        rejections: {
            SELECT: [...rejections.SELECT],
            WRITE: [...rejections.WRITE],
            ALTER: [...rejections.ALTER],
        },
        candidates: {
            SELECT: [...CANDIDATES.SELECT],
            WRITE: [...CANDIDATES.WRITE],
            ALTER: [...CANDIDATES.ALTER],
        },
    };
}

/**
 * Invalidate the cached winning method for one bucket (or all). The next
 * `runSql` call for that bucket will re-probe. Used by the Next / picker
 * retry-once path so a stale cache does not surface `PROMPT_LOAD_E001`.
 */
export function resetSqlBridgeCache(bucket?: Bucket): void {
    if (typeof bucket === 'string') { delete winning[bucket]; return; }
    for (const k of Object.keys(winning)) delete winning[k as Bucket];
}

const CONTRACT_ERR_PATTERNS = [
    /^unsupported method:/i,
    /only alter table statements are allowed/i,
];

export function isSqlBridgeContractError(message: string | undefined): boolean {
    return isContractError(message);
}

function isContractError(msg: string | undefined): boolean {
    if (typeof msg !== 'string' || msg.length === 0) return false;
    return CONTRACT_ERR_PATTERNS.some(function(re) { return re.test(msg); });
}

function classify(legacy: LegacyMethod, sql: string): Bucket {
    if (legacy === 'QUERY') return 'SELECT';
    // legacy === 'SCHEMA'
    return /^\s*alter\s+table\b/i.test(sql) ? 'ALTER' : 'WRITE';
}

async function sendOnce(method: string, sql: string, project: string): Promise<SqlBridgeResp> {
    const resp = await sendToExtension('PROJECT_API', {
        project, method, endpoint: 'rawSql', params: { sql },
    });
    return (resp as SqlBridgeResp) ?? { isOk: false, errorMessage: 'no response' };
}

/**
 * Run a SQL statement through the project bridge, adapting to whichever
 * method-name the backend currently accepts.
 */
export async function runSql(legacy: LegacyMethod, sql: string, project: string = DB_NAME): Promise<SqlBridgeResp> {
    const bucket = classify(legacy, sql);
    const cached = winning[bucket];
    if (typeof cached === 'string') {
        const resp = await sendOnce(cached, sql, project);
        if (resp.isOk || !isContractError(resp.errorMessage)) return resp;
        // Cached name went stale (backend rolled forward): invalidate + reprobe.
        recordRejection(bucket, cached, resp.errorMessage ?? 'unknown');
        delete winning[bucket];
    }

    let lastResp: SqlBridgeResp = { isOk: false, errorMessage: 'no candidate methods tried' };
    for (const method of CANDIDATES[bucket]) {
        const resp = await sendOnce(method, sql, project);
        if (resp.isOk) {
            winning[bucket] = method;
            return resp;
        }
        if (!isContractError(resp.errorMessage)) {
            // Real SQL error: return unchanged, don't burn more probes.
            return resp;
        }
        recordRejection(bucket, method, resp.errorMessage ?? 'unknown');
        lastResp = resp;
    }
    return {
        isOk: false,
        errorMessage:
            'sql-bridge: no accepted method for ' + bucket
            + ' (last: ' + (lastResp.errorMessage ?? 'unknown') + ')',
    };
}

/** Test-only: reset the winning-method cache between cases. */
export function _resetSqlBridgeCacheForTest(): void {
    for (const k of Object.keys(winning)) delete winning[k as Bucket];
    rejections.SELECT.length = 0;
    rejections.WRITE.length = 0;
    rejections.ALTER.length = 0;
}

/** Test-only: read the current cache snapshot. */
export function _getSqlBridgeCacheForTest(): Readonly<Partial<Record<Bucket, string>>> {
    return { ...winning };
}

/**
 * Run an async operation and, if it fails with a sql-bridge contract-shape
 * error, reset the cache and retry exactly once. Shared by the Next chip and
 * the picker so both surfaces heal from stale-cache drift the same way.
 *
 * `fn` should return either a thrown error or a `{ ok:false, error }` shape;
 * `isFailure` extracts the human message so we can classify. Return value is
 * whatever `fn` returned (success or the second-attempt failure).
 */
export async function runWithBridgeRetry<T>(
    fn: () => Promise<T>,
    isFailure: (v: T) => string | undefined,
): Promise<T> {
    try {
        const first = await fn();
        const msg = isFailure(first);
        if (msg && isSqlBridgeContractError(msg)) {
            resetSqlBridgeCache();
            return await fn();
        }
        return first;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isSqlBridgeContractError(msg)) {
            resetSqlBridgeCache();
            return await fn();
        }
        throw err;
    }
}