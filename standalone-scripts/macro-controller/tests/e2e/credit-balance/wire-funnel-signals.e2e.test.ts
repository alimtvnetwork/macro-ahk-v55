/**
 * E2E funnel signal — asserts that every `/user/workspaces` refresh
 * emits the full observability trail: `batchFromWire` counts (raw,
 * typed, enrichable, dispatchable, allowPlan0), the dispatcher
 * `batchRefresh: starting` line, per-row `fetchAndPersist` calls with
 * `source`+`force`, and the dispatcher `done` summary.
 *
 * Silent-failure guard: if any of these signals disappear, operators
 * lose the ability to trace attrition from raw wire rows through the
 * network fetcher without a debugger. Locks down Plan-10 telemetry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/credit-balance/fetcher', () => ({
  fetchAndPersist: vi.fn(async (workspaceId: string) => ({
    outcome: 'fetched' as const,
    workspaceId,
  })),
}));

vi.mock('../../../src/credit-balance/throttle', () => ({ INTER_WS_GAP_MS: 0 }));

const logSpy = vi.fn();
vi.mock('../../../src/logging', () => ({
  log: (message: string, level?: string) => { logSpy(message, level); },
}));

import { fetchAndPersist } from '../../../src/credit-balance/fetcher';
import { batchRefreshFromWire } from '../../../src/credit-balance/batch-refresh-from-wire';

const mockedFetch = vi.mocked(fetchAndPersist);

interface FunnelCounts {
  raw: number;
  typed: number;
  enrichable: number;
  dispatchable: number;
  allowPlan0: string;
}

function parseFunnelLine(message: string): FunnelCounts {
  return {
    raw: Number(/raw=(\d+)/.exec(message)?.[1]),
    typed: Number(/typed=(\d+)/.exec(message)?.[1]),
    enrichable: Number(/enrichable=(\d+)/.exec(message)?.[1]),
    dispatchable: Number(/dispatchable=(\d+)/.exec(message)?.[1]),
    allowPlan0: /allowPlan0=(\w+)/.exec(message)?.[1] ?? '',
  };
}

function findLog(prefix: string): string {
  const hit = logSpy.mock.calls.find(([message]: [string]) =>
    typeof message === 'string' && message.startsWith(prefix),
  );
  expect(hit, 'expected log line starting with ' + prefix).toBeDefined();
  return hit![0] as string;
}

describe('E2E funnel signals: /user/workspaces -> dispatcher -> fetcher', () => {
  beforeEach(() => {
    logSpy.mockClear();
    mockedFetch.mockClear();
  });

  it('mixed plans (default): batchFromWire + batchRefresh + fetchAndPersist all emit; only pro_1 dispatched', async () => {
    const rows = [
      { id: 'ws-p1-a', plan: 'pro_1', tier: 'PRO' },
      { id: 'ws-p1-b', plan: 'pro_1', tier: 'PRO' },
      { id: 'ws-p0',   plan: 'pro_0', tier: 'PRO' },
      { id: 'ws-free', plan: 'free',  tier: 'FREE' },
      { id: 'ws-team', plan: 'teams', tier: 'PRO' },
      null,
    ];

    const summary = await batchRefreshFromWire(rows, () => false);

    const funnel = parseFunnelLine(findLog('CreditBalance.batchFromWire:'));
    expect(funnel).toEqual({
      raw: 6,
      typed: 5,
      enrichable: 3,
      dispatchable: 2,
      allowPlan0: 'false',
    });

    const startingLine = findLog('CreditBalance.batchRefresh: starting');
    expect(startingLine).toContain('candidates=3');
    expect(startingLine).toContain('dispatchable=2');
    expect(startingLine).toContain('source=batch');

    const doneLine = findLog('CreditBalance.batchRefresh: done');
    expect(doneLine).toContain('fetched=2');
    expect(doneLine).toContain('skipped=1');

    const fetchedIds = mockedFetch.mock.calls.map(([id]) => id).sort();
    expect(fetchedIds).toEqual(['ws-p1-a', 'ws-p1-b']);
    for (const call of mockedFetch.mock.calls) {
      expect(call[1]).toMatchObject({ source: 'batch', force: false });
    }

    expect(summary.fetched).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('manual path (allowPlan0=true, force=true): dispatcher widens to pro_0 and forwards force+source=manual', async () => {
    const rows = [
      { id: 'ws-p0',  plan: 'pro_0', tier: 'PRO' },
      { id: 'ws-p1',  plan: 'pro_1', tier: 'PRO' },
    ];

    await batchRefreshFromWire(rows, () => false, {
      allowPlan0: true,
      force: true,
      source: 'manual',
    });

    const funnel = parseFunnelLine(findLog('CreditBalance.batchFromWire:'));
    expect(funnel).toEqual({
      raw: 2,
      typed: 2,
      enrichable: 2,
      dispatchable: 2,
      allowPlan0: 'true',
    });

    const startingLine = findLog('CreditBalance.batchRefresh: starting');
    expect(startingLine).toContain('source=manual');
    expect(startingLine).toContain('force=true');

    for (const call of mockedFetch.mock.calls) {
      expect(call[1]).toMatchObject({ source: 'manual', force: true });
    }
  });

  it('fresh-cache short-circuit: dispatchable=0, fetcher never called', async () => {
    const rows = [
      { id: 'ws-p1', plan: 'pro_1', tier: 'PRO' },
    ];
    await batchRefreshFromWire(rows, (id) => id === 'ws-p1');

    const funnel = parseFunnelLine(findLog('CreditBalance.batchFromWire:'));
    expect(funnel.enrichable).toBe(0);
    expect(funnel.dispatchable).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
