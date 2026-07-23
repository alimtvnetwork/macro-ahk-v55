/**
 * Plan-10 — WireWorkspace to enrichment-candidate mapper.
 *
 * Consumes the parsed `/user/workspaces` rows (as `WireWorkspace[]`,
 * see `types/wire-workspace.ts`) and produces the flat decision list
 * the batch enricher iterates. Each row carries the pure verdict from
 * `needsBalanceEnrichment` (plan-10 predicate) so the batch call site
 * stays a dumb consumer with no policy branching of its own.
 *
 * The mapper is the second Plan-10 mapping layer + guard: it protects
 * downstream code from ever seeing a shapeless `Record<string, unknown>`
 * and it re-uses the tested predicate rather than duplicating tier/plan
 * rules.
 *
 * v4.130.0: `FreshCacheProbe` widened to `boolean | Promise<boolean>` so
 * async persisted tiers (IndexedDB) can participate without inventing a
 * parallel entry point. Sync probes remain a valid return; the mapper
 * always awaits, so a sync boolean is normalised via `Promise.resolve`.
 */

import type { WireWorkspace } from '../types/wire-workspace';
import { isWireWorkspace, toWireWorkspace } from '../types/wire-workspace';
import { needsBalanceEnrichment } from './needs-balance-enrichment';
import type { NeedsBalanceEnrichmentResult } from './needs-balance-enrichment';

export interface EnrichmentCandidate {
  readonly workspace: WireWorkspace;
  readonly verdict: NeedsBalanceEnrichmentResult;
}

/**
 * Caller-supplied cache probe. Returns (or resolves) true when a fresh
 * row exists for `workspaceId`. Sync boolean returns are supported for
 * the in-memory tier; Promise<boolean> is supported for async persisted
 * tiers (IndexedDB, OPFS). The mapper always awaits.
 */
export type FreshCacheProbe = (workspaceId: string) => boolean | Promise<boolean>;

async function toCandidate(wire: WireWorkspace, hasCache: FreshCacheProbe): Promise<EnrichmentCandidate> {
  const fresh = await Promise.resolve(hasCache(wire.id));
  const verdict = needsBalanceEnrichment({
    workspace: { id: wire.id, plan: wire.plan, tier: wire.tier },
    hasFreshCache: fresh,
  });
  return { workspace: wire, verdict };
}

function narrowRow(row: unknown): WireWorkspace | null {
  if (!isWireWorkspace(row)) return null;
  return toWireWorkspace(row as unknown as Record<string, unknown>);
}

/**
 * Map raw wire rows to enrichment candidates.
 * Shape-invalid rows are dropped (never `unknown` leaks past this fn).
 *
 * Async: awaits the probe per row. Sync probes resolve immediately, so
 * behaviour is unchanged for existing callers.
 */
export async function mapWireToEnrichmentCandidates(
  rawRows: readonly unknown[],
  hasFreshCache: FreshCacheProbe,
): Promise<EnrichmentCandidate[]> {
  const results: EnrichmentCandidate[] = [];
  for (const row of rawRows) {
    const wire = narrowRow(row);
    if (wire === null) continue;
    results.push(await toCandidate(wire, hasFreshCache));
  }
  return results;
}

/** Convenience: only the workspaces that actually need enrichment (verdict.needs === true). */
export function selectEnrichable(candidates: readonly EnrichmentCandidate[]): EnrichmentCandidate[] {
  return candidates.filter((candidate) => candidate.verdict.needs);
}
