/**
 * Plan-10, wire-driven entry point for the credit-balance batch refresh.
 *
 * Consumes raw `/user/workspaces` rows, narrows them via the plan-10
 * `WireWorkspace` guard, applies the `needsBalanceEnrichment` predicate
 * (through `mapWireToEnrichmentCandidates`), then decides which rows are
 * `dispatchable` for the dispatcher. This module is the single owner of
 * the plan-literal policy: `dispatchable = enrichable && (allowPlan0 ||
 * plan === PRO_ONE_PLAN_LITERAL)`. The dispatcher itself is now
 * plan-agnostic and just executes the flag.
 */

import { log } from '../logger';
import {
  batchRefreshProOneCreditBalances,
  type BatchWorkspaceCandidate,
  type BatchRefreshSummary,
  type BatchRefreshOptions,
} from './batch-refresh';
import {
  mapWireToEnrichmentCandidates,
  selectEnrichable,
  type FreshCacheProbe,
} from './wire-workspace-mapper';

/** Wire-string plan literal that gates default batch dispatch. */
const PRO_ONE_PLAN_LITERAL = 'pro_1';
/** Wire-string plan literal opted in via `allowPlan0`. */
const PRO_ZERO_PLAN_LITERAL = 'pro_0';

/**
 * Wire-wrapper options. Extends the dispatcher's plan-agnostic
 * `BatchRefreshOptions` with the plan-literal policy flag `allowPlan0`.
 * The dispatcher never sees this flag — the wrapper consumes it to
 * decide `dispatchable`, then hands a stripped `BatchRefreshOptions` to
 * `batchRefreshProOneCreditBalances`.
 */
export interface WireBatchRefreshOptions extends BatchRefreshOptions {
  /** Widen the dispatchable set to pro_0 rows. Default false. */
  readonly allowPlan0?: boolean;
}

function isDispatchablePlan(plan: string, allowPlan0: boolean): boolean {
  if (plan === PRO_ONE_PLAN_LITERAL) return true;
  if (allowPlan0 && plan === PRO_ZERO_PLAN_LITERAL) return true;
  return false;
}

/**
 * Map raw wire rows -> enrichable candidates -> batch dispatcher.
 * Rows rejected by the guard or the predicate never reach the network.
 *
 * `options.force=true` bypasses the per-workspace 10s throttle so the
 * right-click "Credit Refresh" path can share this dispatcher without
 * touching `fetchAndPersist` directly.
 * `options.allowPlan0=true` widens the dispatchable set to pro_0.
 */
export async function batchRefreshFromWire(
  rawRows: readonly unknown[],
  hasFreshCache: FreshCacheProbe,
  options?: WireBatchRefreshOptions,
): Promise<BatchRefreshSummary> {
  const candidates = await mapWireToEnrichmentCandidates(rawRows, hasFreshCache);
  const enrichable = selectEnrichable(candidates);
  const allowPlan0 = options?.allowPlan0 === true;

  const batchInput: BatchWorkspaceCandidate[] = enrichable.map(function toBatch(entry): BatchWorkspaceCandidate {
    return {
      workspaceId: entry.workspace.id,
      dispatchable: isDispatchablePlan(entry.workspace.plan, allowPlan0),
    };
  });

  const dispatchableCount = batchInput.filter(function (c) { return c.dispatchable; }).length;

  log('CreditBalance.batchFromWire: raw=' + String(rawRows.length)
    + ', typed=' + String(candidates.length)
    + ', enrichable=' + String(batchInput.length)
    + ', dispatchable=' + String(dispatchableCount)
    + ', allowPlan0=' + String(allowPlan0)
    + ', force=' + String(options?.force === true)
    + ', source=' + String(options?.source ?? 'batch'), 'info');

  // Strip `allowPlan0` before handing options to the plan-agnostic dispatcher.
  const dispatcherOptions: BatchRefreshOptions = {
    ...(options?.force !== undefined ? { force: options.force } : {}),
    ...(options?.source !== undefined ? { source: options.source } : {}),
  };
  return batchRefreshProOneCreditBalances(batchInput, dispatcherOptions);
}
