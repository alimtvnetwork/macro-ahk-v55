/**
 * prompt-library-modal - Drop zone focus ring visible on keyboard focus.
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

describe('prompt-library-modal drop-zone focus ring', () => {
    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('paints a visible ring on focus and clears it on blur', async () => {
        await openPromptLibraryModal();
        await tick();
        const zone = document.querySelector<HTMLDivElement>('[data-testid="library-drop-zone"]');
        expect(zone).not.toBeNull();
        if (!zone) return;

        expect(zone.style.outlineColor === '' || zone.style.outlineColor === 'transparent').toBe(true);

        zone.dispatchEvent(new FocusEvent('focus'));
        expect(zone.style.outlineColor).toBe('rgb(124, 196, 255)');
        expect(zone.style.boxShadow).toContain('rgba(124, 196, 255');
        expect(zone.style.borderColor).toBe('rgb(124, 196, 255)');

        zone.dispatchEvent(new FocusEvent('blur'));
        expect(zone.style.outlineColor).toBe('transparent');
        expect(zone.style.boxShadow).toBe('none');
        expect(zone.style.borderColor).toBe('rgb(58, 72, 99)');
    });
});
