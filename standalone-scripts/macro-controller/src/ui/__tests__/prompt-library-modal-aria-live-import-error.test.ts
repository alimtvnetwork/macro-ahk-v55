/**
 * prompt-library-modal - aria-live announcement for import errors.
 *
 * Verifies the error banner is a properly configured live region so screen
 * readers announce parse failures without user interaction:
 *   - role="alert" + aria-live="assertive" (interruptive announcement)
 *   - aria-atomic="true" (headline + hint spoken as one message)
 *   - the region is unhidden BEFORE content is inserted, so the SR sees
 *     a mutation on an already-visible live region (NVDA/JAWS otherwise
 *     miss announcements toggled visible in the same tick as the text).
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

function getBanner(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="library-import-error"]')!;
}

describe('prompt-library-modal - aria-live announcement of import errors', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('exposes the error banner as an assertive, atomic live region', async () => {
        await openPromptLibraryModal();
        await flush();
        const banner = getBanner();
        expect(banner.getAttribute('role')).toBe('alert');
        expect(banner.getAttribute('aria-live')).toBe('assertive');
        expect(banner.getAttribute('aria-atomic')).toBe('true');
    });

    it('makes the live region visible before content is inserted so SR announces the mutation', async () => {
        await openPromptLibraryModal();
        await flush();
        const banner = getBanner();

        // Observe the exact sequence of mutations. If content is inserted
        // BEFORE the region is unhidden, screen readers miss the alert.
        type Step = 'unhidden' | 'child-added';
        const order: Step[] = [];
        const observer = new MutationObserver((records) => {
            for (const r of records) {
                if (r.type === 'attributes' && r.attributeName === 'hidden' && !banner.hidden) {
                    order.push('unhidden');
                }
                if (r.type === 'childList' && r.addedNodes.length > 0) {
                    order.push('child-added');
                }
            }
        });
        observer.observe(banner, { attributes: true, childList: true, subtree: false });

        await dropFile('not json {{{', 'oops.json');
        observer.disconnect();

        expect(banner.hidden).toBe(false);
        // The unhide must land before (or with) the first child insertion.
        const firstUnhide = order.indexOf('unhidden');
        const firstChild = order.indexOf('child-added');
        expect(firstUnhide).toBeGreaterThanOrEqual(0);
        expect(firstChild).toBeGreaterThanOrEqual(0);
        expect(firstUnhide).toBeLessThan(firstChild);
    });

    it('announces the friendly headline + hint together via aria-atomic', async () => {
        await openPromptLibraryModal();
        await flush();

        await dropFile('not json', 'garbage.json');

        const banner = getBanner();
        // aria-atomic="true" means the region's entire text is announced.
        expect(banner.getAttribute('aria-atomic')).toBe('true');
        const text = (banner.textContent ?? '').trim();
        expect(text).toContain("garbage.json isn't valid JSON.");
        // Hint sentence is present in the same announcement payload.
        expect(text).toMatch(/Prompt Library/);
    });

    it('re-announces on a subsequent failure by clearing then repopulating text', async () => {
        await openPromptLibraryModal();
        await flush();
        await dropFile('not json', 'first.json');
        const banner = getBanner();
        expect(banner.textContent).toContain('first.json');

        // Watch for the clear-then-repopulate cycle that triggers SR re-read.
        let sawEmpty = false;
        const observer = new MutationObserver(() => {
            if ((banner.textContent ?? '') === '') sawEmpty = true;
        });
        observer.observe(banner, { childList: true, subtree: true, characterData: true });

        await dropFile('still not json', 'second.json');
        observer.disconnect();

        expect(sawEmpty).toBe(true);
        expect(banner.textContent).toContain('second.json');
        expect(banner.textContent).not.toContain('first.json');
    });
});
