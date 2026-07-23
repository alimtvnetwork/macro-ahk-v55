/**
 * repeat-more-popover.spec.ts — Plan-23 close-out.
 *
 * Real Chromium regression for Issue 06: the repeat "More ▾" overflow
 * popover renders the tail presets (60..200), opens on trigger click,
 * closes on outside click and Escape, and keeps `aria-expanded` in sync.
 *
 * Bundles the ACTUAL `repeat-loop-ui.ts` module (via `bundleBrowserIife`)
 * so any drift in `buildCountPresets` / `buildMorePresetsPopover` /
 * `PRESET_INLINE_MAX` surfaces here — not just in jsdom unit tests.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bundleBrowserIife } from './utils/esbuild-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const ENTRY = path.join(
    REPO_ROOT,
    'standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts',
);

let bundleSource = '';
let browser: Browser | undefined;

function resolveChromiumExecutable(): string | undefined {
    const candidates = ['/usr/bin/chromium', '/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return undefined;
}

test.beforeAll(async () => {
    bundleSource = await bundleBrowserIife(REPO_ROOT, {
        entryPoint: ENTRY,
        globalName: 'RepeatUi',
        footerJs: 'window.__repeatUi = RepeatUi;',
    });
    browser = await chromium.launch({
        headless: true,
        executablePath: resolveChromiumExecutable(),
    });
});

test.afterAll(async () => {
    if (browser) await browser.close();
});

async function newPage(): Promise<Page> {
    if (!browser) throw new Error('browser not initialized');
    const context = await browser.newContext();
    const page = await context.newPage();

    // Stub chrome.runtime so module init that touches it (if any) is inert.
    await page.addInitScript(() => {
        (globalThis as unknown as { chrome: unknown }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (_msg: unknown, callback: (r: unknown) => void) => {
                    setTimeout(() => callback({ isOk: true, rows: [] }), 0);
                },
            },
        };
    });
    await context.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="host"></div></body></html>' });
    });
    await page.goto('https://repeat-harness.test/');
    await page.addScriptTag({ content: bundleSource });

    // Mount the preset row into #host.
    await page.evaluate(() => {
        const api = (window as unknown as {
            __repeatUi: { buildCountPresets: () => DocumentFragment };
        }).__repeatUi;
        const host = document.getElementById('host');
        if (!host) throw new Error('host missing');
        host.appendChild(api.buildCountPresets());
    });
    return page;
}

async function newClippedPage(): Promise<Page> {
    const page = await newPage();
    await page.evaluate(() => {
        const host = document.getElementById('host');
        if (!host) throw new Error('host missing');
        host.style.cssText = 'width:520px;height:30px;overflow:hidden;position:relative;padding:0;';
    });
    return page;
}

async function isPanelHitTestable(page: Page): Promise<boolean> {
    return page.locator('[data-testid="repeat-more-popover"]').evaluate((panel) => {
        const rect = panel.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + 8, rect.top + 8);
        return target instanceof Node && panel.contains(target);
    });
}

test.describe('repeat "More ▾" overflow popover (Issue 06)', () => {
    test('inline chips stop at PRESET_INLINE_MAX and overflow lives in the popover', async () => {
        const page = await newPage();

        const inlineCounts = await page.$$eval(
            '#host > button[data-repeat-preset]',
            (btns) => btns.map((b) => Number(b.getAttribute('data-repeat-preset'))),
        );
        expect(inlineCounts).toEqual([1, 2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 30, 50]);

        const pop = page.locator('[data-testid="repeat-more-popover"]');
        await expect(pop).toBeHidden();

        const trigger = page.locator('[data-testid="repeat-more-trigger"]');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await trigger.click();
        await expect(pop).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        const overflowCounts = await pop.locator('button[data-repeat-preset]').evaluateAll(
            (btns) => btns.map((b) => Number(b.getAttribute('data-repeat-preset'))),
        );
        expect(overflowCounts).toEqual([60, 70, 75, 80, 100, 200]);

        await page.context().close();
    });

    test('Escape closes the popover and resets aria-expanded', async () => {
        const page = await newPage();
        const trigger = page.locator('[data-testid="repeat-more-trigger"]');
        const pop = page.locator('[data-testid="repeat-more-popover"]');

        await trigger.click();
        await expect(pop).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(pop).toBeHidden();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await page.context().close();
    });

    test('outside click closes the popover', async () => {
        const page = await newPage();
        const trigger = page.locator('[data-testid="repeat-more-trigger"]');
        const pop = page.locator('[data-testid="repeat-more-popover"]');

        await trigger.click();
        await expect(pop).toBeVisible();

        // Click on <body> outside the popover wrapper.
        await page.mouse.click(2, 2);
        await expect(pop).toBeHidden();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await page.context().close();
    });

    test('popover escapes clipped repeat row overflow', async () => {
        const page = await newClippedPage();
        const trigger = page.locator('[data-testid="repeat-more-trigger"]');
        const pop = page.locator('[data-testid="repeat-more-popover"]');

        await trigger.click();
        await expect(pop).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(await isPanelHitTestable(page)).toBe(true);

        await page.context().close();
    });
});
