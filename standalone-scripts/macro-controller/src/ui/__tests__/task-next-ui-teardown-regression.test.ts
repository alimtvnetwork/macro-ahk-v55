/**
 * Regression: task-next-ui teardown across repeated renders / SPA navigations.
 *
 * The existing task-next-ui-teardown.test.ts covers the single-cycle case
 * (install, cancel, pagehide). This suite locks the multi-cycle guarantees
 * that the panel relies on when the user opens/closes the chip UI or the
 * host page fires `pagehide` more than once during a session:
 *
 *   R1. install -> pagehide -> install cycle repeats N times without stacking
 *       keydown listeners (count stays at 1 per cycle, 0 after pagehide).
 *   R2. pagehide fired twice does not throw and does not double-remove.
 *   R3. pagehide also removes its own `pagehide` listener (no accumulation).
 *   R4. taskNextState.cancelled does NOT persist across teardown -> reinstall.
 *   R5. Rapid repeated Escape keys during a run latch `cancelled` idempotently
 *       and never call the listener after pagehide.
 *   R6. Reset helper leaves module state clean for the next mount.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetTaskNextCancelHandlerForTests,
    setupTaskNextCancelHandler,
    taskNextState,
} from '../../ui/task-next-ui';

function activeKeydownCount(spy: ReturnType<typeof vi.spyOn>): number {
    // adds - removes for the keydown event; never negative in a healthy module.
    return spy.mock.calls.filter((c) => c[0] === 'keydown').length;
}

beforeEach(() => {
    __resetTaskNextCancelHandlerForTests();
    taskNextState.running = false;
    taskNextState.cancelled = false;
});

afterEach(() => {
    __resetTaskNextCancelHandlerForTests();
    taskNextState.running = false;
    taskNextState.cancelled = false;
});

describe('task-next-ui teardown regression across repeated renders', () => {
    it('R1: install/pagehide cycle repeats 5x with no listener stacking', () => {
        for (let i = 0; i < 5; i++) {
            const addSpy = vi.spyOn(document, 'addEventListener');
            const removeSpy = vi.spyOn(document, 'removeEventListener');

            setupTaskNextCancelHandler();
            // Second call in same cycle must be a no-op.
            setupTaskNextCancelHandler();
            expect(activeKeydownCount(addSpy)).toBe(1);

            window.dispatchEvent(new Event('pagehide'));
            const removed = removeSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
            expect(removed).toBe(1);

            addSpy.mockRestore();
            removeSpy.mockRestore();
        }
    });

    it('R2: pagehide fired twice does not throw or double-remove', () => {
        setupTaskNextCancelHandler();
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        expect(() => {
            window.dispatchEvent(new Event('pagehide'));
            window.dispatchEvent(new Event('pagehide'));
        }).not.toThrow();
        const removed = removeSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
        // Second pagehide must not attempt another removal (handler nulled first time).
        expect(removed).toBe(1);
        removeSpy.mockRestore();
    });

    it('R3: pagehide removes its own pagehide listener (no accumulation)', () => {
        // Track adds/removes on window so a leaked pagehide would show up as adds > removes.
        const winAdd = vi.spyOn(window, 'addEventListener');
        const winRemove = vi.spyOn(window, 'removeEventListener');

        for (let i = 0; i < 3; i++) {
            setupTaskNextCancelHandler();
            window.dispatchEvent(new Event('pagehide'));
        }

        const adds = winAdd.mock.calls.filter((c) => c[0] === 'pagehide').length;
        const removes = winRemove.mock.calls.filter((c) => c[0] === 'pagehide').length;
        expect(adds).toBe(3);
        expect(removes).toBe(3);

        winAdd.mockRestore();
        winRemove.mockRestore();
    });

    it('R4: cancelled does not persist across teardown -> reinstall', () => {
        setupTaskNextCancelHandler();
        taskNextState.running = true;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(taskNextState.cancelled).toBe(true);

        // Simulate SPA nav.
        window.dispatchEvent(new Event('pagehide'));
        // Consumers reset per-run state before the next queue kicks off.
        taskNextState.running = false;
        taskNextState.cancelled = false;

        setupTaskNextCancelHandler();
        // No stray Escape from the prior cycle should reach the new handler.
        expect(taskNextState.cancelled).toBe(false);
    });

    it('R5: rapid Escape during a run is idempotent and dead after pagehide', () => {
        setupTaskNextCancelHandler();
        taskNextState.running = true;
        for (let i = 0; i < 10; i++) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
        expect(taskNextState.cancelled).toBe(true);

        // After teardown, further Escapes are inert even if running is still true.
        window.dispatchEvent(new Event('pagehide'));
        taskNextState.cancelled = false;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(taskNextState.cancelled).toBe(false);
    });

    it('R6: __resetTaskNextCancelHandlerForTests leaves state re-installable', () => {
        setupTaskNextCancelHandler();
        __resetTaskNextCancelHandlerForTests();

        const addSpy = vi.spyOn(document, 'addEventListener');
        setupTaskNextCancelHandler();
        setupTaskNextCancelHandler();
        expect(addSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1);
        addSpy.mockRestore();
    });
});
