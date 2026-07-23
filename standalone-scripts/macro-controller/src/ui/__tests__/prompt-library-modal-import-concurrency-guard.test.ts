/**
 * prompt-library-modal - Import concurrency guard.
 *
 * While an import is running the Import button must be disabled so a rapid
 * second file selection cannot invoke performPromptImport twice. We simulate
 * a slow performPromptImport (deferred promise), fire a second file-change
 * event before it resolves, and assert:
 *   - Import button is disabled + aria-busy="true" during the run
 *   - The hidden file input is also disabled during the run
 *   - performPromptImport was called exactly once
 *   - After completion the controls are re-enabled
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

// Mock prompt-io: parsePromptsText returns a single valid row so the flow
// reaches performPromptImport; performPromptImport is a controllable deferred
// promise so we can observe the mid-flight state.
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

describe('prompt-library-modal - Import disabled while an import is in progress', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
        io.parsePromptsText.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('disables Import + file input mid-flight and only calls performPromptImport once', async () => {
        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        const fileInput = getFileInput();
        expect(btn.disabled).toBe(false);

        // First selection: kicks off the (deferred) import.
        fireFileChange('first.json');
        // Give the async handler a chance to reach the disable step.
        await tick();
        await tick();

        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('aria-busy')).toBe('true');
        expect(fileInput.disabled).toBe(true);

        // Second selection arrives before the first finishes. The change
        // handler still runs, but the concurrency guard must short-circuit
        // and NOT call performPromptImport again.
        fireFileChange('second.json');
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);

        // Clicking Import while disabled must not re-open the picker.
        const clickSpy = vi.spyOn(fileInput, 'click');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickSpy).not.toHaveBeenCalled();

        // Resolve the deferred import; controls re-enable.
        importDeferred.resolve();
        await tick();
        await tick();
        await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        expect(btn.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(fileInput.disabled).toBe(false);
    });
});
