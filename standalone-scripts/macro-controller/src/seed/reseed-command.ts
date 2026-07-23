/**
 * reseed-command.ts — on-demand recovery for the Plan/Next prompt library.
 *
 * Root cause it addresses: users can end up with missing default rows (e.g.
 * a partial seed on first boot) or stale bodies (user-customized entries
 * that they now want reset to the canonical defaults). Instead of asking
 * users to open the browser DB console or reinstall the extension, expose
 * two safe recovery paths:
 *
 *   1. `reseedPromptsOnDemand()`            — idempotent re-run of the
 *      normal seeder (insert-or-ignore + legacy-body upgrade). Preserves
 *      user-authored edits. This is the default recovery path.
 *
 *   2. `reseedPromptsOnDemand({ force: true })` — HARD reset: rewrites the
 *      body/name of every `PLAN_NEXT_SEED_ROWS` default row back to its
 *      canonical value AND ensures rows exist. Destroys user edits on the
 *      `plan-default` / `next-default` slugs only.
 *
 * Exposed via:
 *   - `window.__marcoReseedPrompts(opts?)` for console/CLI recovery.
 *   - Chip gear menu rows "🔄 Re-seed defaults" / "⚠️ Force reset defaults".
 *
 * Errors are surfaced via `logError('ReseedCommand', ...)` and returned in
 * the resolved result — never swallowed.
 */

import { sendToExtension } from '../ui/prompt-loader';
import { logError } from '../error-utils';
import { log } from '../logger';
import { DB_NAME } from '../db/db-name';
import { sqlLit } from '../db/prompt-role-db';
import { PLAN_NEXT_SEED_ROWS } from './plan-next-prompts';
import { seedPlanNextPrompts } from './seed-plan-next';
import { emitPromptSeedEvent } from '../telemetry/prompt-seed-telemetry';

export interface ReseedOptions {
  /** When true, overwrite existing default rows (destructive). */
  force?: boolean;
}

export interface ReseedResult {
  ok: boolean;
  mode: 'idempotent' | 'force';
  /** Number of default rows overwritten in force mode. */
  forcedUpdates?: number;
  error?: string;
}

interface RawSqlResp { isOk: boolean; rows?: unknown[]; errorMessage?: string }

const EV_RESEED_COMPLETE = 'reseed.complete' as const;



async function rawSql(method: 'QUERY' | 'SCHEMA', sql: string): Promise<RawSqlResp> {
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME, method, endpoint: 'rawSql', params: { sql },
  });
  return (resp as RawSqlResp) ?? { isOk: false, errorMessage: 'no response' };
}

async function forceResetDefaultBodies(): Promise<{ forced: number; error?: string }> {
  let forced = 0;
  const now = Date.now();
  for (const row of PLAN_NEXT_SEED_ROWS.filter(r => r.isDefault)) {
    const updateSql =
      'UPDATE Prompt SET Body = ' + sqlLit(row.body)
      + ', Name = ' + sqlLit(row.name)
      + ', IsDefault = 1'
      + ', UpdatedAt = ' + String(now)
      + ' WHERE Slug = ' + sqlLit(row.slug);
    const resp = await rawSql('SCHEMA', updateSql);
    if (!resp.isOk) {
      const message = 'force update failed for ' + row.slug + ': ' + (resp.errorMessage ?? '?');
      logError('ReseedCommand', message);
      emitPromptSeedEvent({
        event: 'reseed.force', role: row.role, slug: row.slug,
        outcome: 'failed', detail: message,
      });
      return { forced, error: message };
    }
    forced += 1;
    emitPromptSeedEvent({
      event: 'reseed.force', role: row.role, slug: row.slug,
      outcome: 'ok', metrics: { bodyLen: row.body.length },
    });
  }
  return { forced };
}

/**
 * Re-seed and (optionally) hard-reset the Plan/Next default prompts.
 * Idempotent by default. Safe to call multiple times.
 */
export async function reseedPromptsOnDemand(opts: ReseedOptions = {}): Promise<ReseedResult> {
  const force = opts.force === true;
  const mode: 'idempotent' | 'force' = force ? 'force' : 'idempotent';
  emitPromptSeedEvent({ event: 'reseed.start', outcome: 'ok', detail: mode });
  try {
    // Always run the normal seeder first so missing rows are inserted and
    // legacy bodies get their non-destructive checksum upgrade.
    const seedResult = await seedPlanNextPrompts();
    if (!seedResult.ok) {
      emitPromptSeedEvent({
        event: EV_RESEED_COMPLETE, outcome: 'failed',
        detail: 'seedPlanNextPrompts: ' + (seedResult.error ?? '?'),
      });
      return { ok: false, mode, error: seedResult.error ?? 'seed failed' };
    }
    let forcedUpdates: number | undefined;
    if (force) {
      const { forced, error } = await forceResetDefaultBodies();
      forcedUpdates = forced;
      if (error) {
        emitPromptSeedEvent({
          event: EV_RESEED_COMPLETE, outcome: 'failed', detail: error,
          metrics: { forcedUpdates: forced },
        });
        return { ok: false, mode, forcedUpdates: forced, error };
      }
    }
    log('[ReseedCommand] on-demand reseed complete (' + mode + ')', 'success');
    const completeEvent: Parameters<typeof emitPromptSeedEvent>[0] = {
      event: EV_RESEED_COMPLETE, outcome: 'ok', detail: mode,
    };
    if (forcedUpdates !== undefined) completeEvent.metrics = { forcedUpdates };
    emitPromptSeedEvent(completeEvent);
    const result: ReseedResult = { ok: true, mode };
    if (forcedUpdates !== undefined) result.forcedUpdates = forcedUpdates;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('ReseedCommand', 'reseedPromptsOnDemand threw', err);
    emitPromptSeedEvent({ event: EV_RESEED_COMPLETE, outcome: 'failed', detail: message });
    return { ok: false, mode, error: message };
  }
}

/**
 * Attach the console/CLI entry point on `window.__marcoReseedPrompts` so
 * users can run recovery from DevTools without importing anything:
 *   await window.__marcoReseedPrompts()               // idempotent
 *   await window.__marcoReseedPrompts({ force: true }) // hard reset
 * Idempotent installer — safe to call more than once.
 */
export function installReseedCommandGlobal(): void {
  const w = window;
  if (!w.__marcoReseedPrompts) {
    w.__marcoReseedPrompts = reseedPromptsOnDemand;
    log('[ReseedCommand] window.__marcoReseedPrompts installed', 'info');
  }
  if (!w.__marcoCheckPromptHealth) {
    w.__marcoCheckPromptHealth = async () => {
      const { runPromptHealthCheck } = await import('./prompt-health-check');
      return runPromptHealthCheck();
    };
    log('[ReseedCommand] window.__marcoCheckPromptHealth installed', 'info');
  }
}
