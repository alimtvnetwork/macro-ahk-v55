/**
 * prompt-library-modal - Drop-path failure announcement.
 *
 * When a drag-and-drop import fails, the modal must announce the failure
 * reason via an assertive aria-live region so screen-reader users hear it
 * immediately, and the polite status region must reflect the failure too.
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
    performPromptImport: vi.fn(),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}

function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - drop-path failure aria-live announcement', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('announces the failure reason via assertive aria-live banner after a failed drop', async () => {
        io.performPromptImport.mockRejectedValueOnce(new Error('Disk quota exceeded'));

        await openPromptLibraryModal();
        await tick();

        const root = getRoot();
        fireDrop(root, 'bad.json');
        await tick(); await tick(); await tick();

        // Assertive banner: role=alert, aria-live=assertive, aria-atomic=true, visible.
        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
        expect(banner).toBeTruthy();
        expect(banner?.getAttribute('role')).toBe('alert');
        expect(banner?.getAttribute('aria-live')).toBe('assertive');
        expect(banner?.getAttribute('aria-atomic')).toBe('true');
        expect(banner?.hidden).toBe(false);
        expect(banner?.textContent ?? '').toContain('Disk quota exceeded');

        // Polite status region also reflects the failure (shared handleImportFile path).
        const status = document.querySelector<HTMLElement>('[data-testid="library-status"]')
            ?? document.querySelector<HTMLElement>('[aria-live="polite"]');
        expect(status?.textContent ?? '').toMatch(/Import failed:.*Disk quota exceeded/);
    });
});
