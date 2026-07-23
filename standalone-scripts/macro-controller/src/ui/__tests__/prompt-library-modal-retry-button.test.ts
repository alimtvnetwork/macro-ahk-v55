/**
 * prompt-library-modal - "Retry import" button on thrown-import failures.
 *
 * When performPromptImport throws, the assertive error banner MUST include a
 * visible "Retry import" button that re-invokes the pipeline with the same
 * file, so users don't have to reopen the picker or re-drag.
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

const performPromptImport = vi.fn();
vi.mock('../prompt-io', () => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    parsePromptsText: vi.fn(() => ({ valid: [{ role: 'plan', name: 'x', body: 'y' }], errors: [] })),
    performPromptImport: (...args: unknown[]) => performPromptImport(...args),
}));

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeFile(): File {
    const f = new File(['[]'], 'prompts.json', { type: 'application/json' });
    Object.defineProperty(f, 'size', { value: 42, configurable: true });
    return f;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}
function getRetryBtn(): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import-retry"]');
}

async function pickFile(file: File): Promise<void> {
    const input = getFileInput();
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    // Two ticks: microtask for handleImportFile + macrotask for finally block.
    await tick(); await tick(); await tick();
}

describe('prompt-library-modal - Retry import button', () => {
    beforeEach(() => { document.body.innerHTML = ''; performPromptImport.mockReset(); });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders a Retry button in the error banner when the import throws', async () => {
        performPromptImport.mockRejectedValueOnce(new Error('IDB write failed'));
        await openPromptLibraryModal();
        await tick();
        await pickFile(makeFile());
        const btn = getRetryBtn();
        expect(btn).toBeTruthy();
        expect(btn!.tagName).toBe('BUTTON');
        expect(btn!.type).toBe('button');
        expect(btn!.textContent).toBe('Retry import');
        expect(btn!.getAttribute('aria-label') ?? '').toMatch(/retry/i);
    });

    it('re-invokes the import pipeline when Retry is clicked, and clears the banner on success', async () => {
        performPromptImport
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce({ added: 1, updated: 0, errors: [] });
        await openPromptLibraryModal();
        await tick();
        await pickFile(makeFile());
        expect(performPromptImport).toHaveBeenCalledTimes(1);
        const btn = getRetryBtn();
        expect(btn).toBeTruthy();
        btn!.click();
        await tick(); await tick(); await tick();
        expect(performPromptImport).toHaveBeenCalledTimes(2);
        const banner = document.querySelector<HTMLDivElement>('[data-testid="library-import-error"]')!;
        expect(banner.hidden).toBe(true);
    });

    it('does NOT render a Retry button for client-side validation failures', async () => {
        await openPromptLibraryModal();
        await tick();
        const bad = new File(['[]'], 'notes.txt', { type: 'text/plain' });
        Object.defineProperty(bad, 'size', { value: 10, configurable: true });
        await pickFile(bad);
        expect(getRetryBtn()).toBeNull();
    });
});
