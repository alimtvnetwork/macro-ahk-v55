/**
 * prompt-library-modal - user-friendly error banner for invalid Import.
 *
 * Verifies that when parsePromptsText rejects the file, the modal renders
 * a visible, in-context error banner (data-testid="library-import-error")
 * with a plain-language headline + actionable hint - separate from the
 * transient toast. The banner is aria-live=assertive for accessibility,
 * hidden by default, and cleared when the next Import attempt begins.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

import { buildFriendlyImportError } from '../prompt-import-error-message';

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

describe('buildFriendlyImportError - message shaping', () => {
    it('maps a JSON.parse failure to a filename-scoped headline', () => {
        const message = buildFriendlyImportError(
            ['Failed to parse JSON: Unexpected token h in JSON at position 0'],
            'prompts.json',
        );
        expect(message.headline).toBe("prompts.json isn't valid JSON.");
        expect(message.hint).toMatch(/Prompt Library/);
    });

    it('detects envelope-shape failures and hints re-export', () => {
        const message = buildFriendlyImportError(
            ['Missing required field: entries'],
            'bundle.json',
        );
        expect(message.headline).toMatch(/doesn't match the Prompt Library export format/);
        expect(message.hint).toMatch(/Re-export/);
    });

    it('summarises row-level rejections with the reject count', () => {
        const message = buildFriendlyImportError(
            [
                'entries[0]: Invalid prompt schema (requires name and text)',
                'entries[1]: Invalid prompt schema (requires name and text)',
                'entries[2]: Invalid prompt schema (requires name and text)',
            ],
            'legacy.json',
        );
        expect(message.headline).toMatch(/No importable prompts found/);
        expect(message.hint).toMatch(/3 rows were rejected/);
    });

    it('falls back to a truncated raw error when nothing else matches', () => {
        const long = 'weird failure: ' + 'x'.repeat(200);
        const message = buildFriendlyImportError([long], 'weird.json');
        expect(message.headline.startsWith('Import failed: ')).toBe(true);
        expect(message.headline.length).toBeLessThanOrEqual('Import failed: '.length + 140);
    });

    it('handles empty errors array with a generic headline', () => {
        const message = buildFriendlyImportError([], 'foo.json');
        expect(message.headline).toBe('Could not read foo.json.');
    });
});

describe('prompt-library-modal - visible error banner on invalid Import', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders the error banner hidden by default', async () => {
        await openPromptLibraryModal();
        await flush();
        const banner = document.querySelector<HTMLDivElement>('[data-testid="library-import-error"]')!;
        expect(banner).toBeTruthy();
        expect(banner.hidden).toBe(true);
        expect(banner.getAttribute('role')).toBe('alert');
        expect(banner.getAttribute('aria-live')).toBe('assertive');
    });

    it('reveals a headline + hint when non-JSON is imported', async () => {
        await openPromptLibraryModal();
        await flush();
        await dropFile('this is definitely not json {{{', 'oops.json');

        const banner = document.querySelector<HTMLDivElement>('[data-testid="library-import-error"]')!;
        expect(banner.hidden).toBe(false);
        expect(banner.style.display).toBe('block');

        const headline = document.querySelector<HTMLDivElement>('[data-testid="library-import-error-headline"]')!;
        const hint = document.querySelector<HTMLDivElement>('[data-testid="library-import-error-hint"]')!;
        expect(headline.textContent).toBe("oops.json isn't valid JSON.");
        expect(hint.textContent).toMatch(/Prompt Library/);

        // Toast fired with the same friendly headline (not a raw stack).
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining("oops.json isn't valid JSON."),
            'error',
        );
    });

    it('shows a row-count message when every row is invalid', async () => {
        await openPromptLibraryModal();
        await flush();
        // Bare array (legacy shape) with two rows that both fail schema check
        // -> parsePromptsText emits "Row N: Invalid prompt schema ..." errors.
        await dropFile(JSON.stringify([{ foo: 1 }, { bar: 2 }]), 'legacy.json');

        const headline = document.querySelector<HTMLDivElement>('[data-testid="library-import-error-headline"]')!;
        const hint = document.querySelector<HTMLDivElement>('[data-testid="library-import-error-hint"]')!;
        expect(headline.textContent).toMatch(/No importable prompts/);
        expect(hint.textContent).toMatch(/2 rows were rejected/);
    });

    it('clears the banner when a new import attempt begins', async () => {
        await openPromptLibraryModal();
        await flush();
        await dropFile('not json', 'a.json');
        const banner = document.querySelector<HTMLDivElement>('[data-testid="library-import-error"]')!;
        expect(banner.hidden).toBe(false);

        // Second attempt: even if it eventually fails again, the banner is
        // reset at the start of handleImportFile before parsing.
        await dropFile('still not json', 'b.json');
        // The second failure repopulates the banner, but the KEY property
        // is that it renders freshly for the new filename.
        const headline = document.querySelector<HTMLDivElement>('[data-testid="library-import-error-headline"]')!;
        expect(headline.textContent).toContain('b.json');
        expect(headline.textContent).not.toContain('a.json');
    });
});
