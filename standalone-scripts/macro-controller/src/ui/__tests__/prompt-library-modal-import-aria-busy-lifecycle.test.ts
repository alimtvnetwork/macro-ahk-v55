/**
 * prompt-library-modal - aria-busy lifecycle on the Import button.
 *
 * Asserts the aria-busy attribute is toggled to "true" while
 * performPromptImport is in-flight and removed after the async pipeline
 * settles — regardless of whether the import resolves or throws.
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

type Result = { added: number; updated: number; errors: unknown[] };
type Deferred = { promise: Promise<Result>; resolve: () => void; reject: (e: Error) => void };
function defer(): Deferred {
    let resolveFn!: () => void;
    let rejectFn!: (e: Error) => void;
    const promise = new Promise<Result>((res, rej) => {
        resolveFn = () => res({ added: 1, updated: 0, errors: [] });
        rejectFn = (e) => rej(e);
    });
    return { promise, resolve: resolveFn, reject: rejectFn };
}

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
    fileInput.dispatchEvent(new Event('change'));
}

describe('prompt-library-modal - aria-busy toggles for both success and failure', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('sets aria-busy="true" mid-flight and removes it after a successful import', async () => {
        const d = defer();
        io.performPromptImport.mockImplementation(() => d.promise);

        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        expect(btn.hasAttribute('aria-busy')).toBe(false);

        fireFileChange('ok.json');
        await tick();
        await tick();
        expect(btn.getAttribute('aria-busy')).toBe('true');

        d.resolve();
        await tick();
        await tick();
        await tick();

        expect(btn.hasAttribute('aria-busy')).toBe(false);
    });

    it('sets aria-busy="true" mid-flight and removes it after a rejected import', async () => {
        const d = defer();
        io.performPromptImport.mockImplementation(() => d.promise);

        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        expect(btn.hasAttribute('aria-busy')).toBe(false);

        fireFileChange('boom.json');
        await tick();
        await tick();
        expect(btn.getAttribute('aria-busy')).toBe('true');

        d.reject(new Error('boom'));
        await tick();
        await tick();
        await tick();

        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(mocks.logError).toHaveBeenCalled();
    });
});
