/**
 * prompt-library-modal - Selected-file preview line.
 *
 * When a user picks a file (via the hidden file input or a drop), the modal
 * must show "Selected file: NAME (SIZE)" so name and size are visible before
 * the import completes. Verified for both the click path and the drop path.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../../toast', () => ({ showToast: vi.fn() }));
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
vi.mock('../prompt-io', () => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    parsePromptsText: vi.fn(() => ({ valid: [], errors: [] })),
    performPromptImport: vi.fn(async () => ({ added: 0, updated: 0, errors: [] })),
}));

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getFileInfo(): HTMLDivElement {
    return document.querySelector<HTMLDivElement>('[data-testid="library-file-info"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}

function makeFile(name: string, size: number, content = '[]'): File {
    const f = new File([content], name, { type: 'application/json' });
    Object.defineProperty(f, 'size', { value: size, configurable: true });
    return f;
}

describe('prompt-library-modal - selected file info', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('is hidden until a file is selected', async () => {
        await openPromptLibraryModal();
        await tick();
        const info = getFileInfo();
        expect(info).toBeTruthy();
        expect(info.hidden).toBe(true);
        expect(info.textContent ?? '').toBe('');
    });

    it('shows name + KB size after picking a file via the input', async () => {
        await openPromptLibraryModal();
        await tick();
        const fileInput = getFileInput();
        const file = makeFile('prompts.json', 2048);
        Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await tick();
        const info = getFileInfo();
        expect(info.hidden).toBe(false);
        expect(info.textContent).toBe('Selected file: prompts.json (2.0 KB)');
        expect(info.getAttribute('aria-live')).toBe('polite');
    });

    it('renders bytes for tiny files and MB for large files', async () => {
        await openPromptLibraryModal();
        await tick();
        const fileInput = getFileInput();
        const small = makeFile('a.json', 512);
        Object.defineProperty(fileInput, 'files', { value: [small], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await tick();
        expect(getFileInfo().textContent).toBe('Selected file: a.json (512 B)');

        const big = makeFile('big.json', 3 * 1024 * 1024);
        Object.defineProperty(fileInput, 'files', { value: [big], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await tick();
        expect(getFileInfo().textContent).toBe('Selected file: big.json (3.0 MB)');
    });

    it('shows name + size on the drag-and-drop path too', async () => {
        await openPromptLibraryModal();
        await tick();
        const root = document.getElementById('macro-prompt-library-modal') as HTMLDivElement;
        const file = makeFile('dropped.json', 1536);
        const dt = { files: [file], dropEffect: 'copy' } as unknown as DataTransfer;
        const dropEvt = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(dropEvt, 'dataTransfer', { value: dt });
        root.dispatchEvent(dropEvt);
        await tick();
        expect(getFileInfo().textContent).toBe('Selected file: dropped.json (1.5 KB)');
    });
});
