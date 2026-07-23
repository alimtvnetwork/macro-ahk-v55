/**
 * prompt-history-sort-filter.spec.ts
 *
 * Playwright E2E regression for the Prompt History panel toolbar
 * (v4.192.0+): sortable Date/Reason columns, reason filter chips, and
 * the tri-state imported chip. Asserts the visible row count and order
 * update after each toolbar interaction.
 *
 * DB access is faked at `chrome.runtime.sendMessage`; the revision list
 * is delivered via `HistoryPanelDeps.listRevisions` so the fixture is
 * fully controlled in-test.
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
        interface RuntimeResponse {
            isOk: boolean;
            rows?: Array<Record<string, unknown>>;
            lastInsertId?: number;
        }
        (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (_msg: unknown, callback: (r: RuntimeResponse) => void) => {
                    setTimeout(() => callback({ isOk: true, rows: [], lastInsertId: 0 }), 0);
                },
            },
        };
    });

    await page.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://prompt-history-sort-filter-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

async function openPanel(page: Page): Promise<void> {
    await page.evaluate(async ({ slug, role }) => {
        interface RevRow {
            Id: number; PromptId: number; Slug: string; Name: string; Body: string;
            Role: string; ReplaceKey: string; ReplaceValues: string; CreatedAt: number; Reason: string;
        }
        // Deterministic mixed fixture: 2 upsert (native), 1 restore
        // (native), 1 import (imported sentinel PromptId=0).
        const rows: RevRow[] = [
            { Id: 11, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'earliest',
              Role: role, ReplaceKey: 'n', ReplaceValues: '["1"]',
              CreatedAt: 1_700_000_100_000, Reason: 'upsert' },
            { Id: 12, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'middle-a',
              Role: role, ReplaceKey: 'n', ReplaceValues: '["1"]',
              CreatedAt: 1_700_000_200_000, Reason: 'restore' },
            { Id: 13, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'middle-b',
              Role: role, ReplaceKey: 'n', ReplaceValues: '["1"]',
              CreatedAt: 1_700_000_300_000, Reason: 'upsert' },
            { Id: 14, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported-latest',
              Role: role, ReplaceKey: 'n', ReplaceValues: '["1"]',
              CreatedAt: 1_700_000_400_000, Reason: 'import' },
        ];
        interface DbOk<T> { ok: boolean; value?: T; error?: string }
        const listRevisions = async (): Promise<DbOk<RevRow[]>> => ({ ok: true, value: rows.slice() });
        const toast = () => { /* noop */ };
        (window as unknown as { __deps: unknown }).__deps = { listRevisions, toast, undoToast: toast };

        interface HistoryApi {
            openPromptHistoryPanel: (input: { role: string; slug: string }, deps: unknown) => Promise<void>;
        }
        const api = (window as unknown as { __promptHistoryPanel: HistoryApi }).__promptHistoryPanel;
        await api.openPromptHistoryPanel({ role, slug }, (window as unknown as { __deps: unknown }).__deps);
    }, { slug: SLUG, role: ROLE });
}

async function rowIds(page: Page): Promise<string[]> {
    return page
        .locator('#marco-prompt-history-panel [data-role="revision-row"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-revision-id') ?? ''));
}

test.describe('prompt history sort + filter toolbar', () => {
    test('sort by Date/Reason and reason/imported chips update the visible row set', async () => {
        const page = await newHarnessPage();
        await openPanel(page);

        const panel = page.locator('#marco-prompt-history-panel');

        // Default: 4 rows, sorted by Date desc (newest first).
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(4);
        expect(await rowIds(page)).toEqual(['14', '13', '12', '11']);

        // Click Date sort again -> flips to ascending.
        await panel.locator('[data-role="sort-button"][data-sort-key="date"]').click();
        expect(await rowIds(page)).toEqual(['11', '12', '13', '14']);

        // Click Reason -> switches key, resets to desc. Reasons: import,
        // restore, upsert, upsert -> desc localeCompare -> u,u,r,i.
        await panel.locator('[data-role="sort-button"][data-sort-key="reason"]').click();
        const orderReasonDesc = await rowIds(page);
        // First two must be the two `upsert` rows (Ids 11 & 13),
        // followed by `restore` (12), then `import` (14).
        expect(orderReasonDesc.slice(0, 2).sort()).toEqual(['11', '13']);
        expect(orderReasonDesc[2]).toBe('12');
        expect(orderReasonDesc[3]).toBe('14');

        // Filter by reason chip 'upsert' -> only 2 rows survive.
        await panel.locator('[data-role="reason-chip"][data-reason="upsert"]').click();
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(2);
        expect((await rowIds(page)).sort()).toEqual(['11', '13']);
        await expect(panel.locator('[data-role="reason-chip"][data-reason="upsert"]'))
            .toHaveAttribute('aria-pressed', 'true');

        // Clear filters returns all 4.
        await panel.locator('button[data-action="clear-filters"]').click();
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(4);

        // Imported chip cycles all -> only -> hide.
        const importedChip = panel.locator('[data-role="imported-chip"]');
        await importedChip.click(); // -> only
        await expect(importedChip).toHaveAttribute('data-imported-filter', 'only');
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(1);
        expect(await rowIds(page)).toEqual(['14']);
        await expect(panel.locator('[data-role="imported-badge"]')).toHaveCount(1);

        await panel.locator('[data-role="imported-chip"]').click(); // -> hide
        await expect(panel.locator('[data-role="imported-chip"]'))
            .toHaveAttribute('data-imported-filter', 'exclude');
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(3);
        expect((await rowIds(page)).sort()).toEqual(['11', '12', '13']);
        await expect(panel.locator('[data-role="imported-badge"]')).toHaveCount(0);

        // Combine imported=hide with reason=restore -> only Id 12.
        await panel.locator('[data-role="reason-chip"][data-reason="restore"]').click();
        await expect(panel.locator('[data-role="revision-row"]')).toHaveCount(1);
        expect(await rowIds(page)).toEqual(['12']);

        await page.context().close();
    });
});
