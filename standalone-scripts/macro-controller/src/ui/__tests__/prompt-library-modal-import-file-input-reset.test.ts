/**
 * prompt-library-modal - File input reset after import failure.
 *
 * Selecting the same file twice would normally NOT re-fire a `change` event
 * because the input's value hasn't changed. The finally block clears
 * fileInput.value so users can re-upload the same file after a failure and
 * still trigger performPromptImport.
 *
 * This test verifies:
 *   1. After a rejected import, fileInput.value is reset to ''.
 *   2. Re-selecting the same file re-invokes performPromptImport.
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
    performPromptImport: vi.fn(),
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
    // Some browsers expose the filename via `value`; simulate that so the
    // reset assertion has something to reset from.
    Object.defineProperty(fileInput, 'value', { value: 'C:\\fakepath\\' + filename, configurable: true, writable: true });
    fileInput.dispatchEvent(new Event('change'));
}

describe('prompt-library-modal - file input resets after import failure so same file can be re-uploaded', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('clears fileInput.value after a rejected import and re-selecting the same file re-invokes performPromptImport', async () => {
        io.performPromptImport
            .mockImplementationOnce(async () => { throw new Error('boom'); })
            .mockImplementationOnce(async () => ({ added: 1, updated: 0, errors: [] }));

        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        const fileInput = getFileInput();

        // First upload -> rejects.
        fireFileChange('same.json');
        await tick();
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        expect(fileInput.value).toBe('');
        expect(btn.disabled).toBe(false);
        expect(fileInput.disabled).toBe(false);
        expect(mocks.logError).toHaveBeenCalled();

        // Re-upload the SAME file. In a real browser this only fires `change`
        // because we cleared `.value`; we simulate the same by re-dispatching.
        fireFileChange('same.json');
        await tick();
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(2);
        expect(fileInput.value).toBe('');
    });

    it('clears fileInput.value after a successful import too (symmetry)', async () => {
        io.performPromptImport.mockResolvedValue({ added: 1, updated: 0, errors: [] });

        await openPromptLibraryModal();
        await tick();

        const fileInput = getFileInput();
        fireFileChange('ok.json');
        await tick();
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        expect(fileInput.value).toBe('');
    });
});
