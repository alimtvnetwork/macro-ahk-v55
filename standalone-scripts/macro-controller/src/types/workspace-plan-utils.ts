import type { WorkspaceCredit } from './credit-types';

/** Wire-string plan literal for the pro_0 branch (enriched fields). */
export const PLAN_PRO_ZERO = 'pro_0';
/** Wire-string plan literal for the unsubscribed/free tier. */
export const PLAN_FREE = 'free';
/** Tier value for the unsubscribed/free tier. */
export const TIER_FREE = 'FREE';
/** Wire-string plan literal for the pro_1 tier. */
export const PLAN_PRO_ONE = 'pro_1';

/** True for FREE/unsubscribed workspaces — excluded from billing totals. */
export function isFreeTierWorkspace(ws: WorkspaceCredit): boolean {
  const plan = (ws.plan || '').toLowerCase().trim();
  const tier = (ws.tier || '').toUpperCase().trim();

  return plan === PLAN_FREE || tier === TIER_FREE;
}

/** True when the workspace plan is the pro_0 (enriched) branch. */
export function isProZeroPlan(ws: WorkspaceCredit): boolean {
  return (ws.plan || '').toLowerCase().trim() === PLAN_PRO_ZERO;
}

/** True when the workspace plan is the pro_1 branch. */
export function isProOnePlan(ws: WorkspaceCredit): boolean {
  return String(ws.plan || '').toLowerCase().trim() === PLAN_PRO_ONE;
}
