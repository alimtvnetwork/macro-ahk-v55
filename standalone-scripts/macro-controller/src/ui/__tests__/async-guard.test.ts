import { describe, it, expect, vi } from 'vitest';
import { guardAsyncClick, isBusy } from '../async-guard';

describe('guardAsyncClick', () => {
  it('ignores re-entrant clicks while the handler is running', async () => {
    const btn = document.createElement('button');
    let inFlight = 0;
    let maxConcurrent = 0;
    let calls = 0;
    const handler = async (): Promise<void> => {
      calls += 1;
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
    };
    const guarded = guardAsyncClick(btn, handler);
    await Promise.all([guarded(), guarded(), guarded()]);
    expect(calls).toBe(1);
    expect(maxConcurrent).toBe(1);
    expect(isBusy(btn)).toBe(false);
    expect(btn.style.opacity).toBe('');
  });

  it('restores state even when the handler throws', async () => {
    const btn = document.createElement('button');
    const guarded = guardAsyncClick(btn, async () => { throw new Error('boom'); });
    await expect(guarded()).rejects.toThrow('boom');
    expect(isBusy(btn)).toBe(false);
    expect(btn.disabled).toBe(false);
  });

  it('allows a second click after the first resolves', async () => {
    const btn = document.createElement('button');
    const spy = vi.fn(async () => {});
    const guarded = guardAsyncClick(btn, spy);
    await guarded();
    await guarded();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
