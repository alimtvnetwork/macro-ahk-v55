import type { WorkspaceCredit } from '../types';
import { logError } from '../error-utils';
import type { CreditFetchResult } from './credit-balance-types';
import { hasInlineCredits, requestCredits } from './credit-fetch-controller';
import { mapPlanFromWire, shouldFetchCreditBalanceForPlan } from './plan-mapper';

const CREDIT_ENRICHMENT_CONCURRENCY_LIMIT = 6;

export type CreditRequester = (workspace: WorkspaceCredit) => Promise<CreditFetchResult>;
type CreditEnrichmentEntry = readonly [string, CreditFetchResult | null];

export interface CreditEnrichmentFanOutOptions {
  readonly requester?: CreditRequester;
}

export interface CreditEnrichmentFanOutResult {
  readonly targetedCount: number;
  readonly resultsByWorkspaceId: Record<string, CreditFetchResult | null>;
}

function isCreditBalanceTarget(workspace: WorkspaceCredit): boolean {
  const plan = mapPlanFromWire(workspace.plan);
  const hasFetchPlan = shouldFetchCreditBalanceForPlan(plan);
  if (hasFetchPlan === false) {
    return false;
  }

  return hasInlineCredits(workspace) === false;
}

function logFanOutFailure(workspace: WorkspaceCredit, caught: CaughtError): void {
  logError(
    'CreditBalanceUpdate.fanOut',
    'Path: standalone-scripts/macro-controller/src/credit-balance-update/credit-enrichment-fanout.ts. Missing item: /credit-balance result for workspace ' + workspace.id + '. Reason: requestCredits rejected during capped fan-out (WorkspaceId=' + workspace.id + ', Plan=' + String(workspace.plan) + ').',
    caught,
  );
}

async function requestTargetCredits(workspace: WorkspaceCredit, requester: CreditRequester): Promise<CreditEnrichmentEntry> {
  try {
    return [workspace.id, await requester(workspace)];
  } catch (caught: CaughtError) {
    logFanOutFailure(workspace, caught);
    return [workspace.id, null];
  }
}

function mapEntries(entries: readonly CreditEnrichmentEntry[]): Record<string, CreditFetchResult | null> {
  const mapped: Record<string, CreditFetchResult | null> = {};
  for (const [workspaceId, result] of entries) {
    mapped[workspaceId] = result;
  }

  return mapped;
}

async function runBatch(batch: readonly WorkspaceCredit[], requester: CreditRequester): Promise<CreditEnrichmentEntry[]> {
  const settled = await Promise.allSettled(batch.map(function (workspace) {
    return requestTargetCredits(workspace, requester);
  }));

  return settled.map(function (outcome, index) {
    return outcome.status === 'fulfilled' ? outcome.value : [batch[index].id, null];
  });
}

export async function fanOutCreditEnrichment(
  workspaces: readonly WorkspaceCredit[],
  options: CreditEnrichmentFanOutOptions = {},
): Promise<CreditEnrichmentFanOutResult> {
  const requester = options.requester ?? requestCredits;
  const targets = workspaces.filter(isCreditBalanceTarget);
  const entries: CreditEnrichmentEntry[] = [];
  for (let index = 0; index < targets.length; index += CREDIT_ENRICHMENT_CONCURRENCY_LIMIT) {
    entries.push(...await runBatch(targets.slice(index, index + CREDIT_ENRICHMENT_CONCURRENCY_LIMIT), requester));
  }

  return { targetedCount: targets.length, resultsByWorkspaceId: mapEntries(entries) };
}