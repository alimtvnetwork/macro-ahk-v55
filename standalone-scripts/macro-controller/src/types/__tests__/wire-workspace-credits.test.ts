/**
 * Unit tests — WireWorkspaceCredits sibling narrowing surface.
 */

import { describe, it, expect } from 'vitest';
import { toWireWorkspaceCredits } from '../wire-workspace-credits';

describe('toWireWorkspaceCredits', () => {
  it('reads every numeric + billing-date field with safe defaults', () => {
    const out = toWireWorkspaceCredits({
      credits_used: 10,
      credits_granted: 100,
      total_credits_used: 42,
      billing_period_credits_used: 5,
      billing_period_credits_limit: 500,
      billing_period_start_date: '2026-07-01',
      billing_period_end_date: '2026-08-01',
    });
    expect(out).toEqual({
      credits_used: 10,
      credits_granted: 100,
      total_credits_used: 42,
      total_credits_used_in_billing_period: 42,
      billing_period_credits_used: 5,
      billing_period_credits_limit: 500,
      billing_period_start_date: '2026-07-01',
      billing_period_end_date: '2026-08-01',
      daily_credits_used: 0,
      daily_credits_limit: 0,
      rollover_credits_used: 0,
      rollover_credits_limit: 0,
      topup_credits_limit: 0,
    });
  });

  it('reads the newly-added numeric fields (daily/rollover/topup/BP-used)', () => {
    const out = toWireWorkspaceCredits({
      daily_credits_used: 3,
      daily_credits_limit: 5,
      rollover_credits_used: 1,
      rollover_credits_limit: 10,
      topup_credits_limit: 250,
      total_credits_used_in_billing_period: 77,
      total_credits_used: 999,
    });
    expect(out.daily_credits_used).toBe(3);
    expect(out.daily_credits_limit).toBe(5);
    expect(out.rollover_credits_used).toBe(1);
    expect(out.rollover_credits_limit).toBe(10);
    expect(out.topup_credits_limit).toBe(250);
    expect(out.total_credits_used_in_billing_period).toBe(77);
  });


  it('coerces missing / non-number / non-finite fields to 0 and strings to empty', () => {
    const out = toWireWorkspaceCredits({
      credits_used: 'nope' as unknown as number,
      credits_granted: Number.NaN,
      total_credits_used: Number.POSITIVE_INFINITY,
      billing_period_start_date: 123 as unknown as string,
    });
    expect(out.credits_used).toBe(0);
    expect(out.credits_granted).toBe(0);
    expect(out.total_credits_used).toBe(0);
    expect(out.billing_period_credits_used).toBe(0);
    expect(out.billing_period_credits_limit).toBe(0);
    expect(out.billing_period_start_date).toBe('');
    expect(out.billing_period_end_date).toBe('');
  });
});
