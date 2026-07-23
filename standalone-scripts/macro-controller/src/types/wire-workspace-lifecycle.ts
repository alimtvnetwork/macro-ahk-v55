/**
 * Plan-10 (follow-up) — sibling wide surface for the lifecycle / meta
 * strings + shallow nested objects consumed by
 * `credit-parser.parseWorkspaceItem` and `extractLifecycleMeta`.
 *
 * Adding this type retires the last inline `as string` / `as Record`
 * casts inside the parser so every wire field now flows through one of
 * the three sanctioned surfaces:
 *   1. `WireWorkspace`         — identity + plan/tier
 *   2. `WireWorkspaceCredits`  — numeric credit fields + billing dates
 *   3. `WireWorkspaceLifecycle`— subscription + membership + gitsync + counters
 *
 * The two nested objects (`experimental_features`, `membership`) are
 * narrowed here into typed booleans/strings — callers never see the raw
 * `Record<string, unknown>` shape after this point.
 */

import { readNum, readStr } from './safe-json';

export interface WireWorkspaceLifecycle {
  readonly subscription_status: string;
  readonly subscription_status_changed_at: string;
  readonly role: string;
  readonly plan_type: string;
  readonly next_monthly_credit_grant_date: string;
  readonly billing_period_end_date: string;
  readonly created_at: string;
  readonly num_projects: number;
  readonly gitsync_github_enabled: boolean;
  readonly membership_role: string;
}

function readNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (value === null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

export function toWireWorkspaceLifecycle(source: Record<string, unknown>): WireWorkspaceLifecycle {
  const expFeatures = readNestedRecord(source, 'experimental_features');
  const membership = readNestedRecord(source, 'membership');
  return {
    subscription_status: readStr(source, 'subscription_status'),
    subscription_status_changed_at: readStr(source, 'subscription_status_changed_at'),
    role: readStr(source, 'role'),
    plan_type: readStr(source, 'plan_type'),
    next_monthly_credit_grant_date: readStr(source, 'next_monthly_credit_grant_date'),
    billing_period_end_date: readStr(source, 'billing_period_end_date'),
    created_at: readStr(source, 'created_at'),
    num_projects: readNum(source, 'num_projects'),
    gitsync_github_enabled: expFeatures.gitsync_github === true,
    membership_role: readStr(membership, 'role'),
  };
}
