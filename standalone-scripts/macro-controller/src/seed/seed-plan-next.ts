/**
 * seed-plan-next.ts - idempotent seeder for the Plan/Next prompt library
 * (plan-14, step 9). Emits structured boot telemetry (v4.72.0):
 *   { role, inserted, skipped, promotedDefault, alreadyDefault }
 *
 * `INSERT OR IGNORE` on Slug preserves user edits across boots; a pre-query
 * of existing slugs lets us report inserted-vs-already-present counts
 * without racing the driver. Errors are surfaced via
 * `logError('SeedPlanNext', ...)` and never swallowed.
 */

import { logDiagnosticFromCode } from '../error-utils';
import { log } from '../logger';
import { DB_NAME } from '../db/db-name';
import { runSql as runSqlBridge, type SqlBridgeResp } from '../db/sql-bridge';
import { sqlLit } from '../db/prompt-role-db';
import { PLAN_NEXT_SEED_ROWS, getRequiredTokensForRole, NEXT_DEFAULT_LEGACY_BODIES, PLAN_DEFAULT_LEGACY_BODIES } from './plan-next-prompts';

// Re-export the canonical required-tokens helper so callers that already
// depend on the seeder module do not have to reach into `plan-next-prompts`
// directly (remaining-item #3: seed-plan-next.ts is the documented home).
export { getRequiredTokensForRole };
import {
    REPLACE_KEY_DEFAULT,
    REPLACE_VALUES_DEFAULT,
    REPLACE_VALUES_DEFAULT_JSON,
} from '../db/prompt-defaults';
import type { PromptRole } from '../types/prompt-role';
import { StorageKey } from '../types/storage-keys';
import { emitPromptSeedEvent } from '../telemetry/prompt-seed-telemetry';

type RawSqlResp = SqlBridgeResp;
interface UpgradeMatch {
    isMatch: boolean;
    detail: string;
    legacyIndex: number;
}
interface RoleTelemetry {
    role: PromptRole;
    inserted: number;
    skipped: number;
    promotedDefault: number;
    alreadyDefault: number;
    /** Plan-15 task 14: seeded replace-token key (e.g. `n`). */
    replaceKey: string;
    /** Plan-15 task 14: count of chip values seeded for the role. */
    replaceValueCount: number;
}
interface SeedResult { ok: boolean; error?: string; telemetry?: RoleTelemetry[] }

const NEXT_DEFAULT_CURRENT_MARKERS = [
    '# Next {{n}} steps or tasks (v3.3)',
    'NO RELEASE ON A NEXT-TASK TURN',
    'If I could find you',
] as const;
const PLAN_DEFAULT_CURRENT_MARKERS = [
    '# {{n}} number of steps plan, maximum enforcement (v4.1)',
    'Spec first, then plan',
    'If I could find you',
] as const;

async function rawSql(method: 'QUERY' | 'SCHEMA', sql: string): Promise<RawSqlResp> {
    void DB_NAME;
    return runSqlBridge(method, sql);
}

function buildInsertOrIgnoreSql(now: number): string {
    const values = PLAN_NEXT_SEED_ROWS.map(r => {
        return '(' + [
            sqlLit(r.slug), sqlLit(r.name), sqlLit(r.body),
            sqlLit(r.role), '0',
            sqlLit(REPLACE_KEY_DEFAULT), sqlLit(REPLACE_VALUES_DEFAULT_JSON),
            String(now), String(now),
        ].join(', ') + ')';
    }).join(', ');
    return 'INSERT OR IGNORE INTO Prompt '
        + '(Slug, Name, Body, Role, IsDefault, ReplaceKey, ReplaceValues, CreatedAt, UpdatedAt) VALUES '
        + values;
}

async function selectExistingSlugs(): Promise<Set<string>> {
    const list = PLAN_NEXT_SEED_ROWS.map(r => sqlLit(r.slug)).join(', ');
    const sql = 'SELECT Slug FROM Prompt WHERE Slug IN (' + list + ')';
    const resp = await rawSql('QUERY', sql);
    const out = new Set<string>();
    if (!resp.isOk || !Array.isArray(resp.rows)) return out;
    for (const row of resp.rows) {
        const slug = (row as { Slug?: unknown }).Slug;
        if (typeof slug === 'string') out.add(slug);
    }
    return out;
}

