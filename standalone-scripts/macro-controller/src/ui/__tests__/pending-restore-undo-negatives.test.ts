/**
 * Plan 22 gap #6: Undo path negative branches for `pending-restore-undo.ts`.
 *
 * Complements `pending-restore-undo.test.ts` (happy-path coverage) by pinning
 * the failure and shape-guard branches that a silent regression could break:
 *
 *  U1: reverseUpdate FAIL -> `showToast('❌ Undo failed: ...')` + logError,
 *      record already cleared before the reverse call (no double-undo).
 *  U2: reverseInsert FAIL -> same error-toast pipeline surfaces DB error.
 *  U3: readPendingRestoreUndo rejects a payload missing `expiresAt`.
 *  U4: readPendingRestoreUndo rejects a payload missing `.payload`.
 *  U5: writePendingRestoreUndo swallows a setItem throw (localStorage quota)
 *      and logs via `logError` — never propagates to callers.
 *  U6: expiry auto-clear only fires when `createdAt` still matches, so a
 *      fresh restore written during the tail window is NOT clobbered by the
 *      previous record's timer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('../../error-utils', () => ({
    logError: (...args: unknown[]) => logErrorSpy(...args),
    toErrorMessage: (e: unknown) => String(e),
}));
vi.mock('../../db/prompt-db', () => ({
    upsertPrompt: vi.fn(),
    deletePromptById: vi.fn(),
}));
vi.mock('../../toast', () => ({ showToast: vi.fn() }));

import {
    writePendingRestoreUndo,
    readPendingRestoreUndo,
    hydratePendingRestoreUndo,
    type PendingRestoreUndo,
} from '../pending-restore-undo';
import { upsertPrompt, deletePromptById } from '../../db/prompt-db';
import { showToast } from '../../toast';

const asMock = <T>(v: T) => v as unknown as Mock;

function makeUpdateRecord(overrides?: Partial<PendingRestoreUndo>): PendingRestoreUndo {
    const now = Date.now();
    return {
        payload: {
            kind: 'update', restoredId: 7, restoredBody: 'NEW', restoredReplaceKey: 'n',
            slug: 'plan', name: 'Plan', role: 'plan',
            preBody: 'OLD', preReplaceKey: 'n', preReplaceValues: ['1', '2'],
        },
        message: 'Restored', undoLabel: 'Undo restore',
        createdAt: now, expiresAt: now + 10_000,
        ...overrides,
    };
}

beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    logErrorSpy.mockClear();
    asMock(showToast).mockClear();
    asMock(upsertPrompt).mockReset();
    asMock(deletePromptById).mockReset();
    vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('pending-restore-undo: negative branches (Plan 22 gap #6)', () => {
    it('U1: reverseUpdate failure surfaces error toast and clears record before reverse call', async () => {
        asMock(upsertPrompt).mockResolvedValue({ ok: false, error: 'DRIFT' });
        writePendingRestoreUndo(makeUpdateRecord());
        hydratePendingRestoreUndo();
        // Record must be cleared *synchronously* on click, before the async reverse resolves,
        // so a second click cannot fire the same undo twice.
        document.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]')!.click();
        expect(readPendingRestoreUndo()).toBeNull();
        await vi.runAllTimersAsync();
        await Promise.resolve(); await Promise.resolve();
        expect(upsertPrompt).toHaveBeenCalledTimes(1);
        const toastCalls = asMock(showToast).mock.calls;
        expect(toastCalls.some((c) => String(c[0]).includes('Undo failed') && String(c[0]).includes('DRIFT') && c[1] === 'error')).toBe(true);
        expect(logErrorSpy).toHaveBeenCalledWith('pending-restore-undo', 'reverse failed after refresh', 'DRIFT');
    });

    it('U2: reverseInsert failure surfaces error toast', async () => {
        asMock(deletePromptById).mockResolvedValue({ ok: false, error: 'ROW_LOCKED' });
        const now = Date.now();
        writePendingRestoreUndo({
            payload: { kind: 'insert', newId: 42 },
            message: 'Restored', undoLabel: 'Undo', createdAt: now, expiresAt: now + 5000,
        });
        hydratePendingRestoreUndo(now);
        document.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]')!.click();
        await vi.runAllTimersAsync();
        await Promise.resolve(); await Promise.resolve();
        expect(deletePromptById).toHaveBeenCalledWith(42);
        const toastCalls = asMock(showToast).mock.calls;
        expect(toastCalls.some((c) => String(c[0]).includes('ROW_LOCKED') && c[1] === 'error')).toBe(true);
    });

    it('U3: rejects payloads with missing expiresAt', () => {
        window.localStorage.setItem('marco.pendingRestoreUndo.v1', JSON.stringify({
            payload: { kind: 'insert', newId: 1 },
            message: 'x', undoLabel: 'x', createdAt: Date.now(),
        }));
        expect(readPendingRestoreUndo()).toBeNull();
    });

    it('U4: rejects payloads with missing .payload object', () => {
        window.localStorage.setItem('marco.pendingRestoreUndo.v1', JSON.stringify({
            message: 'x', undoLabel: 'x', createdAt: Date.now(), expiresAt: Date.now() + 5000,
        }));
        expect(readPendingRestoreUndo()).toBeNull();
    });

    it('U5: setItem throwing (quota) is swallowed and logged', () => {
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QUOTA_EXCEEDED');
        });
        try {
            expect(() => writePendingRestoreUndo(makeUpdateRecord())).not.toThrow();
            expect(logErrorSpy).toHaveBeenCalledWith('pending-restore-undo', 'write failed', expect.any(Error));
        } finally {
            setItemSpy.mockRestore();
        }
    });

    it('U6: expiry auto-clear guard leaves a fresher record intact', () => {
        const t0 = Date.now();
        const oldRec = makeUpdateRecord({ createdAt: t0, expiresAt: t0 + 1000 });
        writePendingRestoreUndo(oldRec);
        hydratePendingRestoreUndo(t0);
        // Advance past expiry then write a NEW record with a different createdAt.
        vi.advanceTimersByTime(500);
        const newRec = makeUpdateRecord({ createdAt: t0 + 500, expiresAt: t0 + 10_000 });
        writePendingRestoreUndo(newRec);
        // Fire the tail timer for the old record (remaining + 500 ms).
        vi.advanceTimersByTime(2000);
        const survivor = readPendingRestoreUndo();
        expect(survivor).not.toBeNull();
        expect(survivor!.createdAt).toBe(t0 + 500);
    });
});
