/**
 * Plan-10 log-signal regression — proves `batchRefreshFromWire` emits
 * the observable funnel line `CreditBalance.batchFromWire: raw=N, typed=N, enrichable=N`
 * so operators can trace wire→typed→enrichable attrition without a debugger.
 *
 * Silent-failure guard: if this log ever disappears, the whole Plan-10
 * observability contract is dead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../fetcher', () => ({
  fetchAndPersist: vi.fn(async (workspaceId: string) => ({
    outcome: 'fetched' as const,
    workspaceId,
  })),
}));

vi.mock('../throttle', () => ({ INTER_WS_GAP_MS: 0 }));

const logSpy = vi.fn();
vi.mock('../../logging', () => ({
  log: (message: string, level?: string) => { logSpy(message, level); },
}));

import { batchRefreshFromWire } from '../batch-refresh-from-wire';
import { WIRE_CANONICAL_SET } from '../__fixtures__/wire-workspaces';

describe('batchRefreshFromWire log signal (Plan-10)', () => {
  beforeEach(() => { logSpy.mockClear(); });

  it('emits CreditBalance.batchFromWire funnel line with raw/typed/enrichable counts', async () => {
    await batchRefreshFromWire(WIRE_CANONICAL_SET, () => false);

    const funnelCalls = logSpy.mock.calls.filter(([message]: [string]) =>
      typeof message === 'string' && message.startsWith('CreditBalance.batchFromWire:'),
    );
    expect(funnelCalls.length).toBe(1);

    const [message, level] = funnelCalls[0];
    expect(level).toBe('info');
    expect(message).toMatch(/raw=\d+/);
    expect(message).toMatch(/typed=\d+/);
    expect(message).toMatch(/enrichable=\d+/);

    const raw = Number(/raw=(\d+)/.exec(message)?.[1]);
    const typed = Number(/typed=(\d+)/.exec(message)?.[1]);
    const enrichable = Number(/enrichable=(\d+)/.exec(message)?.[1]);
    expect(raw).toBe(WIRE_CANONICAL_SET.length);
    expect(typed).toBeLessThanOrEqual(raw);
    expect(enrichable).toBeLessThanOrEqual(typed);
  });

  it('still logs the funnel line for empty input (never swallowed)', async () => {
    await batchRefreshFromWire([], () => false);
    const funnelCalls = logSpy.mock.calls.filter(([message]: [string]) =>
      typeof message === 'string' && message.startsWith('CreditBalance.batchFromWire:'),
    );
    expect(funnelCalls.length).toBe(1);
    expect(funnelCalls[0][0]).toContain('raw=0');
    expect(funnelCalls[0][0]).toContain('typed=0');
    expect(funnelCalls[0][0]).toContain('enrichable=0');
  });
});
