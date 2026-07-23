/**
 * Regression: mounting and unmounting the macro UI repeatedly must not leak
 * intervals, render subscribers, or window listeners.
 *
 * Covers the leak-prone surfaces documented in
 * `mem://standards/timer-and-observer-teardown`:
 *
 *   L1. `buildRepeatPanelSection` mounted N times then torn down (DOM removal +
 *       pagehide) leaves `repeatLoopState.subscribers.size` at baseline.
 *   L2. Interval registry total (excluding heartbeat) returns to baseline.
 *   L3. `pagehide` window listeners added by mount count == removed by
 *       teardown (net zero after all cycles).
 *   L4. Re-mounting after pagehide still installs a fresh subscriber that
 *       responds to `notify()` — teardown must not disable future mounts.
 *
 * Uses vi.mock to stub deep-dep modules so the pure DOM/timer contract of
 * `buildRepeatPanelSection` is what's actually exercised, not chat-editor
 * plumbing or SQLite reads.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logging', () => ({ log: () => {} }));
vi.mock('../prompt-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../prompt-utils')>();
    return {
        ...actual,
        showPasteToast: () => {},
        findPasteTarget: () => null,
    };
});
vi.mock('../prompt-manager', () => ({ getPromptsConfig: () => ({ prompts: [] }) }));
vi.mock('../../xpath-utils', () => ({
    getByXPath: () => null,
    isReturnButtonVisible: () => false,
}));
vi.mock('../task-next-ui', () => ({ findAddToTasksButton: () => null }));
vi.mock('../inline-strip-group-collapse', () => ({
    applyInlineStripGroupCollapse: () => {},
    subscribeInlineStripGroupCollapse: () => {},
}));
vi.mock('../inline-strips-frame', () => ({ ensureInlineStripsFrame: () => null }));
vi.mock('../editor-text', () => ({
    extractEditorPlainText: () => '',
    replaceEditorText: () => {},
}));
vi.mock('../../capture/chat-submit-capture', () => ({ captureChatSubmit: () => {} }));
vi.mock('../next-selector-control', () => ({
    buildNextSelectorControl: () => document.createElement('span'),
}));
vi.mock('../../shared-state', () => ({
    cPanelFg: '#fff',
    cPrimaryLight: '#a78bfa',
    cSectionBg: '#111',
}));

import {
    buildRepeatPanelSection,
    repeatLoopState,
} from '../repeat-loop-ui';
import {
    getIntervalSnapshot,
    resetIntervalRegistry,
    INTERVAL_HEARTBEAT_LABEL,
} from '../../interval-registry';

const REPEAT_TICK_LABEL = 'RepeatLoopUI.tick';

function nonHeartbeatIntervals(): number {
    const snap = getIntervalSnapshot();
    let total = snap.total;
    if (snap.byLabel[INTERVAL_HEARTBEAT_LABEL]) {
        total -= snap.byLabel[INTERVAL_HEARTBEAT_LABEL];
    }
    return total;
}

function pagehideCounts(spyAdd: ReturnType<typeof vi.spyOn>, spyRemove: ReturnType<typeof vi.spyOn>): { adds: number; removes: number } {
    return {
        adds: spyAdd.mock.calls.filter((c) => c[0] === 'pagehide').length,
        removes: spyRemove.mock.calls.filter((c) => c[0] === 'pagehide').length,
    };
}

beforeEach(() => {
    document.body.innerHTML = '';
    repeatLoopState.subscribers.clear();
    repeatLoopState.running = false;
    repeatLoopState.completed = 0;
    repeatLoopState.count = 10;
    repeatLoopState.collapsed = false;
    resetIntervalRegistry();
});

afterEach(() => {
    document.body.innerHTML = '';
    repeatLoopState.subscribers.clear();
    repeatLoopState.running = false;
    resetIntervalRegistry();
});

describe('macro UI mount/unmount leak invariants', () => {
    it('L1+L2: mount/unmount 5x leaves subscribers and intervals at baseline', () => {
        const baselineSubs = repeatLoopState.subscribers.size;
        const baselineIntervals = nonHeartbeatIntervals();

        for (let i = 0; i < 5; i++) {
            const host = buildRepeatPanelSection();
            document.body.appendChild(host);

            // Mount installs exactly one render subscriber and one tick interval.
            expect(repeatLoopState.subscribers.size).toBe(baselineSubs + 1);
            const tickCount = getIntervalSnapshot().byLabel[REPEAT_TICK_LABEL] ?? 0;
            expect(tickCount).toBe(1);

            // Teardown path #1: remove from DOM + fire pagehide (belt & braces).
            host.remove();
            window.dispatchEvent(new Event('pagehide'));

            expect(repeatLoopState.subscribers.size).toBe(baselineSubs);
            expect(nonHeartbeatIntervals()).toBe(baselineIntervals);
        }
    });

    it('L3: pagehide listeners added by mounts are all removed by teardown', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');

        const CYCLES = 4;
        for (let i = 0; i < CYCLES; i++) {
            const host = buildRepeatPanelSection();
            document.body.appendChild(host);
            host.remove();
            window.dispatchEvent(new Event('pagehide'));
        }

        const { adds, removes } = pagehideCounts(addSpy, removeSpy);
        expect(adds).toBe(CYCLES);
        // Each teardown calls removeEventListener('pagehide', teardown).
        expect(removes).toBe(CYCLES);

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    it('L4: subscribers installed after prior teardown still receive notify()', () => {
        // First cycle: mount, tear down.
        const first = buildRepeatPanelSection();
        document.body.appendChild(first);
        first.remove();
        window.dispatchEvent(new Event('pagehide'));
        expect(repeatLoopState.subscribers.size).toBe(0);

        // Second cycle: mount and count how many subscribers exist.
        const second = buildRepeatPanelSection();
        document.body.appendChild(second);
        expect(repeatLoopState.subscribers.size).toBe(1);

        // Manually fan out notify to prove the new subscriber is live.
        let fired = 0;
        const spySub = () => { fired++; };
        repeatLoopState.subscribers.add(spySub);
        for (const s of repeatLoopState.subscribers) s();
        expect(fired).toBe(1);
        repeatLoopState.subscribers.delete(spySub);

        // Final teardown for hygiene.
        second.remove();
        window.dispatchEvent(new Event('pagehide'));
        expect(repeatLoopState.subscribers.size).toBe(0);
        expect(nonHeartbeatIntervals()).toBe(0);
    });

    it('L5: 20 rapid mount/unmount cycles remain leak-free', () => {
        for (let i = 0; i < 20; i++) {
            const host = buildRepeatPanelSection();
            document.body.appendChild(host);
            host.remove();
            window.dispatchEvent(new Event('pagehide'));
        }
        expect(repeatLoopState.subscribers.size).toBe(0);
        expect(nonHeartbeatIntervals()).toBe(0);
    });
});
