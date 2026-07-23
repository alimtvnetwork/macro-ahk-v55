/**
 * prompt-library-modal - Drag-and-drop import concurrency guard.
 *
 * Dropping JSON onto the modal must route through the same handleImportFile
 * pipeline as the Import button. While one import is in-flight, additional
 * drops must be ignored so performPromptImport cannot run twice.
 *
 * Verifies:
 *   - First drop starts an import (spinner + aria-busy + disabled controls)
 *   - Second drop during the deferred import is ignored
 *   - Clicking Import while drop-triggered import runs also short-circuits
 *   - performPromptImport called exactly once
 *   - After resolution, controls re-enable and a subsequent drop works
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
const firstImport = defer();
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

function getModalRoot(): HTMLElement {
    return document.getElementById('macro-prompt-library-modal') as HTMLElement;
}
function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}

function makeDropEvent(filename: string): DragEvent {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy', types: ['Files'] } as unknown as DataTransfer;
    const ev = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    return ev;
}

describe('prompt-library-modal - drag-and-drop honors the import concurrency guard', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
        // First call returns the deferred; subsequent calls (if any leak
        // through the guard) resolve immediately so the test would still
        // observe the extra call count.
        io.performPromptImport
            .mockImplementationOnce(() => firstImport.promise)
            .mockImplementation(async () => ({ added: 0, updated: 0, errors: [] }));
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('drops during an in-flight import are ignored; only one performPromptImport call', async () => {
        await openPromptLibraryModal();
        await tick();

        const root = getModalRoot();
        const btn = getImportBtn();
        const fileInput = getFileInput();

        // First drop starts the import.
        root.dispatchEvent(makeDropEvent('first.json'));
        await tick();
        await tick();

        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('aria-busy')).toBe('true');
        expect(fileInput.disabled).toBe(true);
        expect(io.performPromptImport).toHaveBeenCalledTimes(1);

        // Second drop while import is in-flight - must be ignored.
        root.dispatchEvent(makeDropEvent('second.json'));
        await tick();
        await tick();
        expect(io.performPromptImport).toHaveBeenCalledTimes(1);

        // Clicking Import while disabled must also not re-open the picker.
        const clickSpy = vi.spyOn(fileInput, 'click');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickSpy).not.toHaveBeenCalled();

        // Resolve the first import; controls re-enable.
        firstImport.resolve();
        await tick();
        await tick();
        await tick();

        expect(btn.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
        expect(fileInput.disabled).toBe(false);
        expect(io.performPromptImport).toHaveBeenCalledTimes(1);

        // A drop AFTER completion should now work (proving the guard released).
        root.dispatchEvent(makeDropEvent('third.json'));
        await tick();
        await tick();
        await tick();
        expect(io.performPromptImport).toHaveBeenCalledTimes(2);
    });

    it('dragover sets dropEffect=none while disabled and copy while idle', async () => {
        await openPromptLibraryModal();
        await tick();

        const root = getModalRoot();
        const btn = getImportBtn();

        const dt1 = { dropEffect: 'copy' } as unknown as DataTransfer;
        const over1 = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(over1, 'dataTransfer', { value: dt1, configurable: true });
        root.dispatchEvent(over1);
        expect(dt1.dropEffect).toBe('copy');

        // Simulate mid-flight state directly.
        btn.disabled = true;
        const dt2 = { dropEffect: 'copy' } as unknown as DataTransfer;
        const over2 = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(over2, 'dataTransfer', { value: dt2, configurable: true });
        root.dispatchEvent(over2);
        expect(dt2.dropEffect).toBe('none');
    });
});
