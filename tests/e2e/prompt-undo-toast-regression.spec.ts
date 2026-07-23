/**
 * prompt-undo-toast-regression.spec.ts
 *
 * Browser regression for the undo toast (v4.175.0). When an existing Plan or
 * Next prompt is edited via the chip gear, the successful Save path must:
 *   1. Fire the undo toast with the correct label.
 *   2. On "Undo" click, issue a second UPDATE Prompt call carrying the
 *      original body so the change is fully reversible without opening the
 *      history panel.
 *
 * The unit tests already lock the individual helpers; this spec proves the
 * plumbing survives the real bundle + real DOM click sequence.
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
    await page.goto('https://prompt-undo-toast-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

test.describe('undo toast round trip', () => {
    test('editing a Plan prompt fires the undo toast and Undo reverts via a second UPDATE Prompt', async () => {
        const page = await newHarnessPage();

        await page.evaluate(() => {
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
                    id: '7',
                    slug: 'plan-default',
                    name: 'Plan default',
                    text: 'Original body with {{n}} token',
                    role: 'plan',
                    replaceKey: 'n',
                    replaceValues: ['1', '2', '3', '5', '8'],
                },
                undefined,
                { requiredTokens: ['n'], roleLabel: 'Plan', role: 'plan' },
            );
        });

        await page.locator('textarea').fill('Rewritten body with {{n}} token from user edit');
        await page.getByRole('button', { name: '💾 Update' }).click();

        const undoToast = page.locator('[data-testid="undo-toast"]');
        await expect(undoToast).toBeVisible();
        await expect(undoToast).toContainText('Plan default');

        // First UPDATE = the user save.
        await expect.poll(async () => {
            const calls = await page.evaluate(() => (globalThis as typeof globalThis & { __calls: FakeMessageCall[] }).__calls);
            return calls.filter((c) => c.type === 'PROJECT_API' && (c.sql ?? '').startsWith('UPDATE Prompt')).length;
        }).toBe(1);

        await page.locator('[data-testid="undo-toast-action"]').click();

        // Second UPDATE = the undo. Must carry the original body.
        await expect.poll(async () => {
            const calls = await page.evaluate(() => (globalThis as typeof globalThis & { __calls: FakeMessageCall[] }).__calls);
            return calls.filter((c) => c.type === 'PROJECT_API' && (c.sql ?? '').startsWith('UPDATE Prompt')).length;
        }).toBe(2);

        const calls = await page.evaluate(() => (globalThis as typeof globalThis & { __calls: FakeMessageCall[] }).__calls);
        const updates = calls.filter((c) => c.type === 'PROJECT_API' && (c.sql ?? '').startsWith('UPDATE Prompt'));
        expect(updates[1].sql).toContain('Original body with {{n}} token');
        expect(updates[1].sql).toContain("Role = 'plan'");
        expect(calls.some((c) => c.type === 'SAVE_PROMPT')).toBe(false);

        await page.context().close();
    });
});
