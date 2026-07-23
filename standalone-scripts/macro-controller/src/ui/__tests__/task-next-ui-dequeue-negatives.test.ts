/**
 * Plan 22 gap #12 (task-next-ui side): negative-path coverage for
 * `dequeueTaskNextPrompt` in `ui/task-next-ui.ts:199-213`.
 *
 * Root cause of the design under test: the queue read is the ONLY place where
 * a persistent-queue failure can silently abort a Next-click. When
 * `getPersistentTaskQueue().dequeue()` throws, the function MUST:
 *   1. log via `logError('Task Next queue', ..., caught)` with the exact
 *      message locked below.
 *   2. surface `showPasteToast('❌ Task Next: queue read failed', true)`.
 *   3. return `{ selection: null, failed: true }` so the caller aborts
 *      instead of falling through to the legacy DOM-scrape prompt.
 *
 * Positive controls (Q1, Q2) also live here so the negative diff is anchored.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dequeueMock = vi.hoisted(() => vi.fn());
const countMock = vi.hoisted(() => vi.fn());
const resolveProjectIdMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const showPasteToastMock = vi.hoisted(() => vi.fn());

vi.mock('../../queue-control/task-queue-project-store', () => ({
    getPersistentTaskQueue: () => ({ dequeue: dequeueMock, count: countMock }),
    resolveTaskQueueProjectId: resolveProjectIdMock,
}));
vi.mock('../../error-utils', () => ({
    logError: logErrorMock,
}));
vi.mock('../prompt-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../prompt-utils')>();
    return {
        ...actual,
        showPasteToast: showPasteToastMock,
        pasteIntoEditor: vi.fn(),
    };
});

import { dequeueTaskNextPrompt } from '../task-next-ui';

beforeEach(() => {
    dequeueMock.mockReset();
    countMock.mockReset();
    resolveProjectIdMock.mockReset().mockReturnValue('proj-1');
    logErrorMock.mockReset();
    showPasteToastMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('dequeueTaskNextPrompt — negative branches', () => {
    it('Q1 (positive control): returns selection when queue has an item', async () => {
        dequeueMock.mockResolvedValueOnce({ text: 'hello' });
        countMock.mockResolvedValueOnce(3);

        const result = await dequeueTaskNextPrompt();

        expect(result.failed).toBe(false);
        expect(result.selection).toEqual({ text: 'hello', source: 'queue', remaining: 3 });
        expect(logErrorMock).not.toHaveBeenCalled();
        expect(showPasteToastMock).not.toHaveBeenCalled();
    });

    it('Q2 (positive control): empty queue returns null selection without failing', async () => {
        dequeueMock.mockResolvedValueOnce(null);

        const result = await dequeueTaskNextPrompt();

        expect(result).toEqual({ selection: null, failed: false });
        expect(logErrorMock).not.toHaveBeenCalled();
        expect(showPasteToastMock).not.toHaveBeenCalled();
    });

    it('Q3: queue.dequeue() throwing logs via logError with exact scope+message', async () => {
        const err = new Error('sqlite disk full');
        dequeueMock.mockRejectedValueOnce(err);

        const result = await dequeueTaskNextPrompt();

        expect(logErrorMock).toHaveBeenCalledTimes(1);
        expect(logErrorMock).toHaveBeenCalledWith(
            'Task Next queue',
            'dequeue failed before single Next injection; aborting fallback',
            err,
        );
        expect(result).toEqual({ selection: null, failed: true });
    });

    it('Q4: queue.dequeue() throwing surfaces the failure toast (not silent)', async () => {
        dequeueMock.mockRejectedValueOnce(new Error('locked'));

        await dequeueTaskNextPrompt();

        expect(showPasteToastMock).toHaveBeenCalledTimes(1);
        expect(showPasteToastMock).toHaveBeenCalledWith('❌ Task Next: queue read failed', true);
    });

    it('Q5: queue.count() throwing after a successful dequeue still surfaces failed:true', async () => {
        dequeueMock.mockResolvedValueOnce({ text: 'x' });
        countMock.mockRejectedValueOnce(new Error('count blew up'));

        const result = await dequeueTaskNextPrompt();

        expect(result.failed).toBe(true);
        expect(result.selection).toBeNull();
        expect(logErrorMock).toHaveBeenCalledWith(
            'Task Next queue',
            'dequeue failed before single Next injection; aborting fallback',
            expect.any(Error),
        );
    });
});
