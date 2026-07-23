/**
 * MacroLoop Controller — Credit Balance Cache (SQLite via marco.kv)
 *
 * Spec: spec/22-app-issues/122a-credit-balance-throttle-and-persistence.md
 *
 * Persists `/workspaces/{id}/credit-balance` responses per workspace so:
 *   - throttle gate survives reloads (no wasted API calls)
 *   - panel can hydrate cold-start numbers before any network roundtrip
 *
 * Read/write goes through `marco.kv` (background SQLite, project-scoped).
 *
 * Key format (PascalCase per mem://architecture/logging-data-contract):
 *   `MacroCreditBalanceCache:{wsId}` →
 *     { WorkspaceId, FetchedAtMs, Source, TotalGranted, TotalRemaining,
 *       TotalBillingUsed, DailyLimit, DailyRemaining, RawJson }
 *
 * NOTE: This file establishes the row schema + KV helpers only. The
 * fetcher, throttle gate and hydrate-on-boot wiring land in later steps.
 *
 * Standards:
 *   - mem://constraints/no-retry-policy — single attempt; failures log.
 *   - mem://constraints/no-storage-pascalcase-migration — NEW kv-key
 *     family, not a rewrite of existing chrome.storage.local keys.
 *   - mem://standards/error-logging-via-namespace-logger — uses logError.
 *   - mem://standards/no-error-swallowing — every catch logs via logError.
 */

import { logError } from '../error-utils';
import { log } from '../logger';
import type { CreditBalanceResponse } from '../types';

const KEY_PREFIX = 'MacroCreditBalanceCache:';

/** Source of a persisted credit-balance row. */
export type CreditBalanceFetchSource = 'auto' | 'batch' | 'manual';

/** Stable row shape stored under each `MacroCreditBalanceCache:{wsId}` key. */
export interface CreditBalanceCacheRow {
    readonly WorkspaceId: string;
    /** Epoch ms when the API call completed. Drives the 10s per-ws throttle. */
    readonly FetchedAtMs: number;
    /** Which path produced this row. */
    readonly Source: CreditBalanceFetchSource;
    readonly TotalGranted: number;
    readonly TotalRemaining: number;
    readonly TotalBillingUsed: number;
    readonly DailyLimit: number;
    readonly DailyRemaining: number;
    /** Verbatim JSON response (string) for diagnostics + future re-parsing. */
    readonly RawJson: string;
}

interface KvBridge {
    kv: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string): Promise<void>;
        delete(key: string): Promise<void>;
        list?(prefix: string): Promise<ReadonlyArray<{ key: string; value: string }>>;
    };
}

function getKv(): KvBridge['kv'] | null {
    const sdk = (window as unknown as { marco?: KvBridge }).marco;
    return sdk && sdk.kv ? sdk.kv : null;
}

function buildKey(workspaceId: string): string {
    return KEY_PREFIX + workspaceId;
}

/** Build a row from a fresh API response (pure — no I/O). */
export function buildRow(
    workspaceId: string,
    response: CreditBalanceResponse,
    source: CreditBalanceFetchSource,
    nowMs: number = Date.now(),
): CreditBalanceCacheRow {
    return {
        WorkspaceId: workspaceId,
        FetchedAtMs: nowMs,
        Source: source,
        TotalGranted: Number(response.total_granted ?? 0),
        TotalRemaining: Number(response.total_remaining ?? 0),
        TotalBillingUsed: Number(response.total_billing_period_used ?? 0),
        DailyLimit: Number(response.daily_limit ?? 0),
        DailyRemaining: Number(response.daily_remaining ?? 0),
        RawJson: JSON.stringify(response),
    };
}

/** Read one workspace's cached credit-balance row. Null on miss / malformed. */
export async function readCreditBalanceCache(
    workspaceId: string,
): Promise<CreditBalanceCacheRow | null> {
    if (!workspaceId) {
        return null;
    }
    const kv = getKv();
    if (!kv) {
        return null;
    }
    try {
        const raw = await kv.get(buildKey(workspaceId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<CreditBalanceCacheRow>;
        const hasShape =
            typeof parsed.WorkspaceId === 'string' &&
            typeof parsed.FetchedAtMs === 'number' &&
            typeof parsed.TotalRemaining === 'number';
        if (!hasShape) {
            return null;
        }
        return parsed as CreditBalanceCacheRow;
    } catch (caught: unknown) {
        logError(
            'CreditBalanceCache.read',
            'kv.get failed for ws=' + workspaceId,
            caught,
        );
        return null;
    }
}

/**
 * Upsert a credit-balance row. Fire-and-forget: resolves immediately while
 * the SQLite write happens in the background.
 */
export function writeCreditBalanceCache(row: CreditBalanceCacheRow): void {
    if (!row.WorkspaceId) {
        return;
    }
    const kv = getKv();
    if (!kv) {
        logError(
            'CreditBalanceCache.write',
            'marco.kv unavailable — skipping SQLite upsert for ws=' + row.WorkspaceId,
        );
        return;
    }
    kv.set(buildKey(row.WorkspaceId), JSON.stringify(row))
        .then(function (): void {
            log(
                'CreditBalanceCache: wrote ws=' + row.WorkspaceId +
                    ' source=' + row.Source +
                    ' remaining=' + row.TotalRemaining,
                'info',
            );
        })
        .catch(function (caught: unknown): void {
            logError(
                'CreditBalanceCache.write',
                'kv.set failed for ws=' + row.WorkspaceId,
                caught,
            );
        });
}

/** Drop one workspace's cache row (debug / future "clear cache" UX). */
export function clearCreditBalanceCache(workspaceId: string): void {
    if (!workspaceId) {
        return;
    }
    const kv = getKv();
    if (!kv) {
        return;
    }
    kv.delete(buildKey(workspaceId)).catch(function (caught: unknown): void {
        logError(
            'CreditBalanceCache.clear',
            'kv.delete failed for ws=' + workspaceId,
            caught,
        );
    });
}

/**
 * Enumerate every cached credit-balance row. Used by the boot hydrator
 * (Task 5) to pre-seed the in-memory throttle map.
 * Returns [] if marco.kv has no `list()` support — caller must tolerate.
 */
export async function listCreditBalanceCache(): Promise<ReadonlyArray<CreditBalanceCacheRow>> {
    const kv = getKv();
    if (!kv || typeof kv.list !== 'function') {
        return [];
    }
    try {
        const entries = await kv.list(KEY_PREFIX);
        const rows: CreditBalanceCacheRow[] = [];
        for (const entry of entries) {
            try {
                const parsed = JSON.parse(entry.value) as Partial<CreditBalanceCacheRow>;
                if (typeof parsed.WorkspaceId === 'string' && typeof parsed.FetchedAtMs === 'number') {
                    rows.push(parsed as CreditBalanceCacheRow);
                }
            } catch (caught: unknown) {
                logError(
                    'CreditBalanceCache.list',
                    'malformed row at key=' + entry.key,
                    caught,
                );
            }
        }
        return rows;
    } catch (caught: unknown) {
        logError('CreditBalanceCache.list', 'kv.list failed', caught);
        return [];
    }
}

export const CREDIT_BALANCE_CACHE_KEY_PREFIX = KEY_PREFIX;
