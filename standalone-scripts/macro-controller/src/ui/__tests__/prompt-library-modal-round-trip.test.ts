/**
 * prompt-library-modal - end-to-end Export -> Import round-trip wiring.
 *
 * Complements `prompt-library-modal-import-export.test.ts` (which only asserts
 * each button delegates to a mock). This test uses the REAL `prompt-io`
 * export/parse pipeline and asserts that the JSON blob produced by clicking
 * "Export" survives being fed back through the modal's file-input change
 * handler: every fixture entry is validated, forwarded to `performPromptImport`,
 * and reported in the success summary.
 *
 * Coverage:
 *  - Export writes a `PromptsBundleV1` envelope to `URL.createObjectURL(...)`.
 *  - The generated JSON parses via `parsePromptsText` without errors.
 *  - `performPromptImport` receives exactly the fixture entries after round-trip
 *    (name/text/category/isFavorite/isDefault preserved).
 *  - The status line ends with a "+N added" summary matching the fixture count.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
const mocks = vi.hoisted(() => ({ logError: vi.fn(), showToast: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: mocks.logError }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));

// Fixture rows drive both export (via readJsonCopy) and the round-trip assertions.
const FIXTURE = [
    // v4.400.0: import/export is scoped to user-added prompts. All fixture
    // rows must be `isDefault=false` so the round-trip carries them end-to-end.
    // Default protection is covered in prompt-io-import-protect-defaults.test.ts.
    { name: 'Alpha', text: 'body A', category: 'General', isFavorite: false, isDefault: false, slug: 'alpha' },
    { name: 'Beta',  text: 'body B', category: 'Plans',   isFavorite: true,  isDefault: false, slug: 'beta' },
    { name: 'Gamma', text: 'body Γ with unicode ✓', category: 'General', isFavorite: false, isDefault: false, slug: 'gamma' },
] as const;

const cache = vi.hoisted(() => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] as unknown[] })),
    writeJsonCopy: vi.fn(async () => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));
vi.mock('../prompt-cache', () => cache);

const bridge = vi.hoisted(() => ({
    collectDbEntriesForExport: vi.fn(async () => [] as unknown[]),
    mergeDbIntoExport: vi.fn((cacheEntries: unknown[], _dbEntries: unknown[]) => cacheEntries),
    partitionByRole: vi.fn((entries: unknown[]) => ({ dbEntries: [], cacheEntries: entries })),
    commitDbEntries: vi.fn(async () => ({ upserted: 0, errors: [] as string[] })),
}));
vi.mock('../prompt-io-db-bridge', () => bridge);

vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));

vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: vi.fn(async () => ({ ok: true, value: [] })),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));

// Spy on performPromptImport so we can assert the payload after the round-trip,
// but keep parsePromptsText / exportPromptsToJson real.
import * as promptIo from '../prompt-io';
import { openPromptLibraryModal } from '../prompt-library-modal';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

describe('prompt-library-modal - Export -> Import round-trip', () => {
    let capturedBlob: Blob | null = null;
    let performSpy: ReturnType<typeof vi.spyOn> | null = null;

    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.logError.mockReset();
        mocks.showToast.mockReset();
        cache.readJsonCopy.mockResolvedValue({ entries: FIXTURE as unknown as [] });
        cache.writeJsonCopy.mockClear();
        cache.clearPromptCache.mockClear();
        bridge.collectDbEntriesForExport.mockClear();
        bridge.partitionByRole.mockClear();
        bridge.commitDbEntries.mockClear();

        capturedBlob = null;
        // jsdom lacks URL.createObjectURL; stub it and capture the blob the
        // exporter hands off for download.
        (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
            capturedBlob = b;
            return 'blob:mock';
        };
        (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;

        performSpy = vi.spyOn(promptIo, 'performPromptImport').mockResolvedValue({
            added: FIXTURE.length, updated: 0, total: FIXTURE.length, errors: [],
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        performSpy?.mockRestore();
        vi.restoreAllMocks();
    });

    it('serialises fixture prompts on Export and re-imports every entry via the file-input change handler', async () => {
        await openPromptLibraryModal();
        await flush();

        // 1. Trigger Export -> capture the Blob written to URL.createObjectURL.
        const exportBtn = document.querySelector<HTMLButtonElement>('[data-testid="library-export"]')!;
        exportBtn.click();
        for (let i = 0; i < 20 && capturedBlob === null; i++) await flush();
        expect(capturedBlob).not.toBeNull();

        const json = await capturedBlob!.text();
        // 2. Sanity: the envelope parses locally and preserves the fixture bodies.
        const parsed = promptIo.parsePromptsText(json);
        expect(parsed.errors).toEqual([]);
        expect(parsed.valid.map((e) => e.name)).toEqual(FIXTURE.map((f) => f.name));
        expect(parsed.valid.map((e) => e.text)).toEqual(FIXTURE.map((f) => f.text));

        // 3. Feed the exported JSON back through the modal's Import handler.
        const fileInput = document.querySelector<HTMLInputElement>('[data-testid="library-import-file"]')!;
        const roundTripFile = new File([json], 'roundtrip.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [roundTripFile], configurable: true });
        fileInput.dispatchEvent(new Event('change'));
        await flush();
        await flush();

        // 4. Assert performPromptImport received the round-tripped entries verbatim
        //    (order + core fields preserved).
        expect(performSpy).toHaveBeenCalledTimes(1);
        const forwarded = performSpy!.mock.calls[0]![0] as Array<Record<string, unknown>>;
        expect(forwarded).toHaveLength(FIXTURE.length);
        FIXTURE.forEach((fixture, i) => {
            expect(forwarded[i]!.name).toBe(fixture.name);
            expect(forwarded[i]!.text).toBe(fixture.text);
            expect(forwarded[i]!.category).toBe(fixture.category);
            expect(forwarded[i]!.isFavorite).toBe(fixture.isFavorite);
            expect(forwarded[i]!.isDefault).toBe(fixture.isDefault);
        });

        // 5. Summary toast reports the fixture count.
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.stringContaining('+' + FIXTURE.length + ' added'),
            expect.any(String),
        );
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    it('produces a PromptsBundleV1 envelope (schemaVersion + entries) rather than a bare array', async () => {
        await openPromptLibraryModal();
        await flush();
        document.querySelector<HTMLButtonElement>('[data-testid="library-export"]')!.click();
        for (let i = 0; i < 20 && capturedBlob === null; i++) await flush();

        expect(capturedBlob).not.toBeNull();
        const payload = JSON.parse(await capturedBlob!.text()) as Record<string, unknown>;
        expect(payload).toMatchObject({ schemaVersion: expect.any(Number) });
        expect(Array.isArray(payload.entries)).toBe(true);
        expect((payload.entries as unknown[]).length).toBe(FIXTURE.length);
    });
});
