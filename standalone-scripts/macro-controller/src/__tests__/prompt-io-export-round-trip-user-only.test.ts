/**
 * v4.400.0: Round-trip contract. Exported JSON payload MUST reproduce as
 * a valid PromptsBundleV1 whose entries are all user-added (isDefault=false),
 * and re-parsing it via parsePromptsText MUST return only those user rows.
 */
import { describe, it, expect, vi } from 'vitest';

const defaultEntry = { name: 'D', text: 'd-body', slug: 'd', role: 'plan', isDefault: true };
const userA = { name: 'A', text: 'a-body', slug: 'a', role: 'plan', isDefault: false };
const userB = { name: 'B', text: 'b-body', slug: 'b', role: 'next', isDefault: false };

vi.mock('../ui/prompt-cache', () => ({ readJsonCopy: vi.fn(async () => ({ entries: [] })) }));
vi.mock('../ui/prompt-io-db-bridge', () => ({
    collectDbEntriesForExport: vi.fn(async () => [defaultEntry, userA, userB]),
    mergeDbIntoExport: vi.fn((_c: unknown[], db: unknown[]) => [...db]),
}));
vi.mock('../toast', () => ({ showToast: vi.fn() }));
vi.mock('../logger', () => ({ log: vi.fn() }));
vi.mock('../shared-state', () => ({ VERSION: '0.1.0' }));
vi.mock('../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async () => ({ ok: true, value: [] })),
    insertImportedRevisions: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../ui/prompt-drag-order', () => ({ getEffectivePromptOrder: () => [] }));

import { exportPromptsToJson, parsePromptsText } from '../ui/prompt-io';

describe('exportPromptsToJson round trip: user-only (v4.400.0)', () => {
    it('emits only user entries and re-parses cleanly with isDefault=false', async () => {
        const chunks: BlobPart[] = [];
        const OriginalBlob = globalThis.Blob;
        // @ts-expect-error test override
        globalThis.Blob = class { constructor(parts: BlobPart[]) { chunks.push(...parts); } };
        const originalURL = globalThis.URL;
        // @ts-expect-error test override
        globalThis.URL = { ...originalURL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() };

        await exportPromptsToJson();

        const jsonText = chunks.map((c) => String(c)).join('');
        const parsed = parsePromptsText(jsonText);
        expect(parsed.errors).toEqual([]);
        expect(parsed.valid.map((e) => e.slug).sort()).toEqual(['a', 'b']);
        for (const e of parsed.valid) expect(e.isDefault).toBe(false);
        expect(jsonText).not.toContain('"d-body"');

        globalThis.URL = originalURL;
        globalThis.Blob = OriginalBlob;
    });
});
