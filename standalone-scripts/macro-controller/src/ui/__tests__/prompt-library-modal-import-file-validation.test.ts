/**
 * prompt-library-modal - Import file validation (type + size).
 *
 * Before any read/parse work, `handleImportFile` must reject:
 *   - Non-JSON extensions/MIME types
 *   - Files over 5 MB
 *   - Empty files
 * Rejections must show the inline error banner (role=alert, aria-live),
 * log via logError, toast an error, NOT invoke performPromptImport, and
 * leave the Import button re-enabled so the user can try again.
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
    parsePromptsText: vi.fn(() => ({ valid: [], errors: [] })),
    performPromptImport: vi.fn(async () => ({ added: 0, updated: 0, errors: [] })),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function root(): HTMLElement {
    return document.querySelector<HTMLElement>('#macro-controller-prompt-library-modal')
        ?? (document.body.firstElementChild as HTMLElement);
}
function importBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}
function fileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}
function banner(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
}

function fireDrop(target: HTMLElement, file: File): void {
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    target.dispatchEvent(ev);
}

describe('prompt-library-modal - import file validation', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
        io.performPromptImport.mockResolvedValue({ added: 0, updated: 0, errors: [] });
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('rejects non-JSON extension (.txt) with an inline error banner and does not call performPromptImport', async () => {
        await openPromptLibraryModal();
        await tick();
        const bad = new File(['hello'], 'notes.txt', { type: 'text/plain' });
        fireDrop(root(), bad);
        await tick(); await tick();

        expect(io.performPromptImport).not.toHaveBeenCalled();
        expect(banner()?.hidden).toBe(false);
        expect(banner()?.textContent ?? '').toMatch(/Unsupported file type/i);
        expect(banner()?.getAttribute('role')).toBe('alert');
        expect(mocks.logError).toHaveBeenCalled();
        expect(mocks.showToast).toHaveBeenCalled();
        // Import button remains usable for another attempt.
        expect(importBtn().disabled).toBe(false);
        expect(fileInput().disabled).toBe(false);
    });

    it('rejects files larger than 5 MB with a size-specific message', async () => {
        await openPromptLibraryModal();
        await tick();
        const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'big.json', { type: 'application/json' });
        fireDrop(root(), huge);
        await tick(); await tick();

        expect(io.performPromptImport).not.toHaveBeenCalled();
        expect(banner()?.textContent ?? '').toMatch(/too large/i);
        expect(banner()?.textContent ?? '').toMatch(/6\.0 MB/);
    });

    it('rejects empty files', async () => {
        await openPromptLibraryModal();
        await tick();
        const empty = new File([], 'empty.json', { type: 'application/json' });
        fireDrop(root(), empty);
        await tick(); await tick();

        expect(io.performPromptImport).not.toHaveBeenCalled();
        expect(banner()?.textContent ?? '').toMatch(/empty/i);
    });

    it('accepts a valid .json file and invokes performPromptImport', async () => {
        io.parsePromptsText.mockReturnValueOnce({ valid: [{ name: 'p', text: 'body {{n}}' }] as never, errors: [] });
        await openPromptLibraryModal();
        await tick();
        const good = new File(['{"entries":[]}'], 'library.json', { type: 'application/json' });
        fireDrop(root(), good);
        await tick(); await tick(); await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        expect(banner()?.hidden ?? true).toBe(true);
    });
});
