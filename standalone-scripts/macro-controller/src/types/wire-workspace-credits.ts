/**
 * Plan-10 (follow-up) — sibling wide type covering the numeric credit
 * fields that `pro-zero/pro-zero-workspace-adapter.ts` narrows from the
 * `/user/workspaces` row separately from `WireWorkspace` (which only
 * covers identity + plan/tier strings).
 *
 * This module is the single sanctioned wide surface for those numeric
 * fields at the parse boundary. It intentionally does NOT re-export the
 * `WireWorkspace` string identity because pro-zero uses a nested
 * `.workspace` section from the raw row (see `pickWorkspaceSection` in
 * the adapter) whereas the batch mapper works on the flat top-level.
 *
 * Adding this sibling type unblocks removing the second `readNum`
 * duplication path and gives future numeric-field consumers a typed
 * surface to import from.
 */

import { readNum, readStr } from './safe-json';

export interface WireWorkspaceCredits {
  readonly credits_used: number;
  readonly credits_granted: number;
  readonly total_credits_used: number;
  readonly total_credits_used_in_billing_period: number;
  readonly billing_period_credits_used: number;
  readonly billing_period_credits_limit: number;
  readonly billing_period_start_date: string;
  readonly billing_period_end_date: string;
  readonly daily_credits_used: number;
  readonly daily_credits_limit: number;
  readonly rollover_credits_used: number;
  readonly rollover_credits_limit: number;
  readonly topup_credits_limit: number;
}

/** Narrow a raw wire section (flat or `.workspace`-nested is caller's job) into the numeric surface. */
export function toWireWorkspaceCredits(source: Record<string, unknown>): WireWorkspaceCredits {
  const totalUsed = readNum(source, 'total_credits_used');
  const bpUsedRaw = readNum(source, 'total_credits_used_in_billing_period');
  return {
    credits_used: readNum(source, 'credits_used'),
    credits_granted: readNum(source, 'credits_granted'),
    total_credits_used: totalUsed,
    // Fallback: some rows only surface the lifetime total; parser needs BP-scoped.
    total_credits_used_in_billing_period: bpUsedRaw || totalUsed,
    billing_period_credits_used: readNum(source, 'billing_period_credits_used'),
    billing_period_credits_limit: readNum(source, 'billing_period_credits_limit'),
    billing_period_start_date: readStr(source, 'billing_period_start_date'),
    billing_period_end_date: readStr(source, 'billing_period_end_date'),
    daily_credits_used: readNum(source, 'daily_credits_used'),
    daily_credits_limit: readNum(source, 'daily_credits_limit'),
    rollover_credits_used: readNum(source, 'rollover_credits_used'),
    rollover_credits_limit: readNum(source, 'rollover_credits_limit'),
    topup_credits_limit: readNum(source, 'topup_credits_limit'),
  };
}

