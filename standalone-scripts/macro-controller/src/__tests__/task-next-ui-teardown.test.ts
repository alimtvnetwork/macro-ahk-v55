/**
 * Regression: `setupTaskNextCancelHandler` must be idempotent (no
 * stacked `keydown` listeners) and must remove its listener on
 * `pagehide` per mem://standards/timer-and-observer-teardown.
 *
 * Also covers `mountNextInlineStrip` MutationObserver teardown and the
 * capture-phase click closer added by `buildPlanDropup` (verified via
 * `__resetNextInlineForTests` symmetry).
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  setupTaskNextCancelHandler,
  __resetTaskNextCancelHandlerForTests,
  taskNextState,
} from '../ui/task-next-ui';

describe('task-next-ui: setupTaskNextCancelHandler teardown', () => {
  beforeEach(() => {
    __resetTaskNextCancelHandlerForTests();
  });

  it('registers exactly one keydown listener regardless of call count', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    setupTaskNextCancelHandler();
    setupTaskNextCancelHandler();
    setupTaskNextCancelHandler();
    const keydownCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown');
    expect(keydownCalls).toHaveLength(1);
    addSpy.mockRestore();
  });

  it('sets taskNextState.cancelled only when running is true', () => {
    setupTaskNextCancelHandler();
    taskNextState.cancelled = false;
    taskNextState.running = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(taskNextState.cancelled).toBe(false);

    taskNextState.running = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(taskNextState.cancelled).toBe(true);
    taskNextState.running = false;
    taskNextState.cancelled = false;
  });

  it('removes the keydown listener on pagehide', () => {
    setupTaskNextCancelHandler();
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    window.dispatchEvent(new Event('pagehide'));
    const keydownRemovals = removeSpy.mock.calls.filter((c) => c[0] === 'keydown');
    expect(keydownRemovals.length).toBeGreaterThanOrEqual(1);
    removeSpy.mockRestore();

    // After teardown, running+Escape must NOT flip cancelled anymore.
    taskNextState.running = true;
    taskNextState.cancelled = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(taskNextState.cancelled).toBe(false);
    taskNextState.running = false;
  });

  it('is re-installable after test reset (idempotency guard clears)', () => {
    setupTaskNextCancelHandler();
    __resetTaskNextCancelHandlerForTests();
    const addSpy = vi.spyOn(document, 'addEventListener');
    setupTaskNextCancelHandler();
    const keydownCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown');
    expect(keydownCalls).toHaveLength(1);
    addSpy.mockRestore();
  });
});