async function hasDefaultForRole(role: PromptRole): Promise<boolean> {
    const sql = 'SELECT 1 FROM Prompt WHERE Role = ' + sqlLit(role)
        + ' AND IsDefault = 1 LIMIT 1';
    const resp = await rawSql('QUERY', sql);
    if (!resp.isOk) return false;
    return Array.isArray(resp.rows) && resp.rows.length > 0;
}

async function promoteSeedDefault(role: PromptRole, slug: string): Promise<boolean> {
    const sql = 'UPDATE Prompt SET IsDefault = 1 WHERE Slug = '
        + sqlLit(slug) + ' AND Role = ' + sqlLit(role);
    const resp = await rawSql('SCHEMA', sql);
    if (!resp.isOk) {
        const message = resp.errorMessage ?? '?';
        logDiagnosticFromCode('SEED_PROMOTE_E001', { role, slug, reason: message });
        emitPromptSeedEvent({ event: 'seed.promote-default', role, slug, outcome: 'failed', detail: message });
        return false;
    }
    emitPromptSeedEvent({ event: 'seed.promote-default', role, slug, outcome: 'ok' });
    return true;
}

function initTelemetry(): Map<PromptRole, RoleTelemetry> {
    const m = new Map<PromptRole, RoleTelemetry>();
    for (const row of PLAN_NEXT_SEED_ROWS) {
        if (m.has(row.role)) continue;
        m.set(row.role, {
            role: row.role, inserted: 0, skipped: 0,
            promotedDefault: 0, alreadyDefault: 0,
            replaceKey: REPLACE_KEY_DEFAULT,
            replaceValueCount: REPLACE_VALUES_DEFAULT.length,
        });
    }
    return m;
}

function tallyInsertCounts(existing: Set<string>, tel: Map<PromptRole, RoleTelemetry>): void {
    for (const row of PLAN_NEXT_SEED_ROWS) {
        const bucket = tel.get(row.role);
        if (!bucket) continue;
        if (existing.has(row.slug)) bucket.skipped += 1;
        else bucket.inserted += 1;
    }
}

async function promoteDefaultsAndTally(tel: Map<PromptRole, RoleTelemetry>): Promise<void> {
    const defaults = PLAN_NEXT_SEED_ROWS.filter(r => r.isDefault);
    for (const row of defaults) {
        const bucket = tel.get(row.role);
        const already = await hasDefaultForRole(row.role);
        if (already) {
            if (bucket) bucket.alreadyDefault += 1;
            emitPromptSeedEvent({ event: 'seed.promote-default-kept', role: row.role, slug: row.slug, outcome: 'skipped' });
            continue;
        }
        const ok = await promoteSeedDefault(row.role, row.slug);
        if (ok && bucket) bucket.promotedDefault += 1;
    }
}

function persistTelemetry(tel: RoleTelemetry[]): void {
    try {
        const payload = { at: new Date().toISOString(), roles: tel };
        localStorage.setItem(StorageKey.LastSeedTelemetry, JSON.stringify(payload));
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logDiagnosticFromCode('SEED_TELEMETRY_E001', { reason }, err);
    }
}

function emitTelemetry(tel: RoleTelemetry[]): void {
    const summary = tel.map(t => t.role + ': +' + t.inserted + ' / =' + t.skipped
        + ' (default ' + (t.promotedDefault > 0 ? 'promoted' : 'kept') + ')').join(', ');
    log('[SeedPlanNext] ' + summary + ' | ' + JSON.stringify(tel), 'success');
    persistTelemetry(tel);
}

/**
 * Upgrade un-customized legacy default rows to the current shipped body.
 *
 * Root cause this fixes (v4.170.5): `INSERT OR IGNORE` in the seeder never
 * refreshes existing rows, so users who booted a prior version see the
 * stale `NEXT_DEFAULT_BODY` forever, and the chip's "Edit default" gear
 * opens with content that no longer matches the mirrored `.md` file.
 *
 * The upgrade fires when the current DB body matches a shipped legacy body
 * after normalization, or when `next-default` still has the managed Next
 * prompt shape but is missing current v3.3 markers. User-authored edits are
 * preserved when they do not match those managed shapes. Errors are logged,
 * never swallowed.
 */
