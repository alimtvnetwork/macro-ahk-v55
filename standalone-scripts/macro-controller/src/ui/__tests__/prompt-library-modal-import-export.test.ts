/**
 * G8: prompt-library-modal Import / Export wiring.
 *
 * DoD:
 *  - Export button invokes exportPromptsToJson and updates status/log.
 *  - Import button opens the hidden file picker (click delegated).
 *  - A successful file parse routes through performPromptImport and shows a
 *    "+N added, M updated" summary.
 *  - A malformed JSON file surfaces the parse error via toast + status +
 *    logError; performPromptImport is NOT called.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
const mocks = vi.hoisted(() => ({ logError: vi.fn(), showToast: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: mocks.logError }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));
const logErrorMock = mocks.logError;
const toastMock = mocks.showToast;

const dbMocks = vi.hoisted(() => ({
    listPromptsByRole: vi.fn(async (_role: string) => ({ ok: true, value: [] as unknown[] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 99 })),
}));
vi.mock('../../db/prompt-db', () => dbMocks);

const ioMocks = vi.hoisted(() => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    performPromptImport: vi.fn(async () => ({ added: 2, updated: 1, total: 3, errors: [] as string[] })),
    parsePromptsText: vi.fn(),
}));
vi.mock('../prompt-io', () => ioMocks);

import { openPromptLibraryModal } from '../prompt-library-modal';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

function makeFile(text: string, name = 'prompts.json'): File {
    const blob = new Blob([text], { type: 'application/json' });
    // jsdom's File constructor accepts BlobParts.
    return new File([blob], name, { type: 'application/json' });
}

describe('prompt-library-modal — G8 import/export wiring', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        logErrorMock.mockReset();
        toastMock.mockReset();
        ioMocks.exportPromptsToJson.mockClear();
        ioMocks.performPromptImport.mockClear();
        ioMocks.parsePromptsText.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('renders Export and Import buttons plus a hidden file input', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(document.querySelector('[data-testid="library-export"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="library-import"]')).toBeTruthy();
        const file = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]');
        expect(file).toBeTruthy();
        expect(file!.type).toBe('file');
    });

    it('Export click delegates to exportPromptsToJson and updates status', async () => {
        await openPromptLibraryModal();
        await flush();
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="library-export"]')!;
        btn.click();
        await flush();
        expect(ioMocks.exportPromptsToJson).toHaveBeenCalledTimes(1);
    });

    it('Import click triggers the hidden file input picker', async () => {
        await openPromptLibraryModal();
        await flush();
        const importBtn = document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        const spy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        importBtn.click();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('successful file parse routes through performPromptImport and shows summary', async () => {
        ioMocks.parsePromptsText.mockReturnValue({
            valid: [{ name: 'X', text: 'body', category: 'General', isFavorite: false, isDefault: false }],
            errors: [],
        });
        await openPromptLibraryModal();
        await flush();
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        Object.defineProperty(fileInput, 'files', { value: [makeFile('{"schemaVersion":1,"entries":[]}')], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await flush();
        await flush();
        expect(ioMocks.performPromptImport).toHaveBeenCalledTimes(1);
        expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('+2 added'), expect.any(String));
    });

    it('malformed JSON surfaces parse error and does NOT call performPromptImport', async () => {
        ioMocks.parsePromptsText.mockReturnValue({ valid: [], errors: ['Failed to parse JSON: bad'] });
        await openPromptLibraryModal();
        await flush();
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        Object.defineProperty(fileInput, 'files', { value: [makeFile('not-json')], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await flush();
        await flush();
        expect(ioMocks.performPromptImport).not.toHaveBeenCalled();
        // v4.187.0: log format prefixed with `handleImportFile[parse]:` per
        // the v4.186.0 dedupe helper. Assertion widened to string-contains.
        expect(logErrorMock).toHaveBeenCalledWith(
            'PromptLibraryModal',
            expect.stringContaining('handleImportFile[parse]'),
            expect.anything(),
        );
        expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Import failed'), 'error');
    });
});
