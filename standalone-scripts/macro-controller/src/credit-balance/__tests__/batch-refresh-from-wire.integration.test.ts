/**
 * Integration test — Plan-10 `batchRefreshFromWire` pipes wire rows
 * through the mapper + predicate + existing pro_1 dispatcher.
 *
 * We mock only the network boundary (`fetcher.fetchAndPersist`) and let
 * the real mapper + real `batchRefreshProOneCreditBalances` run. Proves:
 *   1. Guard drops shape-invalid rows before they hit the network.
 *   2. FREE/teams rows are excluded by the predicate.
 *   3. Fresh-cache rows short-circuit (never call the fetcher).
 *   4. Only pro_1 rows actually reach `fetchAndPersist`.
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
import {
  WIRE_CANONICAL_SET,
  WIRE_PRO_ONE_STALE,
  makeFreshCacheProbe,
} from '../__fixtures__/wire-workspaces';

const mockedFetch = vi.mocked(fetchAndPersist);

describe('batchRefreshFromWire (Plan-10 integration)', () => {
  beforeEach(() => {
    mockedFetch.mockClear();
  });

  it('calls fetchAndPersist only for stale pro_1 rows (drops invalid/free/teams/fresh/pro_0)', async () => {
    const summary = await batchRefreshFromWire(WIRE_CANONICAL_SET, makeFreshCacheProbe());

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      WIRE_PRO_ONE_STALE.id,
      expect.objectContaining({ source: 'batch', force: false }),
    );
    expect(summary.fetched).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('never calls the fetcher when every row is FREE or fresh', async () => {
    const rows = [
      { id: 'free-1', plan: 'free', tier: 'FREE' },
      { id: 'cached', plan: 'pro_1', tier: 'PRO' },
    ];
    const summary = await batchRefreshFromWire(rows, (id) => id === 'cached');

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(summary.fetched).toBe(0);
  });

  it('handles an empty wire payload without throwing', async () => {
    const summary = await batchRefreshFromWire([], () => false);
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(summary.total).toBe(0);
  });

  it('forwards `force: true` + custom source through to fetchAndPersist (shared manual path)', async () => {
    await batchRefreshFromWire(
      WIRE_CANONICAL_SET,
      makeFreshCacheProbe(),
      { force: true, source: 'manual' },
    );
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      WIRE_PRO_ONE_STALE.id,
      expect.objectContaining({ source: 'manual', force: true }),
    );
  });

  it('with allowPlan0=true, dispatches pro_0 rows through the same fetcher (manual path)', async () => {
    const rows = [
      { id: 'plan0-a', plan: 'pro_0', tier: 'PRO' },
      { id: 'plan1-b', plan: 'pro_1', tier: 'PRO' },
      { id: 'free-c',  plan: 'free',  tier: 'FREE' },
    ];
    const summary = await batchRefreshFromWire(rows, () => false, {
      force: true,
      source: 'manual',
      allowPlan0: true,
    });
    const fetchedIds = mockedFetch.mock.calls.map((call) => call[0]).sort();
    expect(fetchedIds).toEqual(['plan0-a', 'plan1-b']);
    expect(summary.fetched).toBe(2);
    expect(summary.skipped).toBe(0);
  });

  it('without allowPlan0, pro_0 rows are skipped with outcome=skipped + reason=plan-not-eligible', async () => {
    const rows = [
      { id: 'plan0-a', plan: 'pro_0', tier: 'PRO' },
      { id: 'plan1-b', plan: 'pro_1', tier: 'PRO' },
    ];
    const summary = await batchRefreshFromWire(rows, () => false);
    const fetchedIds = mockedFetch.mock.calls.map((call) => call[0]);
    expect(fetchedIds).toEqual(['plan1-b']);
    const plan0 = summary.results.find((r) => r.workspaceId === 'plan0-a');
    expect(plan0?.outcome).toBe('skipped');
    expect(plan0?.reason).toBe('plan-not-eligible');
  });
});


