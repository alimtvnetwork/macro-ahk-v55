/**
 * pending-restore-undo.ts — Persist a restore's undo intent across page
 * reloads so the Undo affordance survives a quick refresh within the
 * timeout window.
 *
 * Design
 * ------
 * The History-panel restore path writes a serializable record to
 * `localStorage` immediately after a successful upsert. On next module
 * load (fresh page or hot reload) `hydratePendingRestoreUndo()` reads the
 * record; if it is still within its `expiresAt` window it re-renders the
 * same undo toast with the remaining seconds. Applying or letting the
 * toast expire clears the record so we never "undo" twice.
 *
 * The stored record only holds the minimum needed to reverse the write:
 *   - update path: the pre-image (id/body/replaceKey/replaceValues) plus
 *     the just-restored body (used as `previousBody` for the drift guard).
 *   - insert path: the id of the newly inserted row.
 *
 * We intentionally use `localStorage` rather than IndexedDB so the
 * hydrator can run synchronously during module init and doesn't require
 * the storage layer to be booted before the toast can re-appear.
 */

import { deletePromptById, upsertPrompt } from '../db/prompt-db';
import type { PromptRole } from '../types/prompt-role';
import { logError } from '../error-utils';
import { showToast } from '../toast';
import { showUndoToast } from './prompt-utils';

const STORAGE_KEY = 'marco.pendingRestoreUndo.v1';
const LOG_SCOPE = 'pending-restore-undo';

interface UpdatePayload {
    kind: 'update';
    restoredId: number;
    /** Body written by the restore (drift-guard `previousBody`). */
    restoredBody: string;
    /** ReplaceKey written by the restore (drift-guard `previousReplaceKey`). */
    restoredReplaceKey: string;
    slug: string;
    name: string;
    role: PromptRole;
    /** Pre-image to write back on undo. */
    preBody: string;
    preReplaceKey: string;
    preReplaceValues: string[];
}

interface InsertPayload {
    kind: 'insert';
    newId: number;
}

type Payload = UpdatePayload | InsertPayload;

export interface PendingRestoreUndo {
    payload: Payload;
    message: string;
    undoLabel: string;
    createdAt: number;
    expiresAt: number;
}

function safeLocalStorage(): Storage | null {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return window.localStorage;
    } catch {
        return null;
    }
}

export function writePendingRestoreUndo(record: PendingRestoreUndo): void {
    const store = safeLocalStorage();
    if (!store) return;
    try {
        store.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (err) {
        logError(LOG_SCOPE, 'write failed', err);
    }
}

export function readPendingRestoreUndo(): PendingRestoreUndo | null {
    const store = safeLocalStorage();
    if (!store) return null;
    let raw: string | null = null;
    try {
        raw = store.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (raw === null || raw === '') return null;
    try {
        const parsed = JSON.parse(raw) as PendingRestoreUndo;
        if (!parsed || typeof parsed !== 'object') return null;
        if (typeof parsed.expiresAt !== 'number' || typeof parsed.createdAt !== 'number') return null;
        if (!parsed.payload || typeof parsed.payload !== 'object') return null;
        return parsed;
    } catch (err) {
        logError(LOG_SCOPE, 'parse failed', err);
        return null;
    }
}

export function clearPendingRestoreUndo(): void {
    const store = safeLocalStorage();
    if (!store) return;
    try {
        store.removeItem(STORAGE_KEY);
    } catch {
        /* no-op */
    }
}

async function reverseUpdate(p: UpdatePayload): Promise<{ ok: boolean; error?: string }> {
    const revert = await upsertPrompt({
        id: p.restoredId,
        previousBody: p.restoredBody,
        previousReplaceKey: p.restoredReplaceKey,
        slug: p.slug,
        name: p.name,
        body: p.preBody,
        role: p.role,
        replaceKey: p.preReplaceKey,
        replaceValues: p.preReplaceValues,
    });
    return revert.ok ? { ok: true } : { ok: false, error: revert.error ?? 'unknown' };
}

async function reverseInsert(p: InsertPayload): Promise<{ ok: boolean; error?: string }> {
    const del = await deletePromptById(p.newId);
    return del.ok ? { ok: true } : { ok: false, error: del.error ?? 'unknown' };
}

/**
 * Re-attach an undo toast for a pending record if one is present and has
 * not yet expired. Safe to call multiple times: consuming or expiring the
 * toast clears the record. Returns `true` if a toast was re-rendered.
 */
export function hydratePendingRestoreUndo(now: number = Date.now()): boolean {
    const record = readPendingRestoreUndo();
    if (!record) return false;
    const remaining = record.expiresAt - now;
    if (remaining <= 0) {
        clearPendingRestoreUndo();
        return false;
    }
    const restoredId = record.payload.kind === 'update'
        ? record.payload.restoredId
        : record.payload.newId;

    showUndoToast(record.message, async () => {
        clearPendingRestoreUndo();
        const result = record.payload.kind === 'update'
            ? await reverseUpdate(record.payload)
            : await reverseInsert(record.payload);
        if (!result.ok) {
            logError(LOG_SCOPE, 'reverse failed after refresh', result.error);
            showToast('❌ Undo failed: ' + (result.error ?? 'unknown'), 'error');
            return;
        }
        showToast('↺ Reverted restore', 'success');
    }, {
        undoLabel: record.undoLabel,
        timeoutMs: remaining,
        restoredId,
    });

    // Clear on expiry too. showUndoToast auto-dismisses after `remaining`;
    // we drop the record shortly after to keep localStorage tidy even if
    // the user never clicks Undo.
    setTimeout(() => {
        const current = readPendingRestoreUndo();
        if (current && current.createdAt === record.createdAt) {
            clearPendingRestoreUndo();
        }
    }, remaining + 500);

    return true;
}

// Auto-hydrate on module load in a real browser context. Tests import the
// named helpers directly and drive them explicitly, so we gate on
// `document` to avoid firing during Node-side unit tests.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Defer to the next tick so consumers that import this module during
    // extension boot don't race with database availability.
    setTimeout(() => {
        try {
            hydratePendingRestoreUndo();
        } catch (err) {
            logError(LOG_SCOPE, 'auto-hydrate threw', err);
        }
    }, 0);
}
