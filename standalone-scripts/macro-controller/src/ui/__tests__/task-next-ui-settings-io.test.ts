/**
 * G3: Settings I/O coverage for task-next-ui.
 *
 * Locks the actual (as-shipped) behavior of loadTaskNextSettings and
 * saveTaskNextSettings, including the three easy-to-regress branches:
 *   - Known keys are copied from the saved blob (line 70-72).
 *   - `requireStartForMultiRun` is FORCED to true even if the saved blob
 *     had it false (line 74). This is deliberate — the user is opted-in
 *     to the guard on every load and cannot inadvertently disable it via
 *     stale KV state.
 *   - Unknown keys in the saved blob are silently dropped.
 *   - Malformed JSON produces a warn log and leaves defaults intact —
 *     never throws to the caller.
 *   - Missing/empty KV response leaves defaults intact and still fires callback.
 *   - saveTaskNextSettings serializes the current in-memory settings
 *     under the fixed KV key/projectId contract.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
    loadTaskNextSettings,
    saveTaskNextSettings,
    taskNextState,
    type TaskNextDeps,
} from '../../ui/task-next-ui';

type MockSend = Mock<(type: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>>;
function makeDeps(overrides: Partial<TaskNextDeps> = {}): TaskNextDeps & { sendToExtension: MockSend } {
    const send: MockSend = vi.fn();
    return {
        sendToExtension: send,
        getPromptsConfig: () => ({ entries: [] }) as unknown as ReturnType<TaskNextDeps['getPromptsConfig']>,
        getByXPath: () => null,
        ...overrides,
    } as TaskNextDeps & { sendToExtension: MockSend };
}

const originalSettings = { ...taskNextState.settings };

beforeEach(() => {
    // Reset to shipped defaults before each test.
    Object.assign(taskNextState.settings, originalSettings);
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'warn').mockImplementation(() => { /* silent */ });
});

afterEach(() => {
    Object.assign(taskNextState.settings, originalSettings);
    vi.restoreAllMocks();
});

describe('loadTaskNextSettings — positive paths', () => {
    it('copies known keys from the saved blob and fires callback', async () => {
        const saved = {
            preClickDelayMs: 999,
            postClickDelayMs: 1234,
            retryCount: 7,
            retryDelayMs: 555,
            buttonXPath: '//custom',
            promptSlug: 'my-slug',
        };
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({ value: JSON.stringify(saved) });

        const callback = vi.fn();
        loadTaskNextSettings(deps, callback);
        await new Promise((r) => setTimeout(r, 0));

        expect(deps.sendToExtension).toHaveBeenCalledWith('KV_GET', {
            key: 'task_next_settings',
            projectId: '_global',
        });
        expect(taskNextState.settings.preClickDelayMs).toBe(999);
        expect(taskNextState.settings.postClickDelayMs).toBe(1234);
        expect(taskNextState.settings.retryCount).toBe(7);
        expect(taskNextState.settings.retryDelayMs).toBe(555);
        expect(taskNextState.settings.buttonXPath).toBe('//custom');
        expect(taskNextState.settings.promptSlug).toBe('my-slug');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('forces requireStartForMultiRun=true even when saved blob has it false', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({
            value: JSON.stringify({ requireStartForMultiRun: false, preClickDelayMs: 42 }),
        });

        loadTaskNextSettings(deps);
        await new Promise((r) => setTimeout(r, 0));

        expect(taskNextState.settings.requireStartForMultiRun).toBe(true);
        // Sanity: the sibling known key still applied.
        expect(taskNextState.settings.preClickDelayMs).toBe(42);
    });

    it('silently drops unknown keys from the saved blob', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({
            value: JSON.stringify({ notARealKey: 'evil', preClickDelayMs: 111 }),
        });

        loadTaskNextSettings(deps);
        await new Promise((r) => setTimeout(r, 0));

        expect((taskNextState.settings as Record<string, unknown>).notARealKey).toBeUndefined();
        expect(taskNextState.settings.preClickDelayMs).toBe(111);
    });
});

