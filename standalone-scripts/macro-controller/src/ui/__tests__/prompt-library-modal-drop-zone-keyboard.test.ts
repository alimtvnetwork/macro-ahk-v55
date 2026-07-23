/**
 * prompt-library-modal - Drop zone keyboard navigation.
 *
 * The visible drop zone must be reachable via Tab and activatable with Enter
 * or Space, so keyboard-only users can trigger the file picker exactly like
 * mouse users. While an import is in flight the zone is a no-op.
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

function getDropZone(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="library-drop-zone"]')!;
}
function getFileInput(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
}
function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}

describe('prompt-library-modal - drop zone keyboard navigation', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('exposes the drop zone as a keyboard-focusable button with an accessible label', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = getDropZone();
        expect(zone.getAttribute('role')).toBe('button');
        expect(zone.getAttribute('tabindex')).toBe('0');
        expect(zone.getAttribute('aria-label') ?? '').toMatch(/import/i);
        // Focus works via .focus() (tabindex=0).
        zone.focus();
        expect(document.activeElement).toBe(zone);
    });

    it('opens the file picker when Enter is pressed on the drop zone', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = getDropZone();
        const fileInput = getFileInput();
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        zone.focus();
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('opens the file picker when Space is pressed on the drop zone', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = getDropZone();
        const fileInput = getFileInput();
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores non-activation keys (e.g. Tab, ArrowDown)', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = getDropZone();
        const fileInput = getFileInput();
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('is a no-op while an import is in flight (Import button disabled)', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = getDropZone();
        const fileInput = getFileInput();
        const importBtn = getImportBtn();
        importBtn.disabled = true; // simulate in-flight import
        const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        expect(clickSpy).not.toHaveBeenCalled();
    });
});
