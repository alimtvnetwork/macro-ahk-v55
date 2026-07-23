/**
 * prompt-library-modal - E2E: invalid Import surfaces an error and
 * NEVER calls performPromptImport.
 *
 * Complements the existing malformed-JSON assertion in
 * `prompt-library-modal-import-export.test.ts` by driving the REAL
 * `parsePromptsText` (no parse mock) across a matrix of realistic bad
 * inputs a user might drop into the picker:
 *
 *   1. Non-JSON garbage      -> JSON.parse throws
 *   2. Empty file            -> JSON.parse throws
 *   3. Envelope missing entries[] -> validatePromptsBundle rejects
 *   4. Envelope with entries[] whose rows lack name/text -> row-level rejects
 *   5. Bare array of empties -> every row rejected
 *
 * For every case the E2E contract is:
 *   - performPromptImport is NEVER called
 *   - logError('PromptLibraryModal', 'import parse failed', ...) fires
 *   - showToast(...'Import failed'..., 'error') fires
 *   - The status line starts with 'Import parse failed'
 *   - The file input is cleared (value === '') so the same file can be re-picked
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

const bridge = vi.hoisted(() => ({
    collectDbEntriesForExport: vi.fn(async () => [] as unknown[]),
    mergeDbIntoExport: vi.fn((c: unknown[]) => c),
    partitionByRole: vi.fn((entries: unknown[]) => ({ dbEntries: [], cacheEntries: entries })),
    commitDbEntries: vi.fn(async () => ({ upserted: 0, errors: [] as string[] })),
}));
vi.mock('../prompt-io-db-bridge', () => bridge);

vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: vi.fn(async () => ({ ok: true, value: [] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));

import * as promptIo from '../prompt-io';
import { openPromptLibraryModal, _resetLibraryImportFailureDedupeForTests } from '../prompt-library-modal';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

async function dropFile(text: string, filename = 'bad.json'): Promise<void> {
    const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
    const file = new File([text], filename, { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
    await flush();
    await flush();
}

describe('prompt-library-modal - invalid Import is rejected end-to-end', () => {
    let performSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        // v4.186.0: reset the module-scoped dedupe map so a prior test's
        // 'parse'/'validation' key does not suppress this test's log line.
        _resetLibraryImportFailureDedupeForTests();
        performSpy = vi.spyOn(promptIo, 'performPromptImport').mockResolvedValue({
            added: 0, updated: 0, total: 0, errors: [],
        });
    });
    afterEach(() => {
        document.body.innerHTML = '';
        performSpy.mockRestore();
        vi.restoreAllMocks();
    });

    function assertRejectionContract(): void {
        expect(performSpy).not.toHaveBeenCalled();
        expect(mocks.logError).toHaveBeenCalledWith(
            'PromptLibraryModal', expect.stringContaining('handleImportFile[parse]'), expect.anything(),
        );
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Import failed'), 'error',
        );
        const status = document.querySelector<HTMLDivElement>('#macro-prompt-library-modal')
            ?.querySelector('div[style*="color"]');
        // status text starts with the rejection prefix set in handleImportFile.
        const body = document.getElementById('macro-prompt-library-modal')!.textContent || '';
        expect(body).toContain('Import parse failed');
        // file input cleared so the same file can be re-picked.
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        expect(fileInput.value).toBe('');
        void status;
    }

    it('rejects non-JSON garbage', async () => {
        await openPromptLibraryModal(); await flush();
        await dropFile('this is not json at all {{{');
        assertRejectionContract();
    });

    it('rejects an empty file', async () => {
        await openPromptLibraryModal(); await flush();
        await dropFile('');
        // Empty file is caught by client-side validation before parse, so the
        // logError code is 'import validation failed' rather than 'import parse failed'.
        expect(performSpy).not.toHaveBeenCalled();
        expect(mocks.logError).toHaveBeenCalledWith(
            'PromptLibraryModal', expect.stringContaining('handleImportFile[validation]'),
        );
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Import failed'), 'error',
        );
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        expect(fileInput.value).toBe('');
    });

    it('rejects an envelope missing entries[]', async () => {
        await openPromptLibraryModal(); await flush();
        await dropFile(JSON.stringify({ schemaVersion: 1, notEntries: [] }));
        assertRejectionContract();
    });

    it('rejects an envelope whose rows all lack required fields', async () => {
        await openPromptLibraryModal(); await flush();
        // schemaVersion + entries present, but every row is missing name/text.
        await dropFile(JSON.stringify({
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            appVersion: 'test',
            entryCount: 2,
            entries: [{ foo: 'bar' }, { other: 42 }],
        }));
        assertRejectionContract();
    });

    it('rejects a bare array of invalid rows', async () => {
        await openPromptLibraryModal(); await flush();
        await dropFile(JSON.stringify([{ name: '' }, { text: 123 }, null]));
        assertRejectionContract();
    });

    it('ignores a file-input change with no file selected (no error, no import)', async () => {
        await openPromptLibraryModal(); await flush();
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        Object.defineProperty(fileInput, 'files', { value: [], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await flush();
        expect(performSpy).not.toHaveBeenCalled();
        expect(mocks.logError).not.toHaveBeenCalled();
        expect(mocks.showToast).not.toHaveBeenCalled();
    });
});
