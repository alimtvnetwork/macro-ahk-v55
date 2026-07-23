/**
 * prompt-library-modal - aria-live announces the reason when
 * performPromptImport throws.
 *
 * The import error banner is role="alert" + aria-live="assertive" +
 * aria-atomic="true". After a thrown import, its content MUST include the
 * actual failure reason (Error.message) so screen readers announce WHY the
 * import failed, not just that it did.
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

function fireFile(name: string): void {
    const input = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
    const file = new File(['{"entries":[]}'], name, { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
}

function banner(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="library-import-error"]')!;
}

describe('prompt-library-modal - aria-live announces import failure reason', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders the thrown Error.message inside the role="alert" aria-live banner', async () => {
        io.performPromptImport.mockRejectedValueOnce(new Error('Quota exceeded on prompt DB'));

        await openPromptLibraryModal();
        await tick();
        fireFile('boom.json');
        await tick(); await tick(); await tick();

        const b = banner();
        // Live region attributes remain intact.
        expect(b.getAttribute('role')).toBe('alert');
        expect(b.getAttribute('aria-live')).toBe('assertive');
        expect(b.getAttribute('aria-atomic')).toBe('true');
        // The banner is visible and contains the actual failure reason.
        expect(b.hidden).toBe(false);
        expect(b.textContent).toContain('Quota exceeded on prompt DB');
        // Headline testid picks up the reason too so SR speaks it first.
        const headline = document.querySelector('[data-testid="library-import-error-headline"]');
        expect(headline?.textContent).toContain('Quota exceeded on prompt DB');
        // Toast also carries the reason.
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Quota exceeded on prompt DB'),
            'error',
        );
    });

    it('falls back to "Unknown error" when the thrown value has no message', async () => {
        io.performPromptImport.mockRejectedValueOnce({});

        await openPromptLibraryModal();
        await tick();
        fireFile('bad.json');
        await tick(); await tick(); await tick();

        expect(banner().textContent).toContain('Unknown error');
    });

    it('re-announces on a second failure by resetting banner content before re-rendering', async () => {
        io.performPromptImport
            .mockRejectedValueOnce(new Error('First failure'))
            .mockRejectedValueOnce(new Error('Second failure'));

        await openPromptLibraryModal();
        await tick();

        fireFile('a.json');
        await tick(); await tick(); await tick();
        expect(banner().textContent).toContain('First failure');
        expect(banner().textContent).not.toContain('Second failure');

        fireFile('b.json');
        await tick(); await tick(); await tick();
        // First-failure text is gone, second-failure text is announced.
        expect(banner().textContent).toContain('Second failure');
        expect(banner().textContent).not.toContain('First failure');
    });
});
