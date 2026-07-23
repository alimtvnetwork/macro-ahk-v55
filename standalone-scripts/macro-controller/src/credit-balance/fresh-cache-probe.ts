/**
 * Plan-10 follow-up — real freshness probe for `batchRefreshFromWire`.
 *
 * Replaces the `noFreshCache` stub in `ui/panel-controls.ts` (which
 * always returned `false`) with a probe backed by the in-memory tier of
 * `credit-balance-update/credit-balance-cache.ts`. When a workspace
 * already has a fresh cache entry, `needsBalanceEnrichment` short-
 * circuits before the dispatcher, avoiding redundant `/credit-balance`
 * calls and honouring `mem://constraints/no-retry-policy`.
 *
 * We intentionally read the SYNCHRONOUS memory tier only. The mapper is
 * synchronous by contract and awaiting IndexedDB per row would serialise
 * the enrichment pass. Cold-start rows fall through to the dispatcher
 * where the existing 10s per-workspace throttle inside `fetchAndPersist`
 * still applies.
 */

import { readCreditBalanceUpdateCacheSync } from '../credit-balance-update/credit-balance-cache';
import type { FreshCacheProbe } from './wire-workspace-mapper';

export const hasFreshCreditBalanceCache: FreshCacheProbe = function hasFreshCreditBalanceCache(
  workspaceId: string,
): boolean {
  if (!workspaceId) return false;
  return readCreditBalanceUpdateCacheSync(workspaceId) !== null;
};
