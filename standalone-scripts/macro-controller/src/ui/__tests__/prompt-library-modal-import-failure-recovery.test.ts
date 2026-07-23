/**
 * prompt-library-modal - Import controls re-enable + focus restore after failure.
 *
 * When performPromptImport rejects mid-flight the finally block must:
 *   - clear disabled on the Import button
 *   - remove aria-busy
 *   - clear disabled on the hidden file input
 *   - reset the spinner label back to "Import"
 *   - restore focus to the Import button so keyboard users can retry
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
const mocks = vi.hoisted(() => ({ logError: vi.fn(), showToast: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: mocks.logError }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));

const cache = vi.hoisted(() => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] as unknown[] })),
    writeJsonCopy: vi.fn(async () => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));
vi.mock('../prompt-cache', () => cache);
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
    performPromptImport: vi.fn(async () => { throw new Error('boom'); }),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}
function fireFileChange(filename: string): void {
    const fileInput = getFileInput();
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
}

describe('prompt-library-modal - controls re-enable + focus after import failure', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('re-enables Import + file input, restores label, and returns focus after a thrown import', async () => {
        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        const fileInput = getFileInput();

        fireFileChange('boom.json');
        // Allow the async pipeline (parse -> performPromptImport -> catch -> finally) to run.
        await tick();
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        expect(btn.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(fileInput.disabled).toBe(false);
        expect(fileInput.value).toBe('');
        expect(btn.textContent).toBe('Import');
        expect(btn.querySelector('[data-testid="library-import-spinner"]')).toBeNull();
        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
        expect(banner).not.toBeNull();
        expect(document.activeElement).toBe(banner);
        expect(mocks.logError).toHaveBeenCalled();
    });
});
