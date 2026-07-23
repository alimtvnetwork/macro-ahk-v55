/**
 * prompt-library-modal - Import label resets to the literal "Import" after
 * a successful drag-and-drop import.
 *
 * Distinct from the broader drop-spinner test: this pins the exact final
 * label string ("Import"), not just "equal to whatever was captured".
 * Guards against a regression where the label might be reset to "" or
 * "Importing…" or a translated variant.
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
    parsePromptsText: vi.fn(() => ({
        valid: [{ name: 'p', text: 'body {{n}}' }],
        errors: [] as string[],
    })),
    performPromptImport: vi.fn(async () => ({ added: 1, updated: 0, errors: [] })),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}
function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}
function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - drop success resets label to literal "Import"', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('spinner is gone and button label is exactly "Import" after a successful drop-triggered import', async () => {
        await openPromptLibraryModal();
        await tick();

        const btn = getImportBtn();
        // Preconditions: initial label is the literal "Import" and no spinner.
        expect(btn.textContent).toBe('Import');
        expect(btn.querySelector('[data-testid="library-import-spinner"]')).toBeNull();

        fireDrop(getRoot(), 'ok.json');
        // Await the full async chain: file.text() -> parse -> performPromptImport -> renderAllRoles.
        await tick(); await tick(); await tick(); await tick();

        expect(io.performPromptImport).toHaveBeenCalledTimes(1);
        // Post-success: spinner removed, label reset to the literal "Import".
        expect(btn.querySelector('[data-testid="library-import-spinner"]')).toBeNull();
        expect(btn.textContent).toBe('Import');
        expect(btn.disabled).toBe(false);
        expect(btn.hasAttribute('aria-busy')).toBe(false);
    });
});
