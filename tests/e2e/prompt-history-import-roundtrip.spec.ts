/**
 * prompt-history-import-roundtrip.spec.ts
 *
 * Browser regression for the Prompt History import round-trip (v4.184.0+).
 *
 * Covers:
 *   1. Initial panel open renders exactly the native revision rows with zero
 *      `imported` provenance badges.
 *   2. After a valid JSON import completes, reopening the panel shows the
 *      combined row count (native + imported) and one `imported` badge for
 *      each row whose `PromptId` is the `0` sentinel written by
 *      `insertImportedRevisions`.
 *   3. The import success toast reports the exact number of rows written.
 *
 * The DB layer is faked at the `chrome.runtime.sendMessage` boundary: SELECT
 * MAX(Id) returns a stable snapshot, INSERT / DELETE calls always succeed,
 * and `listPromptRevisions` is stubbed through `HistoryPanelDeps` so the
 * before/after state is fully controlled in-test.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bundleBrowserIife } from './utils/esbuild-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const HISTORY_PANEL_ENTRY = path.join(
    REPO_ROOT,
    'standalone-scripts/macro-controller/src/ui/prompt-history-panel.ts',
);

const SLUG = 'plan-default';
const ROLE = 'plan';

let bundleSource = '';
let browser: Browser | undefined;

function resolveChromiumExecutable(): string | undefined {
    const candidates = ['/usr/bin/chromium', '/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
    return undefined;
}

test.beforeAll(async () => {
    bundleSource = await bundleBrowserIife(REPO_ROOT, {
        entryPoint: HISTORY_PANEL_ENTRY,
        globalName: 'PromptHistoryPanelBundle',
        footerJs: 'window.__promptHistoryPanel = PromptHistoryPanelBundle;',
    });
    browser = await chromium.launch({
        headless: true,
        executablePath: resolveChromiumExecutable(),
    });
});

test.afterAll(async () => {
    if (browser) await browser.close();
});

async function newHarnessPage(): Promise<Page> {
    if (!browser) throw new Error('browser not initialized');
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
        interface RuntimeMessage {
            type?: string;
            method?: string;
            params?: { sql?: string };
        }
        interface RuntimeResponse {
            isOk: boolean;
            rows?: Array<Record<string, unknown>>;
            lastInsertId?: number;
        }
        const calls: Array<{ type: string; method?: string; sql?: string }> = [];
        (globalThis as typeof globalThis & { __calls: typeof calls }).__calls = calls;
        (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (message: RuntimeMessage, callback: (response: RuntimeResponse) => void) => {
                    const sql = message.params?.sql ?? '';
                    calls.push({ type: String(message.type ?? ''), method: message.method, sql });
                    let rows: Array<Record<string, unknown>> = [];
                    if (/SELECT\s+MAX\(Id\)/i.test(sql)) rows = [{ MaxId: 100 }];
                    setTimeout(() => callback({ isOk: true, rows, lastInsertId: 101 }), 0);
                },
            },
        };
    });

    await page.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://prompt-history-import-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

test.describe('prompt history import round-trip', () => {
    test('imported rows show the provenance badge and grow the row count', async () => {
        const page = await newHarnessPage();

        // ---- Stage 1: initial open with 2 native revisions ----
        await page.evaluate(async ({ slug, role }) => {
            interface RevRow {
                Id: number; PromptId: number; Slug: string; Name: string; Body: string;
                Role: string; ReplaceKey: string; ReplaceValues: string; CreatedAt: number; Reason: string;
            }
            const nativeRows: RevRow[] = [
                { Id: 91, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'v1 body', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_000_000, Reason: 'upsert' },
                { Id: 92, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'v2 body', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_100_000, Reason: 'upsert' },
            ];
            const importedRows: RevRow[] = [
                { Id: 101, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported A', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_200_000, Reason: 'import' },
                { Id: 102, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported B', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_300_000, Reason: 'import' },
                { Id: 103, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported C', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_400_000, Reason: 'import' },
            ];
            const state = { openCount: 0, toasts: [] as Array<{ message: string; kind?: string }> };
            (window as unknown as { __state: typeof state }).__state = state;

            interface DbOk<T> { ok: boolean; value?: T; error?: string }
            const listRevisions = async (): Promise<DbOk<RevRow[]>> => {
                state.openCount += 1;
                if (state.openCount === 1) return { ok: true, value: nativeRows.slice() };
                return { ok: true, value: [...nativeRows, ...importedRows] };
            };
            const toast = (message: string, kind?: string) => { state.toasts.push({ message, kind }); };
            (window as unknown as { __deps: unknown }).__deps = { listRevisions, toast, undoToast: toast };

            interface HistoryApi {
                openPromptHistoryPanel: (
                    input: { role: string; slug: string },
                    deps: unknown,
                ) => Promise<void>;
            }
            const api = (window as unknown as { __promptHistoryPanel: HistoryApi }).__promptHistoryPanel;
            await api.openPromptHistoryPanel({ role, slug }, (window as unknown as { __deps: unknown }).__deps);
        }, { slug: SLUG, role: ROLE });

        // Assert: 2 rows, 0 imported badges.
        await expect(page.locator('#marco-prompt-history-panel [data-role="revision-row"]')).toHaveCount(2);
        await expect(page.locator('#marco-prompt-history-panel [data-role="imported-badge"]')).toHaveCount(0);

        // ---- Stage 2: trigger import via the hidden file input ----
        const payload = JSON.stringify({
            schemaVersion: 1,
            slug: SLUG,
            role: ROLE,
            exportedAt: 1_700_000_500_000,
            revisionCount: 3,
            revisions: [
                { Slug: SLUG, Name: 'Plan default', Body: 'imported A', Role: ROLE, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_200_000, Reason: 'import' },
                { Slug: SLUG, Name: 'Plan default', Body: 'imported B', Role: ROLE, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_300_000, Reason: 'import' },
                { Slug: SLUG, Name: 'Plan default', Body: 'imported C', Role: ROLE, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_400_000, Reason: 'import' },
            ],
        });

        await page.locator('input[data-testid="history-import-input"]').setInputFiles({
            name: 'history-plan-default.json',
            mimeType: 'application/json',
            buffer: Buffer.from(payload, 'utf8'),
        });

        // Wait for the DB write path to record the INSERTs.
        await expect.poll(async () =>
            page.evaluate(() => (globalThis as unknown as {
                __calls: Array<{ sql?: string }>;
            }).__calls.filter((c) => /INSERT\s+INTO\s+PromptRevision/i.test(c.sql ?? '')).length),
        ).toBe(3);

        // Success toast reports the exact count written.
        const importToasts = await page.evaluate(() =>
            (window as unknown as { __state: { toasts: Array<{ message: string }> } })
                .__state.toasts.map((t) => t.message));
        expect(importToasts.some((m) => m.includes('Imported 3 revision(s)'))).toBe(true);

        // ---- Stage 3: reopen and assert combined count + badges ----
        await page.evaluate(async ({ slug, role }) => {
            interface HistoryApi {
                openPromptHistoryPanel: (input: { role: string; slug: string }, deps: unknown) => Promise<void>;
            }
            const api = (window as unknown as { __promptHistoryPanel: HistoryApi }).__promptHistoryPanel;
            await api.openPromptHistoryPanel({ role, slug }, (window as unknown as { __deps: unknown }).__deps);
        }, { slug: SLUG, role: ROLE });

        const panel = page.locator('#marco-prompt-history-panel');
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(5);
        await expect(panel.locator('[data-role="imported-badge"]')).toHaveCount(3);

        // Every badge must sit inside a row whose data-revision-id matches a
        // sentinel (PromptId=0) source row. The stub returns Ids 101..103 for
        // those, so assert the badge parent rows are exactly that set.
        const badgeRowIds = await panel
            .locator('[data-role="revision-row"]:has([data-role="imported-badge"])')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-revision-id')));
        expect(badgeRowIds.sort()).toEqual(['101', '102', '103']);

        await page.context().close();
    });
});
