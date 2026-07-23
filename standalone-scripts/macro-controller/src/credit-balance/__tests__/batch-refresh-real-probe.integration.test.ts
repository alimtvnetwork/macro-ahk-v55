/**
 * Plan-10 follow-up — integration test wiring the REAL freshness probe
 * (`hasFreshCreditBalanceCache`) against the REAL in-memory credit-balance
 * cache. Every prior integration test injected a stub probe, so nothing
 * exercised the actual short-circuit path production runs on.
 *
 * Fails-when-regressed signals:
 *   1. Seed cache -> fetcher called for the seeded workspace = production
 *      would waste a `/credit-balance` request on a fresh row.
 *   2. No seed -> fetcher NOT called for the stale row = short-circuit
 *      false-positive; production would silently stop refreshing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../fetcher', () => ({
  fetchAndPersist: vi.fn(async (workspaceId: string) => ({
    outcome: 'fetched' as const,
    workspaceId,
  })),
}));
vi.mock('../throttle', () => ({ INTER_WS_GAP_MS: 0 }));

import { fetchAndPersist } from '../fetcher';
import { batchRefreshFromWire } from '../batch-refresh-from-wire';
import { hasFreshCreditBalanceCache } from '../fresh-cache-probe';
import {
  __writeCreditBalanceUpdateMemoryCacheForTests,
  clearCreditBalanceUpdateMemoryCache,
} from '../../credit-balance-update/credit-balance-cache';
import { CreditFetchOutcome } from '../../credit-balance-update/credit-fetch-outcome';
import type { CreditFetchResult } from '../../credit-balance-update/credit-balance-types';
import {
  WIRE_PRO_ONE_STALE,
  WIRE_PRO_ONE_FRESH,
} from '../__fixtures__/wire-workspaces';

const mockedFetch = vi.mocked(fetchAndPersist);

function makeResult(workspaceId: string): CreditFetchResult {
  return {
    outcome: CreditFetchOutcome.ApiHit,
    balance: {
      totalRemaining: 100,
      totalGranted: 200,
      dailyRemaining: 10,
      dailyLimit: 20,
      totalBillingPeriodUsed: 90,
      availableBalance: 100,
      cloudRemaining: 0,
      aiRemaining: 0,
      expiringGrants: [],
      grantTypeBalances: [],
    },
    fetchedAt: Date.now(),
    sourceUrl: 'https://example.test/credit-balance/' + workspaceId,
    errorDetail: null,
  };
}

describe('batchRefreshFromWire — real fresh-cache probe', () => {
  beforeEach(() => {
    mockedFetch.mockClear();
    clearCreditBalanceUpdateMemoryCache();
  });

  it('short-circuits the seeded workspace, still enriches the stale one', async () => {
    __writeCreditBalanceUpdateMemoryCacheForTests(
      WIRE_PRO_ONE_FRESH.id,
      makeResult(WIRE_PRO_ONE_FRESH.id),
    );

    const summary = await batchRefreshFromWire(
      [WIRE_PRO_ONE_STALE, WIRE_PRO_ONE_FRESH],
      hasFreshCreditBalanceCache,
    );

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      WIRE_PRO_ONE_STALE.id,
      expect.objectContaining({ source: 'batch' }),
    );
    expect(mockedFetch).not.toHaveBeenCalledWith(
      WIRE_PRO_ONE_FRESH.id,
      expect.anything(),
    );
    expect(summary.fetched).toBe(1);
  });

  it('with an empty cache, every stale pro_1 row reaches the dispatcher', async () => {
    const summary = await batchRefreshFromWire(
      [WIRE_PRO_ONE_STALE, WIRE_PRO_ONE_FRESH],
      hasFreshCreditBalanceCache,
    );

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(summary.fetched).toBe(2);
  });

  it('force:true still respects freshness (probe runs before dispatch)', async () => {
    __writeCreditBalanceUpdateMemoryCacheForTests(
      WIRE_PRO_ONE_FRESH.id,
      makeResult(WIRE_PRO_ONE_FRESH.id),
    );

    await batchRefreshFromWire(
      [WIRE_PRO_ONE_FRESH],
      hasFreshCreditBalanceCache,
      { force: true, source: 'manual' },
    );

    // Freshness gate is a mapper-level filter; force controls dispatcher
    // throttling only. A seeded fresh row must not reach the fetcher even
    // under a manual refresh.
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
