/**
 * prompt-library-modal - Retry announcement via aria-live.
 *
 * After a failed drop import, the next drop must:
 *   - Announce "Retrying import: <file> ..." in the polite aria-live status
 *   - On success, announce "Retry succeeded. Import: +N added, ..."
 *   - Clear the retry state so a subsequent success is not labeled a retry
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
const io = vi.hoisted(() => ({
    exportPromptsToJson: vi.fn(async () => undefined),
    parsePromptsText: vi.fn(() => ({ valid: [{ name: 'p', text: 'body {{n}}' }], errors: [] })),
    performPromptImport: vi.fn(),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}
function status(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="library-status"]')!;
}
function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - retry announcement after failed drop', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        io.performPromptImport.mockReset();
        io.parsePromptsText.mockReturnValue({ valid: [{ name: 'p', text: 'body {{n}}' }] as never, errors: [] });
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('announces "Retrying import" on the next drop after a failure, and "Retry succeeded" on success', async () => {
        // Attempt 2 stays pending so we can observe the mid-flight status text.
        let resolveSecond: ((v: { added: number; updated: number; errors: unknown[] }) => void) | null = null;
        io.performPromptImport
            .mockRejectedValueOnce(new Error('DB write refused'))
            .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

        await openPromptLibraryModal();
        await tick();
        const root = getRoot();
        const s = status();
        expect(s.getAttribute('aria-live')).toBe('polite');

        // Attempt 1: fails.
        fireDrop(root, 'first.json');
        await tick(); await tick(); await tick();
        expect(s.textContent ?? '').toMatch(/Import failed:.*DB write refused/);

        // Attempt 2 begins: retry announcement visible while performPromptImport is pending.
        fireDrop(root, 'second.json');
        await tick(); await tick();
        expect(s.textContent ?? '').toMatch(/^Retrying import: second\.json/);

        // Now resolve, and confirm the success message is prefixed with "Retry succeeded.".
        resolveSecond!({ added: 2, updated: 0, errors: [] });
        await tick(); await tick(); await tick();
        expect(s.textContent ?? '').toMatch(/^Retry succeeded\. Import: \+2 added/);
    });

    it('does not label the first-ever drop as a retry', async () => {
        let resolveFirst: ((v: { added: number; updated: number; errors: unknown[] }) => void) | null = null;
        io.performPromptImport.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
        await openPromptLibraryModal();
        await tick();
        const root = getRoot();
        fireDrop(root, 'first.json');
        await tick(); await tick();
        expect(status().textContent ?? '').toMatch(/^Importing first\.json/);
        resolveFirst!({ added: 1, updated: 0, errors: [] });
        await tick(); await tick(); await tick();
        expect(status().textContent ?? '').not.toMatch(/Retry/);
    });
});
