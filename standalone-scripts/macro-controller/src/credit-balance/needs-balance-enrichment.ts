/**
 * Plan-10 — `needsBalanceEnrichment` helper.
 *
 * Pure predicate that decides whether a single `WorkspaceCredit` row
 * requires a `/workspaces/{id}/credit-balance` enrichment fetch.
 *
 * Enrichment applies to paid tiers only:
 *   - `plan === 'pro_0'` (Pro Zero — see mem://features/macro-controller/pro-zero-credit-balance)
 *   - `plan === 'pro_1'` (Pro One  — see mem://features/macro-controller/post-move-credit-sync)
 *
 * FREE workspaces are excluded per mem://features/macro-controller/credit-totals-exclude-free.
 * Rows without a stable `id` cannot be enriched and are rejected.
 *
 * The helper is intentionally cache-agnostic — the caller supplies the
 * cache-hit check so this stays a synchronous pure function that can be
 * unit-tested without an SQLite bridge. This unblocks:
 *   - the plan-10 batch enricher's queue filter
 *   - the workspace panel's "needs refresh" badge
 *   - future `WireWorkspace` mapping guards
 */

import type { WorkspaceCredit } from '../types/credit-types';

/** Plan literals eligible for /credit-balance enrichment. */
const ENRICHABLE_PLANS: ReadonlySet<string> = new Set(['pro_0', 'pro_1']);

/** FREE tier variants that must never be enriched. */
const FREE_TIER_LITERALS: ReadonlySet<string> = new Set(['free', 'free_tier', 'starter']);

export interface NeedsBalanceEnrichmentInput {
  readonly workspace: Pick<WorkspaceCredit, 'id' | 'plan' | 'tier'>;
  /** True when a fresh (non-stale) cache row already exists for this workspace. */
  readonly hasFreshCache: boolean;
}

export interface NeedsBalanceEnrichmentResult {
  readonly needs: boolean;
  /** Stable machine code so callers/log lines can reason about the decision. */
  readonly reason:
    | 'ok'
    | 'no-id'
    | 'free-tier'
    | 'non-enrichable-plan'
    | 'cache-fresh';
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

/**
 * Returns whether the workspace needs a /credit-balance enrichment call.
 *
 * Decision order (short-circuit):
 *   1. Missing id                    → reason='no-id'
 *   2. FREE tier                     → reason='free-tier'
 *   3. Non-enrichable plan literal   → reason='non-enrichable-plan'
 *   4. Fresh cache already present   → reason='cache-fresh'
 *   5. Otherwise                     → reason='ok', needs=true
 */
export function needsBalanceEnrichment(
  input: NeedsBalanceEnrichmentInput,
): NeedsBalanceEnrichmentResult {
  const wsId = normalize(input.workspace.id);
  if (wsId.length === 0) return { needs: false, reason: 'no-id' };

  const tier = normalize(input.workspace.tier);
  const plan = normalize(input.workspace.plan);
  if (FREE_TIER_LITERALS.has(tier) || FREE_TIER_LITERALS.has(plan)) {
    return { needs: false, reason: 'free-tier' };
  }

  if (!ENRICHABLE_PLANS.has(plan)) {
    return { needs: false, reason: 'non-enrichable-plan' };
  }

  if (input.hasFreshCache) {
    return { needs: false, reason: 'cache-fresh' };
  }

  return { needs: true, reason: 'ok' };
}
