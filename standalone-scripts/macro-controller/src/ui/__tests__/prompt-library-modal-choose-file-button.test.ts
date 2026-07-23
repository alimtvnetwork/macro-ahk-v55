/**
 * prompt-library-modal - Visible "Choose file" button inside the drop zone.
 *
 * Provides a keyboard + mouse accessible entry point for users who cannot or
 * do not want to drag-and-drop. Routes through the same hidden file input as
 * the Import button, so the concurrency guard (importBtn.disabled) applies.
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

function getChooseBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-choose-file"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}
function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}

describe('prompt-library-modal - Choose file button', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders a visible, keyboard-focusable button with an accessible label', async () => {
        await openPromptLibraryModal();
        await tick();
        const btn = getChooseBtn();
        expect(btn).toBeTruthy();
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.type).toBe('button');
        expect(btn.getAttribute('aria-label') ?? '').toMatch(/choose/i);
        expect(btn.textContent ?? '').toMatch(/choose file/i);
        btn.focus();
        expect(document.activeElement).toBe(btn);
    });

    it('opens the hidden file picker when clicked', async () => {
        await openPromptLibraryModal();
        await tick();
        const btn = getChooseBtn();
        const fileInput = getFileInput();
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        btn.click();
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op while an import is in flight (Import button disabled)', async () => {
        await openPromptLibraryModal();
        await tick();
        const btn = getChooseBtn();
        const fileInput = getFileInput();
        getImportBtn().disabled = true;
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        btn.click();
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('does not double-fire the file picker via drop-zone click bubbling', async () => {
        await openPromptLibraryModal();
        await tick();
        const btn = getChooseBtn();
        const fileInput = getFileInput();
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        btn.click();
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});
