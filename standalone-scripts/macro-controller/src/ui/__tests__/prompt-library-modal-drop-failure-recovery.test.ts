/**
 * prompt-library-modal - Drop-path failure recovery.
 *
 * When a drag-and-drop import fails (performPromptImport throws), the modal
 * must:
 *   - Re-enable the Import button and hidden file input
 *   - Remove aria-busy from the Import button
 *   - Move focus to the aria-live error banner so the failure is immediately
 *     reachable by keyboard users
 *   - Re-enable the drop zone: subsequent dragover advertises 'copy' and a
 *     follow-up drop actually invokes performPromptImport again
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

const io = vi.hoisted(() => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    parsePromptsText: vi.fn(() => ({
        valid: [{ name: 'p', text: 'body {{n}}' }],
        errors: [] as string[],
    })),
    performPromptImport: vi.fn(),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}
function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}

function fireDragOver(root: HTMLElement): string {
    const dt: { dropEffect: string } = { dropEffect: 'copy' };
    const ev = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
    return dt.dropEffect;
}

function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - drop-path failure recovery', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('re-enables controls, restores focus to Import button, and re-arms the drop zone after a failed drop import', async () => {
        io.performPromptImport
            .mockRejectedValueOnce(new Error('DB write refused'))
            .mockResolvedValueOnce({ added: 1, updated: 0, errors: [] });

        await openPromptLibraryModal();
        await tick();

        const root = getRoot();
        const btn = getImportBtn();
        const fileInput = getFileInput();

        // Sanity: drop zone idle.
        expect(fireDragOver(root)).toBe('copy');

        // Drop -> triggers failing import.
        fireDrop(root, 'first.json');
        await tick(); await tick(); await tick();

        // Controls fully restored after failure.
        expect(btn.disabled).toBe(false);
        expect(fileInput.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(fileInput.value).toBe('');
        expect(mocks.logError).toHaveBeenCalled();

        // Focus moved to the error banner so keyboard users land on it.
        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
        expect(banner).not.toBeNull();
        expect(banner!.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(banner);

        // Failure banner surfaces the reason (drop path shares the same catch).
        const bannerText = document.querySelector('[data-testid="library-import-error"]')?.textContent ?? '';
        expect(bannerText).toContain('DB write refused');

        // Drop zone re-armed: dragover advertises 'copy' again.
        expect(fireDragOver(root)).toBe('copy');

        // A follow-up drop actually invokes performPromptImport a second time.
        fireDrop(root, 'second.json');
        await tick(); await tick(); await tick();
        expect(io.performPromptImport).toHaveBeenCalledTimes(2);
    });
});
