/**
 * Plan-10 follow-up regression — freshness probe must be true iff the
 * in-memory tier of the credit-balance cache holds a live entry for the
 * workspace id.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hasFreshCreditBalanceCache } from '../fresh-cache-probe';
import {
  __writeCreditBalanceUpdateMemoryCacheForTests,
  clearCreditBalanceUpdateMemoryCache,
} from '../../credit-balance-update/credit-balance-cache';
import { CreditFetchOutcome } from '../../credit-balance-update/credit-fetch-outcome';
import type { CreditFetchResult } from '../../credit-balance-update/credit-balance-types';

function makeResult(): CreditFetchResult {
  return {
    outcome: CreditFetchOutcome.ApiHit,
    balance: {
      workspaceId: 'ws-1',
      totalGranted: 100,
      totalRemaining: 50,
      totalBillingPeriodUsed: 25,
      grantTypeBalances: [],
      fetchedAtMs: Date.now(),
    } as unknown as CreditFetchResult['balance'],
    fetchedAt: Date.now(),
    sourceUrl: 'unit-test',
    errorDetail: null,
  };
}

describe('hasFreshCreditBalanceCache', () => {
  beforeEach(() => { clearCreditBalanceUpdateMemoryCache(); });

  it('returns false for empty workspace id', () => {
    expect(hasFreshCreditBalanceCache('')).toBe(false);
  });

  it('returns false when nothing is cached', () => {
    expect(hasFreshCreditBalanceCache('ws-unknown')).toBe(false);
  });

  it('returns true when a live entry exists in the memory tier', () => {
    __writeCreditBalanceUpdateMemoryCacheForTests('ws-1', makeResult(), 60_000, Date.now());
    expect(hasFreshCreditBalanceCache('ws-1')).toBe(true);
  });

  it('returns false when the cached entry has expired', () => {
    __writeCreditBalanceUpdateMemoryCacheForTests('ws-1', makeResult(), 1, Date.now() - 10_000);
    expect(hasFreshCreditBalanceCache('ws-1')).toBe(false);
  });
});
