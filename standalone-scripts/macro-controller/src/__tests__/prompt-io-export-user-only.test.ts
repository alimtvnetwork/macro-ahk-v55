/**
 * v4.400.0: exportPromptsToJson MUST filter out isDefault=true rows.
 * Covers the JSON path end-to-end: default+user mix in, only user rows
 * land in the emitted blob, toast reports "user prompts" + "defaults skipped".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const defaultEntry = { name: 'Plan default', text: 'body-plan', slug: 'plan-default', role: 'plan', isDefault: true };
const userEntry = { name: 'My custom', text: 'body-user', slug: 'my-custom', role: 'plan', isDefault: false };

vi.mock('../ui/prompt-cache', () => ({ readJsonCopy: vi.fn(async () => ({ entries: [] })) }));
vi.mock('../ui/prompt-io-db-bridge', () => ({
    collectDbEntriesForExport: vi.fn(async () => [defaultEntry, userEntry]),
    mergeDbIntoExport: vi.fn((_cache: unknown[], db: unknown[]) => [...db]),
}));
vi.mock('../toast', () => ({ showToast: vi.fn() }));
vi.mock('../logger', () => ({ log: vi.fn() }));
vi.mock('../shared-state', () => ({ VERSION: '0.1.0' }));
vi.mock('../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async () => ({ ok: true, value: [] })),
    insertImportedRevisions: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../ui/prompt-drag-order', () => ({ getEffectivePromptOrder: () => [] }));

import { exportPromptsToJson, filterUserAddedEntries, isUserAddedEntry } from '../ui/prompt-io';
import { showToast } from '../toast';

describe('exportPromptsToJson: user-added scope (v4.400.0)', () => {
    beforeEach(() => { (showToast as unknown as { mockClear: () => void }).mockClear(); });

    it('isUserAddedEntry returns false for isDefault=true rows', () => {
        expect(isUserAddedEntry({ name: 'a', text: 'b', isDefault: true } as never)).toBe(false);
        expect(isUserAddedEntry({ name: 'a', text: 'b', isDefault: false } as never)).toBe(true);
        expect(isUserAddedEntry({ name: 'a', text: 'b' } as never)).toBe(true);
    });

    it('filterUserAddedEntries drops defaults and counts them', () => {
        const { kept, defaultsSkipped } = filterUserAddedEntries([defaultEntry, userEntry] as never);
        expect(kept.length).toBe(1);
        expect(kept[0].slug).toBe('my-custom');
        expect(defaultsSkipped).toBe(1);
    });

    it('exports only user entries and toast reports defaults skipped', async () => {
        const chunks: BlobPart[] = [];
        const OriginalBlob = globalThis.Blob;
        // @ts-expect-error test override
        globalThis.Blob = class {
            constructor(parts: BlobPart[]) { chunks.push(...parts); }
        };
        const createObjectURL = vi.fn(() => 'blob:mock');
        const originalURL = globalThis.URL;
        // @ts-expect-error test override
        globalThis.URL = { ...originalURL, createObjectURL, revokeObjectURL: vi.fn() };

        await exportPromptsToJson();

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const emitted = chunks.map((c) => String(c)).join('');
        expect(emitted).toContain('"my-custom"');
        expect(emitted).not.toContain('"plan-default"');

        const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls.length).toBe(1);
        expect(String(calls[0][0])).toMatch(/1 user prompts.*1 defaults skipped/);
        expect(calls[0][1]).toBe('success');

        globalThis.URL = originalURL;
        globalThis.Blob = OriginalBlob;
    });

    it('warns and skips download when only defaults exist', async () => {
        const bridge = await import('../ui/prompt-io-db-bridge');
        (bridge.collectDbEntriesForExport as unknown as { mockResolvedValueOnce: (v: unknown) => void })
            .mockResolvedValueOnce([defaultEntry]);
        const createObjectURL = vi.fn(() => 'blob:mock');
        const originalURL = globalThis.URL;
        // @ts-expect-error test override
        globalThis.URL = { ...originalURL, createObjectURL, revokeObjectURL: vi.fn() };

        await exportPromptsToJson();

        expect(createObjectURL).not.toHaveBeenCalled();
        const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(String(calls[0][0])).toMatch(/only default prompts/i);
        expect(calls[0][1]).toBe('warn');
        globalThis.URL = originalURL;
    });
});
