/**
 * prompt-library-modal - Import spinner / progress indicator.
 *
 * While performPromptImport is running the Import button must render an inline
 * spinner ([data-testid="library-import-spinner"]) and swap its label to
 * "Importing…". Once the deferred promise resolves the original "Import"
 * label must be restored and the spinner removed.
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

type Deferred = {
    promise: Promise<{ added: number; updated: number; errors: unknown[] }>;
    resolve: () => void;
};
function defer(): Deferred {
    let resolveFn!: () => void;
    const promise = new Promise<{ added: number; updated: number; errors: unknown[] }>((res) => {
        resolveFn = () => res({ added: 1, updated: 0, errors: [] });
    });
    return { promise, resolve: resolveFn };
}
const importDeferred = defer();
const io = vi.hoisted(() => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    parsePromptsText: vi.fn(() => ({
        valid: [{ name: 'p', text: 'body {{n}}' }],
        errors: [] as string[],
    })),
    performPromptImport: vi.fn(() => importDeferred.promise),
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

describe('prompt-library-modal - spinner shown while performPromptImport runs', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders spinner + "Importing…" mid-flight and restores "Import" on completion', async () => {
        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        expect(btn.textContent).toBe('Import');
        expect(btn.querySelector('[data-testid="library-import-spinner"]')).toBeNull();

        fireFileChange('a.json');
        await tick();
        await tick();

        const spinner = btn.querySelector<HTMLElement>('[data-testid="library-import-spinner"]');
        expect(spinner).not.toBeNull();
        expect(spinner!.getAttribute('aria-hidden')).toBe('true');
        expect(btn.textContent).toContain('Importing');
        expect(btn.getAttribute('aria-busy')).toBe('true');

        // Keyframes stylesheet is injected once.
        expect(document.getElementById('mc-spinner-style')).not.toBeNull();

        importDeferred.resolve();
        await tick();
        await tick();
        await tick();

        expect(btn.textContent).toBe('Import');
        expect(btn.querySelector('[data-testid="library-import-spinner"]')).toBeNull();
        expect(btn.hasAttribute('aria-busy')).toBe(false);
    });
});
