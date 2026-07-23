/**
 * Unit tests for `pending-restore-undo` (survive-refresh Undo).
 *
 * Verifies:
 *   - write/read/clear round-trip through localStorage.
 *   - hydrate re-renders an undo toast when the record is still fresh.
 *   - hydrate skips (and clears) an expired record.
 *   - hydrate invokes the correct reverse operation for update vs insert.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../db/prompt-db', () => ({
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
    deletePromptById: vi.fn(async () => ({ ok: true, value: undefined })),
}));

vi.mock('../../toast', () => ({
    showToast: vi.fn(),
}));

import {
    writePendingRestoreUndo,
    readPendingRestoreUndo,
    clearPendingRestoreUndo,
    hydratePendingRestoreUndo,
    type PendingRestoreUndo,
} from '../pending-restore-undo';
import { upsertPrompt, deletePromptById } from '../../db/prompt-db';

beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.useFakeTimers();
    (upsertPrompt as unknown as { mockClear: () => void }).mockClear();
    (deletePromptById as unknown as { mockClear: () => void }).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

function makeUpdateRecord(overrides?: Partial<PendingRestoreUndo>): PendingRestoreUndo {
    const now = Date.now();
    return {
        payload: {
            kind: 'update',
            restoredId: 7,
            restoredBody: 'NEW',
            restoredReplaceKey: 'n',
            slug: 'plan',
            name: 'Plan',
            role: 'plan',
            preBody: 'OLD',
            preReplaceKey: 'n',
            preReplaceValues: ['1', '2'],
        },
        message: '✅ Restored',
        undoLabel: 'Undo restore',
        createdAt: now,
        expiresAt: now + 10_000,
        ...overrides,
    };
}

describe('pending-restore-undo', () => {
    it('round-trips a record through localStorage', () => {
        const rec = makeUpdateRecord();
        writePendingRestoreUndo(rec);
        const read = readPendingRestoreUndo();
        expect(read).not.toBeNull();
        expect(read!.payload.kind).toBe('update');
        expect(read!.message).toBe('✅ Restored');
    });

    it('clear removes the record', () => {
        writePendingRestoreUndo(makeUpdateRecord());
        clearPendingRestoreUndo();
        expect(readPendingRestoreUndo()).toBeNull();
    });

    it('hydrate re-renders an undo toast when record is fresh', () => {
        const now = Date.now();
        writePendingRestoreUndo(makeUpdateRecord({ createdAt: now, expiresAt: now + 5000 }));
        const rendered = hydratePendingRestoreUndo(now);
        expect(rendered).toBe(true);
        const toast = document.querySelector('[data-testid="undo-toast"]');
        expect(toast).not.toBeNull();
        const chip = document.querySelector('[data-testid="undo-toast-restored-id"]');
        expect(chip!.textContent).toBe('#7');
    });

    it('hydrate skips and clears an expired record', () => {
        const past = Date.now() - 20_000;
        writePendingRestoreUndo(makeUpdateRecord({ createdAt: past, expiresAt: past + 5000 }));
        const rendered = hydratePendingRestoreUndo();
        expect(rendered).toBe(false);
        expect(readPendingRestoreUndo()).toBeNull();
        expect(document.querySelector('[data-testid="undo-toast"]')).toBeNull();
    });

    it('clicking Undo on a hydrated toast calls upsertPrompt with the pre-image', async () => {
        const now = Date.now();
        writePendingRestoreUndo(makeUpdateRecord({ createdAt: now, expiresAt: now + 5000 }));
        hydratePendingRestoreUndo(now);
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]');
        btn!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(upsertPrompt).toHaveBeenCalledTimes(1);
        const arg = (upsertPrompt as unknown as { mock: { calls: Array<Array<Record<string, unknown>>> } }).mock.calls[0][0];
        expect(arg.id).toBe(7);
        expect(arg.body).toBe('OLD');
        expect(arg.previousBody).toBe('NEW');
        expect(readPendingRestoreUndo()).toBeNull();
    });

    it('insert-path Undo calls deletePromptById with the new row id', async () => {
        const now = Date.now();
        writePendingRestoreUndo({
            payload: { kind: 'insert', newId: 42 },
            message: 'Restored',
            undoLabel: 'Undo restore',
            createdAt: now,
            expiresAt: now + 5000,
        });
        hydratePendingRestoreUndo(now);
        document.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]')!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(deletePromptById).toHaveBeenCalledWith(42);
    });

    it('ignores a corrupted localStorage payload without throwing', () => {
        window.localStorage.setItem('marco.pendingRestoreUndo.v1', '{not-json');
        expect(() => hydratePendingRestoreUndo()).not.toThrow();
        expect(document.querySelector('[data-testid="undo-toast"]')).toBeNull();
    });
});
