/**
 * prompt-io-db-bridge.ts - plan-14 steps 12 & 13.
 *
 * Bridges the JSON-cache Import/Export pipeline with the Prompt DB
 * table so user-edited plan/next/generic rows survive an export/import
 * round trip. Entries flagged with `role in ('plan','next','generic')`
 * are routed to `upsertPrompt` (with `previousBody` so the token guard
 * runs on plan/next edits); all other entries stay on the JSON-cache
 * path used since v4.11.
 *
 * Every failure surfaces via `logError('PromptIoDbBridge', ...)` and is
 * returned inside a per-entry error list so the Import dialog can render
 * a real reason instead of a silent count mismatch.
 */

import { logError } from '../error-utils';
import { log } from '../logger';
import { listPromptsByRole, upsertPrompt, type PromptRow } from '../db/prompt-db';
import { isPromptRole, PROMPT_ROLES, type PromptRole } from '../types/prompt-role';
import type { CachedPromptEntry } from './prompt-cache';

export interface DbCommitResults {
    upserted: number;
    errors: string[];
}

export interface PartitionResult {
    dbEntries: CachedPromptEntry[];
    cacheEntries: CachedPromptEntry[];
}

/** Split imported entries by whether they carry a valid `role`. */
export function partitionByRole(entries: readonly CachedPromptEntry[]): PartitionResult {
    const dbEntries: CachedPromptEntry[] = [];
    const cacheEntries: CachedPromptEntry[] = [];
    for (const e of entries) {
        if (isPromptRole(e.role)) dbEntries.push(e);
        else cacheEntries.push(e);
    }
    return { dbEntries, cacheEntries };
}

function dbRowToCached(row: PromptRow): CachedPromptEntry {
    const out: CachedPromptEntry = {
        name: row.Name,
        text: row.Body,
        slug: row.Slug,
        role: row.Role,
        isDefault: row.IsDefault === 1,
        category: 'macro-db',
        replaceKey: row.ReplaceKey,
    };
    if (Array.isArray(row.ReplaceValues)) out.replaceValues = [...row.ReplaceValues];
    return out;
}

async function readAllDbRows(): Promise<PromptRow[]> {
    const all: PromptRow[] = [];
    for (const role of PROMPT_ROLES) {
        const res = await listPromptsByRole(role);
        if (!res.ok || !res.value) {
            logError('PromptIoDbBridge', 'readAllDbRows: listPromptsByRole failed for ' + role, res);
            continue;
        }
        for (const r of res.value) all.push(r);
    }
    return all;
}

/** Read every DB row and map it to a `CachedPromptEntry` for export. */
export async function collectDbEntriesForExport(): Promise<CachedPromptEntry[]> {
    const rows = await readAllDbRows();
    return rows.map(dbRowToCached);
}

/**
 * Merge DB entries into the cached export list. DB rows win on slug so
 * a fresh user edit is never masked by a stale JsonCopy snapshot.
 */
export function mergeDbIntoExport(
    cacheEntries: readonly CachedPromptEntry[],
    dbEntries: readonly CachedPromptEntry[],
): CachedPromptEntry[] {
    const dbSlugs = new Set(dbEntries.map((e) => e.slug).filter((s): s is string => !!s));
    const withoutDb = cacheEntries.filter((e) => !e.slug || !dbSlugs.has(e.slug));
    return [...dbEntries, ...withoutDb];
}

async function findExistingRow(role: PromptRole, slug: string): Promise<PromptRow | null> {
    const res = await listPromptsByRole(role);
    if (!res.ok || !res.value) return null;
    return res.value.find((r) => r.Slug === slug) ?? null;
}

async function commitOneEntry(entry: CachedPromptEntry): Promise<string | null> {
    const role = entry.role;
    if (!isPromptRole(role)) return 'missing role';
    const slug = (entry.slug ?? '').trim();
    if (slug === '') return 'missing slug for role=' + role;
    const existing = await findExistingRow(role, slug);
    const res = await upsertPrompt({
        id: existing?.Id, slug, name: entry.name, body: entry.text,
        role, previousBody: existing?.Body,
        replaceKey: entry.replaceKey,
        replaceValues: entry.replaceValues,
        previousReplaceKey: existing?.ReplaceKey,
    });
    return res.ok ? null : (res.error ?? 'upsert failed');
}

/** Route role-tagged entries to `upsertPrompt`; collect per-entry errors. */
export async function commitDbEntries(entries: readonly CachedPromptEntry[]): Promise<DbCommitResults> {
    const errors: string[] = [];
    let upserted = 0;
    for (const entry of entries) {
        const err = await commitOneEntry(entry);
        if (err === null) upserted++;
        else errors.push('slug=' + (entry.slug ?? '?') + ': ' + err);
    }
    log('PromptIoDbBridge: commitDbEntries upserted=' + upserted + ' errors=' + errors.length, 'info');
    return { upserted, errors };
}