describe('loadTaskNextSettings — negative paths', () => {
    it('leaves defaults intact and fires callback when KV response is empty', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({});

        const callback = vi.fn();
        loadTaskNextSettings(deps, callback);
        await new Promise((r) => setTimeout(r, 0));

        expect(taskNextState.settings).toEqual(originalSettings);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not throw when malformed JSON is stored (defaults survive)', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({ value: '{not-json' });

        const callback = vi.fn();
        expect(() => loadTaskNextSettings(deps, callback)).not.toThrow();
        await new Promise((r) => setTimeout(r, 0));

        expect(taskNextState.settings).toEqual(originalSettings);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('omitting callback is safe (no throw when saved blob is valid)', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({ value: JSON.stringify({ retryCount: 2 }) });

        expect(() => loadTaskNextSettings(deps)).not.toThrow();
        await new Promise((r) => setTimeout(r, 0));
        expect(taskNextState.settings.retryCount).toBe(2);
    });
});

describe('saveTaskNextSettings', () => {
    it('serializes the current in-memory settings under the fixed KV contract', async () => {
        taskNextState.settings.preClickDelayMs = 321;
        taskNextState.settings.promptSlug = 'next-tasks';

        const deps = makeDeps();
        deps.sendToExtension.mockResolvedValue({});

        saveTaskNextSettings(deps);
        await new Promise((r) => setTimeout(r, 0));

        expect(deps.sendToExtension).toHaveBeenCalledTimes(1);
        const [type, payload] = deps.sendToExtension.mock.calls[0];
        expect(type).toBe('KV_SET');
        expect(payload).toMatchObject({
            key: 'task_next_settings',
            projectId: '_global',
        });
        const roundTrip = JSON.parse(payload.value as string);
        expect(roundTrip.preClickDelayMs).toBe(321);
        expect(roundTrip.promptSlug).toBe('next-tasks');
        expect(roundTrip.requireStartForMultiRun).toBe(true);
    });
});

/** Return a promise that rejects on the next microtask so both the mock
 *  return value AND the derived `.then(callback)` promise inside the code under
 *  test can be pre-observed, preventing vitest from recording either as
 *  an unhandled rejection. */
function rejectedSilently(err: Error): Promise<never> {
    const p = new Promise<never>((_res, rej) => { setTimeout(() => rej(err), 0); });
    p.catch(() => { /* silence outer */ });
    return p;
}

/** Install a scoped unhandledRejection swallower for tests that
 *  intentionally trigger a rejection the SUT does not catch. Removes the
 *  listener on cleanup so no other suite is affected. */
function suppressUnhandledRejections(): () => void {
    const handler = () => { /* swallow */ };
    process.on('unhandledRejection', handler);
    return () => process.off('unhandledRejection', handler);
}


describe('loadTaskNextSettings, storage-throw cases', () => {
    let restore: () => void;
    beforeEach(() => { restore = suppressUnhandledRejections(); });
    afterEach(() => { restore(); });


    it('does not throw synchronously when KV_GET rejects', () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => rejectedSilently(new Error('storage offline')));

        expect(() => loadTaskNextSettings(deps, vi.fn())).not.toThrow();
    });

    it('leaves defaults intact and does not fire callback when KV_GET rejects', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => rejectedSilently(new Error('storage offline')));

        const callback = vi.fn();
        loadTaskNextSettings(deps, callback);
        await new Promise((r) => setTimeout(r, 0));

        expect(taskNextState.settings).toEqual(originalSettings);
        expect(callback).not.toHaveBeenCalled();
    });

    it('propagates synchronous throws from the bridge to the caller', () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => { throw new Error('bridge missing'); });

        expect(() => loadTaskNextSettings(deps, vi.fn())).toThrow('bridge missing');
        // Sanity: synchronous throw means defaults never mutated.
        expect(taskNextState.settings).toEqual(originalSettings);
    });
});

describe('saveTaskNextSettings, storage-throw cases', () => {
    let restore: () => void;
    beforeEach(() => { restore = suppressUnhandledRejections(); });
    afterEach(() => { restore(); });


    it('does not throw synchronously when KV_SET rejects', () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => rejectedSilently(new Error('quota exceeded')));

        expect(() => saveTaskNextSettings(deps)).not.toThrow();
    });

    it('still emits exactly one KV_SET call even when the promise rejects', async () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => rejectedSilently(new Error('quota exceeded')));

        saveTaskNextSettings(deps);
        await new Promise((r) => setTimeout(r, 0));

        expect(deps.sendToExtension).toHaveBeenCalledTimes(1);
        expect(deps.sendToExtension.mock.calls[0][0]).toBe('KV_SET');
    });

    it('propagates synchronous throws from the bridge to the caller', () => {
        const deps = makeDeps();
        deps.sendToExtension.mockImplementation(() => { throw new Error('bridge missing'); });

        expect(() => saveTaskNextSettings(deps)).toThrow('bridge missing');
    });
});
