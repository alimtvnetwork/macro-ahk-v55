/**
 * prompt-library-modal - modal stays open and focus returns to the Import
 * button after an invalid JSON import.
 *
 * Keyboard users must be able to retry immediately: the modal is not closed
 * on parse failure, and focus lands on the Import control that triggered
 * the picker (data-testid="library-import").
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

import { openPromptLibraryModal } from '../prompt-library-modal';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

async function dropFile(text: string, filename: string): Promise<void> {
    const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
    const file = new File([text], filename, { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
    await flush();
    await flush();
}

function getImportBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
}

function getModalRoot(): HTMLElement | null {
    // The modal renders a banner with data-testid; walk up to the modal root.
    const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    return banner ? banner.closest('[role="dialog"]') as HTMLElement | null
        ?? banner.parentElement : null;
}

describe('prompt-library-modal - focus + modal persistence after invalid import', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('keeps the modal mounted after an invalid JSON import', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(getImportBtn()).toBeTruthy();

        await dropFile('not valid json {{{', 'garbage.json');

        // Modal must still be in the DOM (nothing closed it).
        expect(getImportBtn()).toBeTruthy();
        expect(getImportBtn().isConnected).toBe(true);
        // And the error banner is visible for the user.
        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]')!;
        expect(banner.hidden).toBe(false);
    });

    it('returns focus to the error banner after a parse failure', async () => {
        await openPromptLibraryModal();
        await flush();
        getImportBtn().focus();
        (document.activeElement as HTMLElement | null)?.blur();
        expect(document.activeElement).not.toBe(getImportBtn());

        await dropFile('not valid json', 'garbage.json');

        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]')!;
        expect(document.activeElement).toBe(banner);
    });

    it('returns focus to the error banner when every row fails schema', async () => {
        await openPromptLibraryModal();
        await flush();
        (document.activeElement as HTMLElement | null)?.blur();

        await dropFile(JSON.stringify([{ foo: 1 }, { bar: 2 }]), 'legacy.json');

        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]')!;
        expect(document.activeElement).toBe(banner);
        expect(getModalRoot()).toBeTruthy();
    });
});
