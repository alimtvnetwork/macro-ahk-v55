/**
 * prompt-library-modal - Dragover `dropEffect` reflects import concurrency.
 *
 * The dragover handler sets `dataTransfer.dropEffect`:
 *   - 'copy' when idle (drop will be accepted)
 *   - 'none' while performPromptImport is in flight (drop is refused)
 *
 * This gives the browser's native drag cursor accurate feedback: users see
 * the "not allowed" cursor mid-import and the "copy" cursor once the modal
 * is ready again.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
const mocks = vi.hoisted(() => ({ logError: vi.fn(), showToast: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: mocks.logError }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));

vi.mock('../prompt-cache', () => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] as unknown[] })),
    writeJsonCopy: vi.fn(async () => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));
vi.mock('../prompt-io-db-bridge', () => ({
    collectDbEntriesForExport: vi.fn(async () => []),
    mergeDbIntoExport: vi.fn((c: unknown[]) => c),
    partitionByRole: vi.fn((e: unknown[]) => ({ dbEntries: [], cacheEntries: e })),
    commitDbEntries: vi.fn(async () => ({ upserted: 0, errors: [] })),
}));
vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: vi.fn(async () => ({ ok: true, value: [] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));

const io = vi.hoisted(() => {
    let releaseFn: (() => void) | null = null;
    return {
        exportPromptsToJson: vi.fn(async () => undefined),
        parsePromptsText: vi.fn(() => ({
            valid: [{ name: 'p', text: 'body {{n}}' }],
            errors: [] as string[],
        })),
        performPromptImport: vi.fn(
            () => new Promise<{ added: number; updated: number; errors: string[] }>((resolve) => {
                releaseFn = (): void => resolve({ added: 1, updated: 0, errors: [] });
            }),
        ),
        release: (): void => { if (releaseFn) releaseFn(); },
    };
});
vi.mock('../prompt-io', () => ({
    exportPromptsToJson: io.exportPromptsToJson,
    parsePromptsText: io.parsePromptsText,
    performPromptImport: io.performPromptImport,
}));

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}

/**
 * Dispatch a real dragover Event and attach a mutable dataTransfer stub so
 * the handler can write dropEffect back into it. Returns the stub for
 * assertions.
 */
function fireDragOver(root: HTMLElement): { dropEffect: string } {
    const dt: { dropEffect: string } = { dropEffect: 'copy' };
    const ev = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
    return dt;
}

function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - dragover dropEffect during import', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
        io.parsePromptsText.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('reports dropEffect="copy" when idle, "none" while import runs, and "copy" again after it resolves', async () => {
        await openPromptLibraryModal();
        await tick();
        const root = getRoot();

        // Idle: dragover advertises 'copy'.
        expect(fireDragOver(root).dropEffect).toBe('copy');

        // Kick off a deferred import via drop.
        fireDrop(root, 'a.json');
        await tick();
        await tick();

        // Import is in flight (spinner + aria-busy). dragover MUST advertise 'none'.
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('aria-busy')).toBe('true');
        expect(fireDragOver(root).dropEffect).toBe('none');

        // Resolve the pending import.
        io.release();
        await tick(); await tick(); await tick();

        // Controls restored; dragover advertises 'copy' again.
        expect(btn.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(fireDragOver(root).dropEffect).toBe('copy');

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
    });
});
