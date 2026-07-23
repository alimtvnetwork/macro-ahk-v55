/**
 * Plan-22 gap #8: `exportPromptsToJson` empty-DB negative path.
 *
 * When the DB and cache are both empty, the exporter MUST warn the user
 * via toast and MUST NOT emit a blob download. Regression guard: prior
 * behaviour silently produced an empty file, tricking users into thinking
 * their prompts had been persisted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/prompt-cache', () => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] })),
}));
vi.mock('../ui/prompt-io-db-bridge', () => ({
    collectDbEntriesForExport: vi.fn(async () => []),
    mergeDbIntoExport: vi.fn((cache: unknown[], db: unknown[]) => [...cache, ...db]),
}));
vi.mock('../toast', () => ({ showToast: vi.fn() }));
vi.mock('../logging', () => ({ log: vi.fn() }));
vi.mock('../shared-state', () => ({ VERSION: 'v0.test.0' }));
vi.mock('../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async () => ({ ok: true, value: [] })),
    insertImportedRevisions: vi.fn(async () => ({ ok: true })),
}));

import { exportPromptsToJson, collectAllExportEntries } from '../ui/prompt-io';
import { showToast } from '../toast';

describe('exportPromptsToJson: empty-DB negative path', () => {
    beforeEach(() => {
        (showToast as unknown as { mockClear: () => void }).mockClear();
    });

    it('collectAllExportEntries returns [] when cache and DB are empty', async () => {
        const entries = await collectAllExportEntries();
        expect(entries).toEqual([]);
    });

    it('emits a warn toast and does NOT create a blob download', async () => {
        const createObjectURL = vi.fn(() => 'blob:mock');
        const originalURL = globalThis.URL;
        // @ts-expect-error - override for test
        globalThis.URL = { ...originalURL, createObjectURL, revokeObjectURL: vi.fn() };

        await exportPromptsToJson();

        expect(showToast).toHaveBeenCalledTimes(1);
        const call = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        expect(String(call[0])).toMatch(/no prompts/i);
        expect(call[1]).toBe('warn');
        expect(createObjectURL).not.toHaveBeenCalled();

        globalThis.URL = originalURL;
    });
});
