/**
 * Read Memory Admin Modal
 *
 * Verifies:
 * - Renders one row per Read Memory prompt returned from SQLite.
 * - Canonical `read-memory-enhanced` row shows a disabled Deactivate button.
 * - Clicking Deactivate on a non-canonical row issues an UPDATE that sets
 *   `IsDefault = 0` and prefixes `Name` with `[duplicate] `, then refreshes.
 * - Modal is idempotent (second `open` call is a no-op).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface CapturedCall { method: string; sql: string }
interface QueuedResponse { isOk: boolean; rows?: unknown[]; errorMessage?: string }

const captured: CapturedCall[] = [];
let responsesQueue: QueuedResponse[] = [];
const clearPromptCacheSpy = vi.fn(async () => { /* void */ });

vi.mock('../extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return responsesQueue.shift() ?? { isOk: true };
    }),
}));
vi.mock('../prompt-cache', () => ({ clearPromptCache: clearPromptCacheSpy }));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import {
    openReadMemoryAdminModal,
    READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST,
    READ_MEMORY_ADMIN_DUPLICATE_PREFIX_FOR_TEST,
    READ_MEMORY_ADMIN_CANONICAL_SLUG_FOR_TEST,
} from '../read-memory-admin-modal';

beforeEach(() => {
    document.body.innerHTML = '';
    captured.length = 0;
    responsesQueue = [];
    clearPromptCacheSpy.mockClear();
});

function queueRows(rows: unknown[]): void {
    responsesQueue.push({ isOk: true, rows });
}

describe('openReadMemoryAdminModal', () => {
    it('renders a row per Read Memory prompt with correct action state', async () => {
        queueRows([
            { Id: 1, Slug: READ_MEMORY_ADMIN_CANONICAL_SLUG_FOR_TEST, Name: 'Read Memory (Enhanced)', IsDefault: 1 },
            { Id: 2, Slug: 'read-memory', Name: 'Read Memory', IsDefault: 1 },
        ]);
        await openReadMemoryAdminModal();
        const modal = document.getElementById(READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST);
        expect(modal).not.toBeNull();
        const buttons = modal?.querySelectorAll('button') ?? [];
        expect(buttons.length).toBe(2);
        expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
        expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
        expect((buttons[1] as HTMLButtonElement).textContent).toBe('Deactivate');
    });

    it('is idempotent: second open call is a no-op', async () => {
        queueRows([]);
        await openReadMemoryAdminModal();
        const initial = captured.length;
        await openReadMemoryAdminModal();
        expect(captured.length).toBe(initial);
        expect(document.querySelectorAll('#' + READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST).length).toBe(1);
    });

    it('deactivating a row issues UPDATE with [duplicate] prefix and clears cache', async () => {
        queueRows([{ Id: 42, Slug: 'read-memory-legacy', Name: 'Read Memory Legacy', IsDefault: 1 }]);
        responsesQueue.push({ isOk: true });
        queueRows([{ Id: 42, Slug: 'read-memory-legacy', Name: READ_MEMORY_ADMIN_DUPLICATE_PREFIX_FOR_TEST + 'Read Memory Legacy', IsDefault: 0 }]);
        await openReadMemoryAdminModal();
        const activeBtn = document.querySelector<HTMLButtonElement>('button:not([disabled])');
        expect(activeBtn).not.toBeNull();
        activeBtn?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        const updateCall = captured.find((c) => c.method === 'SCHEMA');
        expect(updateCall?.sql).toContain('UPDATE Prompt');
        expect(updateCall?.sql).toContain('IsDefault = 0');
        expect(updateCall?.sql).toContain(READ_MEMORY_ADMIN_DUPLICATE_PREFIX_FOR_TEST);
        expect(updateCall?.sql).toContain('Id = 42');
        expect(clearPromptCacheSpy).toHaveBeenCalled();
    });

    it('shows an empty state when no rows match', async () => {
        queueRows([]);
        await openReadMemoryAdminModal();
        const modal = document.getElementById(READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST);
        expect(modal?.textContent).toContain('No Read Memory prompts found');
    });
});
