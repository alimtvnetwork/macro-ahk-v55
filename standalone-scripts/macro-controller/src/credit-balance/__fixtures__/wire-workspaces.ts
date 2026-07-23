/**
 * Plan-10 fixtures — canonical `/user/workspaces` wire rows.
 *
 * One curated fixture set that every plan-10 test/integration harness
 * reuses. Keeps test intent readable and prevents fixture drift across
 * `wire-workspace-mapper`, `batch-refresh-from-wire`, and future
 * enrichment E2E specs.
 *
 * All rows are the shape produced by `/user/workspaces` BEFORE the
 * `isWireWorkspace` guard. Callers that want typed rows should pipe
 * these through `toWireWorkspace()`.
 */

/** pro_1 workspace with no fresh cache — should always enrich. */
export const WIRE_PRO_ONE_STALE = Object.freeze({
  id: 'ws-pro-one-stale',
  name: 'Acme Pro One',
  plan: 'pro_1',
  tier: 'PRO',
});

/** pro_0 workspace with no fresh cache — should always enrich. */
export const WIRE_PRO_ZERO_STALE = Object.freeze({
  id: 'ws-pro-zero-stale',
  name: 'Acme Pro Zero',
  plan: 'pro_0',
  tier: 'PRO',
});

/** pro_1 workspace whose cache is fresh — must short-circuit to `cache-fresh`. */
export const WIRE_PRO_ONE_FRESH = Object.freeze({
  id: 'ws-pro-one-fresh',
  name: 'Cached Pro One',
  plan: 'pro_1',
  tier: 'PRO',
});

/** FREE tier row — must never be enriched (mem://features/macro-controller/credit-totals-exclude-free). */
export const WIRE_FREE_TIER = Object.freeze({
  id: 'ws-free',
  name: 'Freebie',
  plan: 'free',
  tier: 'FREE',
});

/** teams / non-enrichable plan — verdict='non-enrichable-plan'. */
export const WIRE_TEAMS_PLAN = Object.freeze({
  id: 'ws-teams',
  name: 'Teams',
  plan: 'teams',
  tier: 'PRO',
});

/** Shape-invalid rows: dropped by `isWireWorkspace`. */
export const WIRE_INVALID_ROWS: readonly unknown[] = Object.freeze([
  null,
  'not-an-object',
  {},
  { id: '' },
  { id: 42 },
]);

/** Full canonical mixed set — feed to the mapper in one shot. */
export const WIRE_CANONICAL_SET: readonly unknown[] = Object.freeze([
  WIRE_PRO_ONE_STALE,
  WIRE_PRO_ZERO_STALE,
  WIRE_PRO_ONE_FRESH,
  WIRE_FREE_TIER,
  WIRE_TEAMS_PLAN,
  ...WIRE_INVALID_ROWS,
]);

/** Freshness probe pre-seeded to mark WIRE_PRO_ONE_FRESH as fresh, others stale. */
export function makeFreshCacheProbe(): (id: string) => boolean {
  return function isFresh(id: string): boolean {
    return id === WIRE_PRO_ONE_FRESH.id;
  };
}
