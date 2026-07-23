/**
 * v4.191.0: modal wiring test for the new header controls.
 * - Export "History" checkbox flows through to `exportPromptsToJson({ includeRevisions })`.
 * - Import "scope" <select> flows through to `performPromptImport(..., { roleFilter })`.
 * Only these two options are asserted; every other pre-v4.190 behaviour is
 * covered by the existing modal test suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const dbMocks = vi.hoisted(() => ({
    listPromptsByRole: vi.fn(async () => ({ ok: true, value: [] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));
vi.mock('../../db/prompt-db', () => dbMocks);

const ioMocks = vi.hoisted(() => ({
    exportPromptsToJson: vi.fn(async (_opts?: unknown) => undefined),
    parsePromptsText: vi.fn(() => ({ valid: [{ name: 'x', text: 'x {{n}}', role: 'plan' }], errors: [] })),
    performPromptImport: vi.fn(async (_e: unknown, _o?: unknown) => ({ added: 1, updated: 0, errors: [] })),
}));
vi.mock('../prompt-io', () => ioMocks);
vi.mock('../prompt-import-error-message', () => ({ buildFriendlyImportError: () => ({ headline: 'x', hint: 'x' }) }));
vi.mock('../toast', () => ({ showToast: vi.fn() }));

import { openPromptLibraryModal } from '../prompt-library-modal';

describe('prompt-library-modal export/import header controls (v4.191.0)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        ioMocks.exportPromptsToJson.mockClear();
        ioMocks.performPromptImport.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('default Export call uses includeRevisions=false', async () => {
        await openPromptLibraryModal();
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="library-export"]')!;
        btn.click();
        await Promise.resolve();
        expect(ioMocks.exportPromptsToJson).toHaveBeenCalledWith({ includeRevisions: false });
    });

    it('checking History flips includeRevisions to true on Export', async () => {
        await openPromptLibraryModal();
        const checkbox = document.querySelector<HTMLInputElement>('[data-testid="library-export-include-revisions"]')!;
        checkbox.checked = true;
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="library-export"]')!;
        btn.click();
        await Promise.resolve();
        expect(ioMocks.exportPromptsToJson).toHaveBeenCalledWith({ includeRevisions: true });
    });

    it('Import scope=next passes roleFilter to performPromptImport', async () => {
        await openPromptLibraryModal();
        const sel = document.querySelector<HTMLSelectElement>('[data-testid="library-import-role-filter"]')!;
        sel.value = 'next';
        // Simulate an import via the internal pipeline: dispatch a file through change.
        const input = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        const file = new File(['{"version":1,"exportedAt":"","entries":[]}'], 'p.json', { type: 'application/json' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        // Allow the async import pipeline to settle.
        await new Promise((r) => setTimeout(r, 20));
        expect(ioMocks.performPromptImport).toHaveBeenCalled();
        const opts = ioMocks.performPromptImport.mock.calls[0]![1] as { roleFilter?: string };
        expect(opts.roleFilter).toBe('next');
    });

    it('Import scope=all omits roleFilter', async () => {
        await openPromptLibraryModal();
        const input = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        const file = new File(['{"version":1,"exportedAt":"","entries":[]}'], 'p.json', { type: 'application/json' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        await new Promise((r) => setTimeout(r, 20));
        const opts = ioMocks.performPromptImport.mock.calls[0]![1] as { roleFilter?: string };
        expect(opts.roleFilter).toBeUndefined();
    });
});
