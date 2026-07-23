/**
 * prompt-library-modal - After a successful drag-and-drop import, the drop
 * zone must re-arm: subsequent dragover events report dropEffect='copy'
 * (not 'none'), and a follow-up drop invokes performPromptImport again.
 * Guards against a regression where the concurrency guard fails to release
 * after success, silently swallowing every future drop.
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
    performPromptImport: vi.fn(async () => ({ added: 1, updated: 0, errors: [] })),
}));
vi.mock('../prompt-io', () => io);

import { openPromptLibraryModal } from '../prompt-library-modal';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function getRoot(): HTMLElement {
    return document.querySelector<HTMLElement>('[data-testid="prompt-library-modal"]')
        ?? (document.body.firstElementChild as HTMLElement);
}
function fireDragOver(root: HTMLElement): { dropEffect: string } {
    const dt = { files: [] as File[], dropEffect: 'copy' };
    const ev = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
    return dt;
}
function fireDrop(root: HTMLElement, filename: string): void {
    const file = new File(['{"entries":[]}'], filename, { type: 'application/json' });
    const dt = { files: [file], dropEffect: 'copy' };
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt, configurable: true });
    root.dispatchEvent(ev);
}

describe('prompt-library-modal - drop zone re-arms after a successful import', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        io.performPromptImport.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('dragover reports copy and a second drop invokes performPromptImport again', async () => {
        await openPromptLibraryModal();
        await tick();
        const root = getRoot();

        // First drop: succeeds.
        fireDrop(root, 'first.json');
        await tick(); await tick(); await tick(); await tick(); await tick();
        expect(io.performPromptImport).toHaveBeenCalledTimes(1);

        // Drop zone is idle again: dragover should advertise 'copy'.
        const dt = fireDragOver(root);
        expect(dt.dropEffect).toBe('copy');

        // Second drop: must be accepted (drop zone re-armed).
        fireDrop(root, 'second.json');
        await tick(); await tick(); await tick(); await tick(); await tick();
        expect(io.performPromptImport).toHaveBeenCalledTimes(2);
    });
});
