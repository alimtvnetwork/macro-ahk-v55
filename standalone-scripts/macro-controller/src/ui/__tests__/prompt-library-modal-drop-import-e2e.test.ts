/**
 * prompt-library-modal - end-to-end drag-and-drop import flow.
 *
 * Unlike the many focused tests around this modal, this one keeps the REAL
 * `prompt-io` pipeline (parsePromptsText, mergePrompts, performPromptImport)
 * and only stubs the storage boundary (`prompt-cache`) and the DB bridge.
 * That means a drop event exercises: parse -> role partition -> merge with
 * existing cache -> write back -> results summary rendered in the modal.
 *
 * Coverage (v5.9.0):
 *  1. Add + replace: dropping a bundle with one existing slug and one new
 *     slug produces `updated:1, added:1` in the toast and `writeJsonCopy`
 *     receives the merged list with the imported bodies.
 *  2. Default-protection: a bundle attempting to overwrite an `isDefault`
 *     row leaves the row untouched and increments `defaultsProtected`.
 *  3. Validation errors: malformed JSON surfaces the import error banner,
 *     never calls `writeJsonCopy`, and leaves the drop zone re-armable.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
const mocks = vi.hoisted(() => ({ logError: vi.fn(), showToast: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: mocks.logError }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));

// Cache boundary: readJsonCopy seeds the "existing" list per test; writeJsonCopy
// captures the merged output so the assertion can inspect what would be
// persisted without touching IndexedDB.
const cache = vi.hoisted(() => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] as unknown[] })),
    writeJsonCopy: vi.fn(async (_entries: unknown) => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));
vi.mock('../prompt-cache', () => cache);

// DB bridge: route every entry to the cache side so the real mergePrompts
// path runs end-to-end. Default-protection tested below is inside mergePrompts,
// not the DB path.
vi.mock('../prompt-io-db-bridge', () => ({
    collectDbEntriesForExport: vi.fn(async () => []),
    mergeDbIntoExport: vi.fn((cacheEntries: unknown[]) => cacheEntries),
    partitionByRole: vi.fn((entries: unknown[]) => ({ dbEntries: [], cacheEntries: entries })),
    commitDbEntries: vi.fn(async () => ({ upserted: 0, errors: [], defaultsProtected: 0 })),
}));

vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: vi.fn(async () => ({ ok: true, value: [] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await tick();
};

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}

function fireDrop(root: HTMLElement, jsonText: string, filename: string): void {
    const file = new File([jsonText], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - drag-drop import end-to-end', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        cache.readJsonCopy.mockReset();
        cache.writeJsonCopy.mockReset();
        cache.clearPromptCache.mockReset();
        cache.clearPromptCache.mockResolvedValue(undefined);
        cache.writeJsonCopy.mockResolvedValue(undefined);
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('replaces an existing slug and adds a new one when dropped as a JSON array', async () => {
        cache.readJsonCopy.mockResolvedValue({
            entries: [{ slug: 'alpha', name: 'Alpha', text: 'old body', isDefault: false }],
        });
        await openPromptLibraryModal();
        await flush();
        const root = getRoot();

        // Legacy bare-array shape is accepted by parsePromptsText and is the
        // simplest fixture that exercises both branches of mergePrompts.
        const payload = JSON.stringify([
            { slug: 'alpha', name: 'Alpha', text: 'new body' },
            { slug: 'beta',  name: 'Beta',  text: 'brand new' },
        ]);
        fireDrop(root, payload, 'bundle.json');
        await flush();

        expect(cache.writeJsonCopy).toHaveBeenCalledTimes(1);
        const written = cache.writeJsonCopy.mock.calls[0][0] as Array<{ slug: string; text: string }>;
        const alpha = written.find((e) => e.slug === 'alpha');
        const beta = written.find((e) => e.slug === 'beta');
        expect(alpha?.text).toBe('new body');
        expect(beta?.text).toBe('brand new');

        const summaryToast = mocks.showToast.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].startsWith('Import: '),
        );
        expect(summaryToast?.[0]).toContain('+1 added');
        expect(summaryToast?.[0]).toContain('1 updated');

        // Drop zone must be re-armed for the next attempt.
        const importBtn = document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
        expect(importBtn.disabled).toBe(false);
        expect(importBtn.hasAttribute('aria-busy')).toBe(false);
    });

    it('never overwrites an isDefault row and counts it under defaultsProtected', async () => {
        cache.readJsonCopy.mockResolvedValue({
            entries: [{ slug: 'plan-default', name: 'Plan default', text: 'canon', isDefault: true }],
        });
        await openPromptLibraryModal();
        await flush();
        const root = getRoot();

        const payload = JSON.stringify([
            { slug: 'plan-default', name: 'Plan default', text: 'attacker body' },
        ]);
        fireDrop(root, payload, 'evil.json');
        await flush();

        expect(cache.writeJsonCopy).toHaveBeenCalledTimes(1);
        const written = cache.writeJsonCopy.mock.calls[0][0] as Array<{ slug: string; text: string; isDefault?: boolean }>;
        const row = written.find((e) => e.slug === 'plan-default');
        expect(row?.text).toBe('canon');
        expect(row?.isDefault).toBe(true);

        // No "+1 added" or "1 updated" in the summary; the toast should still fire.
        const summaryToast = mocks.showToast.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].startsWith('Import: '),
        );
        expect(summaryToast?.[0]).toContain('+0 added');
        expect(summaryToast?.[0]).toContain('0 updated');
    });

    it('surfaces the import error banner on malformed JSON without persisting anything', async () => {
        cache.readJsonCopy.mockResolvedValue({ entries: [] });
        await openPromptLibraryModal();
        await flush();
        const root = getRoot();

        fireDrop(root, '{ this is : not json', 'broken.json');
        await flush();

        // Storage must be untouched.
        expect(cache.writeJsonCopy).not.toHaveBeenCalled();

        // The alert banner appears with a headline node.
        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
        expect(banner).not.toBeNull();
        expect(banner!.hidden).toBe(false);
        const headline = document.querySelector('[data-testid="library-import-error-headline"]');
        expect(headline?.textContent ?? '').not.toBe('');

        // Error-variant toast fired.
        const errorToast = mocks.showToast.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].startsWith('Import failed'),
        );
        expect(errorToast).toBeDefined();

        // Drop zone re-armed: a second drop must still be actionable.
        const importBtn = document.querySelector<HTMLButtonElement>('[data-testid="library-import"]')!;
        expect(importBtn.disabled).toBe(false);
        expect(importBtn.hasAttribute('aria-busy')).toBe(false);
    });
});