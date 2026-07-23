/**
 * prompt-rename-regression.spec.ts (plan-15 task 18)
 *
 * End-to-end Playwright regression for the configurable-token rename flow:
 *
 *   1. `{{n}} -> {{count}}` with previousReplaceKey='n' + replaceKey='count'
 *      is accepted by `upsertPrompt` and issues an UPDATE that writes
 *      `ReplaceKey = 'count'` + JSON-encoded `ReplaceValues`.
 *   2. A plan edit that drops `{{n}}` entirely (no rename supplied) is
 *      rejected with ok=false + a ParamTokenMismatch error and never
 *      issues a SCHEMA (write) call.
 *   3. Legacy insert path (no previousBody) still works and writes the
 *      caller-supplied `ReplaceValues`.
 *
 * Runs the ACTUAL bundled `prompt-db.ts` inside a real Chromium page with
 * a stubbed `chrome.runtime.sendMessage` — same contract as the seed-plan-
 * next harness, so any drift in `checkTokenGuard` / `resolveReplaceFields`
 * / SQL generation surfaces exactly as it would in a hand-driven DevTools
 * regression.
 *
 * Ref: plan-15 close-out, changelog v4.76.0.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bundleBrowserIife } from './utils/esbuild-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const DB_ENTRY = path.join(
    REPO_ROOT,
    'standalone-scripts/macro-controller/src/db/prompt-db.ts',
);

interface FakeSqlCall { method: string; sql: string }
interface FakeSqlResp { isOk: boolean; rows?: unknown[]; errorMessage?: string; lastInsertId?: number }

let bundleSource = '';
let browser: Browser | undefined;

function resolveChromiumExecutable(): string | undefined {
    const candidates = ['/usr/bin/chromium', '/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return undefined;
}

test.beforeAll(async () => {
    bundleSource = await bundleBrowserIife(REPO_ROOT, {
        entryPoint: DB_ENTRY,
        globalName: 'PromptDb',
        footerJs: 'window.__promptDb = PromptDb;',
    });

    browser = await chromium.launch({
        headless: true,
        executablePath: resolveChromiumExecutable(),
    });
});

test.afterAll(async () => {
    if (browser) await browser.close();
});

async function newHarnessPage(responses: FakeSqlResp[]): Promise<Page> {
    if (!browser) throw new Error('browser not initialized');
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript((seededResponses: FakeSqlResp[]) => {
        (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls = [];
        const queue = seededResponses.slice();
        (globalThis as unknown as { chrome: unknown }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (
                    message: { type: string; method?: string; params?: { sql?: string } },
                    callback: (r: unknown) => void,
                ) => {
                    const sql = (message?.params?.sql ?? '') as string;
                    (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls.push({
                        method: String(message?.method ?? ''),
                        sql,
                    });
                    const resp = queue.shift() ?? { isOk: true, rows: [], lastInsertId: 1 };
                    setTimeout(() => callback(resp), 0);
                },
            },
        };
    }, responses);

    await context.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://rename-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

interface UpsertResult { ok: boolean; value?: number; error?: string }

test.describe('prompt rename regression (plan-15)', () => {
    test('accepts {{n}} -> {{count}} rename and writes ReplaceKey/ReplaceValues in the UPDATE', async () => {
        const page = await newHarnessPage([
            // Single SCHEMA ack for the UPDATE.
            { isOk: true, lastInsertId: 1 },
        ]);

        const result = await page.evaluate(async () => {
            const api = (window as unknown as { __promptDb: { upsertPrompt: (i: unknown) => Promise<UpsertResult> } }).__promptDb;
            return api.upsertPrompt({
                id: 1, slug: 'plan-default', name: 'Plan default',
                body: 'Give me the next {{count}} steps',
                role: 'plan',
                previousBody: 'Give me the next {{n}} steps',
                previousReplaceKey: 'n',
                replaceKey: 'count',
                replaceValues: ['3', '5', '8'],
            });
        }) as UpsertResult;

        expect(result.ok).toBe(true);
        expect(result.error).toBeUndefined();

        const calls = await page.evaluate(() => (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls);
        const schemaCalls = calls.filter(c => c.method === 'SCHEMA');
        expect(schemaCalls).toHaveLength(1);
        expect(schemaCalls[0].sql).toMatch(/^UPDATE Prompt/);
        expect(schemaCalls[0].sql).toContain("ReplaceKey = 'count'");
        expect(schemaCalls[0].sql).toContain('"3","5","8"');

        await page.context().close();
    });

    test('rejects a plan edit that drops {{n}} entirely with ParamTokenMismatch and NO write', async () => {
        const page = await newHarnessPage([]);

        const result = await page.evaluate(async () => {
            const api = (window as unknown as { __promptDb: { upsertPrompt: (i: unknown) => Promise<UpsertResult> } }).__promptDb;
            return api.upsertPrompt({
                id: 1, slug: 'plan-default', name: 'Plan default',
                body: 'Give me the next steps',
                role: 'plan',
                previousBody: 'Give me the next {{n}} steps',
            });
        }) as UpsertResult;

        expect(result.ok).toBe(false);
        expect(result.error ?? '').toContain('ParamTokenMismatch');
        expect(result.error ?? '').toContain('removed');

        const calls = await page.evaluate(() => (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls);
        const schemaCalls = calls.filter(c => c.method === 'SCHEMA');
        expect(schemaCalls, 'no write should have fired').toHaveLength(0);

        await page.context().close();
    });

    test('fresh insert (no previousBody) writes ReplaceValues and returns lastInsertId', async () => {
        const page = await newHarnessPage([
            { isOk: true, lastInsertId: 42 },
        ]);

        const result = await page.evaluate(async () => {
            const api = (window as unknown as { __promptDb: { upsertPrompt: (i: unknown) => Promise<UpsertResult> } }).__promptDb;
            return api.upsertPrompt({
                slug: 'plan-custom', name: 'Plan custom',
                body: 'Do the next {{n}} tasks',
                role: 'plan',
                replaceKey: 'n',
                replaceValues: ['2', '4', '6'],
            });
        }) as UpsertResult;

        expect(result.ok).toBe(true);
        expect(result.value).toBe(42);

        const calls = await page.evaluate(() => (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls);
        const schemaCalls = calls.filter(c => c.method === 'SCHEMA');
        expect(schemaCalls).toHaveLength(1);
        expect(schemaCalls[0].sql).toMatch(/^INSERT INTO Prompt/);
        expect(schemaCalls[0].sql).toContain('"2","4","6"');

        await page.context().close();
    });
});