function legacyBodiesForSlug(slug: string): readonly string[] {
    if (slug === 'next-default') return NEXT_DEFAULT_LEGACY_BODIES;
    if (slug === 'plan-default') return PLAN_DEFAULT_LEGACY_BODIES;
    return [];
}

function normalizePromptBody(body: string): string {
    return body.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function findLegacyBodyIndex(currentBody: string, legacyBodies: readonly string[]): number {
    const normalizedCurrent = normalizePromptBody(currentBody);
    return legacyBodies.findIndex(body => normalizePromptBody(body) === normalizedCurrent);
}

function hasCurrentNextMarkers(body: string): boolean {
    return NEXT_DEFAULT_CURRENT_MARKERS.every(marker => body.includes(marker));
}

function hasCurrentPlanMarkers(body: string): boolean {
    return PLAN_DEFAULT_CURRENT_MARKERS.every(marker => body.includes(marker));
}

function isManagedNextPromptDrift(slug: string, body: string): boolean {
    const normalized = normalizePromptBody(body).toLowerCase();
    const hasNextHeading = normalized.startsWith('# next ');
    const hasToken = normalized.includes('{{n}}') || normalized.includes('${n}');
    const hasManagedShape = normalized.includes('exactly') && normalized.includes('remaining');
    return slug === 'next-default' && hasNextHeading && hasToken && hasManagedShape && !hasCurrentNextMarkers(body);
}

function isManagedPlanPromptDrift(slug: string, body: string): boolean {
    const normalized = normalizePromptBody(body).toLowerCase();
    const hasPlanHeading = normalized.startsWith('# ') && normalized.includes('plan');
    const hasToken = normalized.includes('{{n}}') || normalized.includes('${n}');
    const hasManagedShape = normalized.includes('parse the number') || normalized.includes('step count is law');
    return slug === 'plan-default' && hasPlanHeading && hasToken && hasManagedShape && !hasCurrentPlanMarkers(body);
}

function isBundledDefaultDrift(row: typeof PLAN_NEXT_SEED_ROWS[number], body: string): boolean {
    if (!row.isDefault) return false;
    if (normalizePromptBody(body) === normalizePromptBody(row.body)) return false;
    if (row.slug === 'plan-default') return isManagedPlanDefault(body);
    if (row.slug === 'next-default') return isManagedNextDefault(body);
    return false;
}

function isManagedPlanDefault(body: string): boolean {
    const normalized = normalizePromptBody(body).toLowerCase();
    const hasToken = normalized.includes('{{n}}') || normalized.includes('${n}');
    const hasManagedShape = normalized.includes('parse the number') || normalized.includes('step count is law');
    return normalized.startsWith('# ') && normalized.includes('plan') && hasToken && hasManagedShape;
}

function isManagedNextDefault(body: string): boolean {
    const normalized = normalizePromptBody(body).toLowerCase();
    const hasToken = normalized.includes('{{n}}') || normalized.includes('${n}');
    const hasManagedShape = normalized.includes('exactly') && normalized.includes('remaining');
    return normalized.startsWith('# next ') && normalized.includes('steps') && hasToken && hasManagedShape;
}

function resolveUpgradeMatch(row: typeof PLAN_NEXT_SEED_ROWS[number], currentBody: string): UpgradeMatch {
    const legacyIndex = findLegacyBodyIndex(currentBody, legacyBodiesForSlug(row.slug));
    if (legacyIndex >= 0) return { isMatch: true, detail: 'legacy-body', legacyIndex };
    if (isBundledDefaultDrift(row, currentBody)) {
        return { isMatch: true, detail: 'bundled-default-drift', legacyIndex: -1 };
    }
    if (isManagedPlanPromptDrift(row.slug, currentBody)) {
        return { isMatch: true, detail: 'managed-plan-drift', legacyIndex: -1 };
    }
    if (isManagedNextPromptDrift(row.slug, currentBody)) {
        return { isMatch: true, detail: 'managed-next-drift', legacyIndex: -1 };
    }
    return { isMatch: false, detail: 'user-customized', legacyIndex: -1 };
}

async function readCurrentBody(slug: string): Promise<string | null> {
    const readSql = 'SELECT Body FROM Prompt WHERE Slug = ' + sqlLit(slug) + ' LIMIT 1';
    const readResp = await rawSql('QUERY', readSql);
    if (!readResp.isOk || !Array.isArray(readResp.rows) || readResp.rows.length === 0) return null;
    const body = (readResp.rows[0] as { Body?: unknown }).Body;
    return typeof body === 'string' ? body : null;
}

function emitLegacySkip(row: typeof PLAN_NEXT_SEED_ROWS[number], detail: string, bodyLen?: number): void {
    const event: Parameters<typeof emitPromptSeedEvent>[0] = {
        event: 'seed.legacy-upgrade-skip', role: row.role, slug: row.slug,
        outcome: 'skipped', detail,
    };
    if (bodyLen !== undefined) event.metrics = { bodyLen };
    emitPromptSeedEvent(event);
}

function buildBodyUpdateSql(row: typeof PLAN_NEXT_SEED_ROWS[number]): string {
    return 'UPDATE Prompt SET Body = ' + sqlLit(row.body)
        + ', UpdatedAt = ' + String(Date.now())
        + ' WHERE Slug = ' + sqlLit(row.slug);
}

function emitLegacyUpgradeFailure(
    row: typeof PLAN_NEXT_SEED_ROWS[number],
    match: UpgradeMatch,
    message: string,
): void {
    logDiagnosticFromCode('SEED_LEGACY_UPGRADE_E001', { role: row.role, slug: row.slug, reason: message });
    emitPromptSeedEvent({
        event: 'seed.legacy-upgrade', role: row.role, slug: row.slug,
        outcome: 'failed', detail: message, metrics: { legacyIndex: match.legacyIndex },
    });
}

function emitLegacyUpgradeOk(row: typeof PLAN_NEXT_SEED_ROWS[number], match: UpgradeMatch): void {
    emitPromptSeedEvent({
        event: 'seed.legacy-upgrade', role: row.role, slug: row.slug,
        outcome: 'ok', detail: match.detail,
        metrics: { legacyIndex: match.legacyIndex, newBodyLen: row.body.length },
    });
}

async function applyLegacyBodyUpgrade(
    row: typeof PLAN_NEXT_SEED_ROWS[number],
    match: UpgradeMatch,
): Promise<boolean> {
    const updateResp = await rawSql('SCHEMA', buildBodyUpdateSql(row));
    if (!updateResp.isOk) {
        emitLegacyUpgradeFailure(row, match, updateResp.errorMessage ?? '?');
        return false;
    }
    emitLegacyUpgradeOk(row, match);
    log('[SeedPlanNext] Upgraded legacy default body for ' + row.slug, 'success');
    return true;
}

async function upgradeLegacyBodyForRow(row: typeof PLAN_NEXT_SEED_ROWS[number]): Promise<boolean> {
    const legacyBodies = legacyBodiesForSlug(row.slug);
    if (legacyBodies.length === 0) return false;
    const currentBody = await readCurrentBody(row.slug);
    if (currentBody === null) { emitLegacySkip(row, 'row-missing'); return false; }
    if (currentBody === row.body) { emitLegacySkip(row, 'already-current'); return false; }
    const match = resolveUpgradeMatch(row, currentBody);
    if (!match.isMatch) {
        emitLegacySkip(row, match.detail, currentBody.length);
        return false;
    }
    return applyLegacyBodyUpgrade(row, match);
}

async function upgradeLegacyDefaultBodies(): Promise<number> {
    let upgraded = 0;
    for (const row of PLAN_NEXT_SEED_ROWS.filter(r => r.isDefault)) {
        const applied = await upgradeLegacyBodyForRow(row);
        if (applied) upgraded += 1;
    }
    return upgraded;
}

/**
 * Persist a durable audit-log row into `PromptSeedAudit` each time the seeder
 * makes an observable change (insert / promote / legacy-body upgrade). Rows
 * are never overwritten, so a reviewer can trace when defaults were seeded
 * across boots by querying `SELECT * FROM PromptSeedAudit ORDER BY SeededAt`.
 * A no-op boot (everything already present, nothing promoted, nothing
 * upgraded) is deliberately NOT written to avoid log spam.
 */
async function writeSeedAuditRow(params: {
    telemetry: RoleTelemetry[];
    inserted: number;
    skipped: number;
    upgraded: number;
    reason: string;
}): Promise<void> {
    const promoted = params.telemetry.reduce((s, t) => s + t.promotedDefault, 0);
    if (params.inserted === 0 && promoted === 0 && params.upgraded === 0) {
        emitPromptSeedEvent({
            event: 'seed.audit-skip', outcome: 'skipped',
            detail: 'no-observable-change',
            metrics: { inserted: 0, promoted: 0, upgraded: 0 },
        });
        return;
    }
    let version = '';
    try {
        const mod = await import('../shared-state');
        version = typeof mod.VERSION === 'string' ? mod.VERSION : '';
    } catch { /* version is best-effort */ }
    const sql = 'INSERT INTO PromptSeedAudit '
        + '(SeededAt, AppVersion, InsertedTotal, SkippedTotal, PromotedTotal, UpgradedTotal, Reason, TelemetryJson) VALUES ('
        + [
            String(Date.now()),
            sqlLit(version),
            String(params.inserted),
            String(params.skipped),
            String(promoted),
            String(params.upgraded),
            sqlLit(params.reason),
            sqlLit(JSON.stringify(params.telemetry)),
        ].join(', ') + ')';
    const resp = await rawSql('SCHEMA', sql);
    if (!resp.isOk) {
        const message = resp.errorMessage ?? '?';
        logDiagnosticFromCode('SEED_AUDIT_E001', { reason: message });
        emitPromptSeedEvent({ event: 'seed.audit-write', outcome: 'failed', detail: message });
        return;
    }
    emitPromptSeedEvent({
        event: 'seed.audit-write', outcome: 'ok',
        metrics: { inserted: params.inserted, promoted, upgraded: params.upgraded },
    });
}


export async function seedPlanNextPrompts(): Promise<SeedResult> {
    const startedAt = Date.now();
    emitPromptSeedEvent({ event: 'seed.start', outcome: 'ok' });
    try {
        const tel = initTelemetry();
        const existing = await selectExistingSlugs();
        tallyInsertCounts(existing, tel);
        const insertResp = await rawSql('SCHEMA', buildInsertOrIgnoreSql(Date.now()));
        if (!insertResp.isOk) {
            const message = 'insert-or-ignore failed: ' + (insertResp.errorMessage ?? 'unknown');
            logDiagnosticFromCode('SEED_INSERT_E001', {
                role: 'all', reason: message, boot: 'true', dbVersion: DB_NAME,
            });
            emitPromptSeedEvent({ event: 'seed.insert-or-ignore', outcome: 'failed', detail: message });
            emitPromptSeedEvent({
                event: 'seed.failed', outcome: 'failed', detail: message,
                metrics: { elapsedMs: Date.now() - startedAt },
            });
            return { ok: false, error: message };
        }
        const insertedTotal = Array.from(tel.values()).reduce((s, t) => s + t.inserted, 0);
        const skippedTotal = Array.from(tel.values()).reduce((s, t) => s + t.skipped, 0);
        emitPromptSeedEvent({
            event: 'seed.insert-or-ignore', outcome: 'ok',
            metrics: { inserted: insertedTotal, skipped: skippedTotal },
        });
        const upgradedTotal = await upgradeLegacyDefaultBodies();
        await promoteDefaultsAndTally(tel);
        const telemetry = Array.from(tel.values());
        emitTelemetry(telemetry);
        await writeSeedAuditRow({
            telemetry,
            inserted: insertedTotal,
            skipped: skippedTotal,
            upgraded: upgradedTotal,
            reason: 'boot',
        });
        emitPromptSeedEvent({
            event: 'seed.complete', outcome: 'ok',
            metrics: {
                elapsedMs: Date.now() - startedAt,
                inserted: insertedTotal,
                skipped: skippedTotal,
                promoted: telemetry.reduce((s, t) => s + t.promotedDefault, 0),
            },
        });
        return { ok: true, telemetry };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logDiagnosticFromCode('SEED_INSERT_E001', {
            role: 'all', reason: message, boot: 'true', dbVersion: DB_NAME,
        }, err);
        emitPromptSeedEvent({
            event: 'seed.failed', outcome: 'failed', detail: message,
            metrics: { elapsedMs: Date.now() - startedAt },
        });
        return { ok: false, error: message };
    }
}
