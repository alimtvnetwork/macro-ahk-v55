/**
 * prompt-chip-edit-regression.spec.ts
 *
 * Browser regression for chip gear editing. Plan and Next chip edits must
 * update the role-scoped Prompt table row through PROJECT_API/rawSql and must
 * never call the legacy SAVE_PROMPT list path that creates extra prompt rows.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bundleBrowserIife } from './utils/esbuild-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const PROMPT_INJECTION_ENTRY = path.join(
    REPO_ROOT,
    'standalone-scripts/macro-controller/src/ui/prompt-injection.ts',
);

interface FakeMessageCall {
    readonly type: string;
    readonly method?: string;
    readonly sql?: string;
}

let bundleSource = '';
let browser: Browser | undefined;

function resolveChromiumExecutable(): string | undefined {
    const candidates = ['/usr/bin/chromium', '/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
    return undefined;
}

test.beforeAll(async () => {
    bundleSource = await bundleBrowserIife(REPO_ROOT, {
        entryPoint: PROMPT_INJECTION_ENTRY,
        globalName: 'PromptInjectionBundle',
        footerJs: 'window.__promptInjection = PromptInjectionBundle;',
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
        type RuntimeMessage = { type?: string; method?: string; params?: { sql?: string } };
        type RuntimeResponse = { isOk: boolean; rows?: Array<Record<string, string>>; lastInsertId?: number };
        const calls: FakeMessageCall[] = [];
        (globalThis as typeof globalThis & { __calls: FakeMessageCall[] }).__calls = calls;
        (globalThis as typeof globalThis & { chrome: { runtime: { lastError: null; sendMessage: (message: RuntimeMessage, callback: (response: RuntimeResponse) => void) => void } } }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (message: RuntimeMessage, callback: (response: RuntimeResponse) => void) => {
                    calls.push({
                        type: String(message.type ?? ''),
                        method: message.method,
                        sql: message.params?.sql,
                    });
                    setTimeout(() => callback({ isOk: true, rows: [], lastInsertId: 1 }), 0);
                },
            },
        };
    });

    await context.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://prompt-chip-edit-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

const CHIP_EDIT_CASES = [
    { role: 'plan', label: 'Plan', id: '7', slug: 'plan-default' },
    { role: 'next', label: 'Next', id: '8', slug: 'next-default' },
] as const;

test.describe('prompt chip editor save routing', () => {
    for (const chipCase of CHIP_EDIT_CASES) {
    test(chipCase.label + ' chip edit updates the Prompt table and does not create a legacy list prompt', async () => {
        const page = await newHarnessPage();

        await page.evaluate((input) => {
            type PromptRoleForTest = 'plan' | 'next';
            type PromptInjectionApi = {
                openPromptCreationModal: (
                    context: { promptsDropdown: HTMLElement },
                    taskNextDeps: Record<string, never>,
                    editPrompt: {
                        id: string;
                        slug: string;
                        name: string;
                        text: string;
                        role: PromptRoleForTest;
                        replaceKey: string;
                        replaceValues: string[];
                    },
                    prefillData: undefined,
                    options: { requiredTokens: string[]; roleLabel: string; role: PromptRoleForTest },
                ) => void;
            };
            const api = (window as typeof window & { __promptInjection: PromptInjectionApi }).__promptInjection;
            api.openPromptCreationModal(
                { promptsDropdown: document.createElement('div') },
                {},
                {
                    id: input.id,
                    slug: input.slug,
                    name: input.label + ' default',
                    text: 'Original body with {{n}} token',
                    role: input.role,
                    replaceKey: 'n',
                    replaceValues: ['1', '2', '3', '5', '8'],
                },
                undefined,
                { requiredTokens: ['n'], roleLabel: input.label, role: input.role },
            );
        }, chipCase);

        await page.locator('textarea').fill('Updated body with {{n}} token from chip gear');
        await page.getByRole('button', { name: '💾 Update' }).click();
        await expect(page.locator('#marco-prompt-modal')).toHaveCount(0);

        const calls = await page.evaluate(() => (globalThis as typeof globalThis & { __calls: FakeMessageCall[] }).__calls);
        expect(calls.some((call) => call.type === 'SAVE_PROMPT')).toBe(false);

        const updateCalls = calls.filter((call) => call.type === 'PROJECT_API' && (call.sql ?? '').startsWith('UPDATE Prompt'));
        expect(updateCalls).toHaveLength(1);
        expect(updateCalls[0].sql).toContain('WHERE Id = ' + chipCase.id);
        expect(updateCalls[0].sql).toContain("Role = '" + chipCase.role + "'");
        expect(updateCalls[0].sql).toContain('Updated body with {{n}} token from chip gear');

        await page.context().close();
    });
    }
});