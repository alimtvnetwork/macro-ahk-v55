/**
 * prompt-library-modal - Drop-path failure moves focus to the error banner.
 *
 * When performPromptImport throws during a drag-and-drop import, keyboard
 * focus must land on the assertive error banner (tabindex=-1) so the issue
 * is immediately reachable, instead of being stranded on <body> or the
 * Import button which sits above the banner in the tab order.
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
    performPromptImport: vi.fn(async () => { throw new Error('storage quota exceeded'); }),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function fireDrop(root: HTMLElement): void {
    const file = new File(['{"entries":[]}'], 'bad.json', { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - focus moves to error banner on drop failure', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('moves keyboard focus to the aria-live error banner after a failed drag-and-drop import', async () => {
        await openPromptLibraryModal();
        await tick();

        const root = document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
            ?? (document.body.firstElementChild as HTMLElement);
        fireDrop(root);
        await tick(); await tick(); await tick();

        const banner = document.querySelector<HTMLElement>('[data-testid="library-import-error"]');
        expect(banner).not.toBeNull();
        expect(banner!.hidden).toBe(false);
        // Banner must be programmatically focusable but not in the Tab order.
        expect(banner!.getAttribute('tabindex')).toBe('-1');
        // Focus lands on the banner, not on <body> or the Import button.
        expect(document.activeElement).toBe(banner);
        // Banner surfaces the real failure reason.
        expect(banner!.textContent ?? '').toContain('storage quota exceeded');
    });
});
