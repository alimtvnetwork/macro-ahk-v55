/**
 * Boot-time repair for legacy `plan-default` / `next-default` orphan rows.
 *
 * Root cause: earlier builds shipped a generic-only Prompt table where the
 * `plan-default` and `next-default` slugs lived under `Role='generic'`.
 * When we later introduced role-scoped seeding, `seedPlanNextPrompts()`
 * used INSERT-OR-IGNORE which silently no-ops on UNIQUE(Slug) collisions
 * against those orphan rows. That kept the DB stuck under the wrong role
 * and produced default-editor failures whenever the Plan/Next chip gear
 * tried to open its default.
 *
 * This module runs BEFORE `seedPlanNextPrompts()` at boot: it scans every
 * managed default slug and, when the DB row's `Role` disagrees with the
 * canonical `PLAN_NEXT_SEED_ROWS` role, migrates the row via `upsertPrompt`
 * so the subsequent seed pass observes a well-formed row instead of an
 * orphan under `generic`.
 */

import { PLAN_NEXT_SEED_ROWS } from './plan-next-prompts';
import { getPromptBySlug, upsertPrompt } from '../db/prompt-db';
import { logDiagnosticFromCode } from '../error-utils';

export interface OrphanRepairEntry {
  readonly slug: string;
  readonly fromRole: string;
  readonly toRole: string;
  readonly outcome: 'adopted' | 'skipped-lookup-failed' | 'skipped-missing' | 'skipped-role-ok' | 'failed-upsert';
  readonly reason?: string;
}

export interface OrphanRepairReport {
  readonly inspected: number;
  readonly adopted: number;
  readonly failures: number;
  readonly entries: readonly OrphanRepairEntry[];
}

export async function repairPlanNextOrphans(): Promise<OrphanRepairReport> {
  const entries: OrphanRepairEntry[] = [];
  let adopted = 0;
  let failures = 0;
  const defaults = PLAN_NEXT_SEED_ROWS.filter((r) => r.isDefault);
  for (const row of defaults) {
    const entry = await repairSingleOrphan(row);
    entries.push(entry);
    if (entry.outcome === 'adopted') adopted += 1;
    else if (entry.outcome === 'failed-upsert' || entry.outcome === 'skipped-lookup-failed') failures += 1;
  }
  return { inspected: defaults.length, adopted, failures, entries };
}

async function repairSingleOrphan(seedRow: typeof PLAN_NEXT_SEED_ROWS[number]): Promise<OrphanRepairEntry> {
  const lookup = await getPromptBySlug(seedRow.slug);
  if (!lookup.ok) {
    logDiagnosticFromCode('SEED_ORPHAN_REPAIR_E001', {
      slug: seedRow.slug, fromRole: 'unknown', toRole: seedRow.role,
      stage: 'lookup', reason: lookup.error ?? 'getPromptBySlug returned !ok',
    });
    return { slug: seedRow.slug, fromRole: 'unknown', toRole: seedRow.role, outcome: 'skipped-lookup-failed', reason: lookup.error ?? 'lookup failed' };
  }
  const existing = lookup.value;
  if (!existing) return { slug: seedRow.slug, fromRole: 'absent', toRole: seedRow.role, outcome: 'skipped-missing' };
  if (existing.Role === seedRow.role) return { slug: seedRow.slug, fromRole: existing.Role, toRole: seedRow.role, outcome: 'skipped-role-ok' };
  const saved = await upsertPrompt({
    id: existing.Id, slug: seedRow.slug, name: existing.Name || seedRow.name,
    body: existing.Body || seedRow.body, role: seedRow.role, previousBody: existing.Body,
    previousReplaceKey: existing.ReplaceKey, replaceKey: existing.ReplaceKey,
    replaceValues: existing.ReplaceValues,
  });
  if (!saved.ok) {
    logDiagnosticFromCode('SEED_ORPHAN_REPAIR_E001', {
      slug: seedRow.slug, fromRole: existing.Role, toRole: seedRow.role,
      stage: 'upsert', reason: saved.error ?? 'upsertPrompt returned !ok',
    });
    return { slug: seedRow.slug, fromRole: existing.Role, toRole: seedRow.role, outcome: 'failed-upsert', reason: saved.error ?? 'upsert failed' };
  }
  return { slug: seedRow.slug, fromRole: existing.Role, toRole: seedRow.role, outcome: 'adopted' };
}
