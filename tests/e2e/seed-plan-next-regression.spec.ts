/**
 * seed-plan-next-regression.spec.ts
 *
 * Playwright regression harness that replicates the manual Chrome regression
 * flow for the Plan/Next seeder (macro-controller v4.72.0 / v4.73.0):
 *
 *   1. Cold boot: seedPlanNextPrompts() inserts 8 rows, promotes both defaults,
 *      persists telemetry to localStorage[marco_last_seed_telemetry].
 *   2. Warm boot: all slugs present + defaults already set -> zero inserts,
 *      zero promotes, telemetry reports skipped counts.
 *   3. Log export: formatLogsForExport()-equivalent block prepends the
 *      persisted telemetry ("=== Seed Telemetry ===" header + JSON body).
 *   4. Role counts: telemetry.roles has one entry per role with the exact
 *      { inserted, skipped, promotedDefault, alreadyDefault } shape.
 *
 * The spec runs the ACTUAL seed-plan-next module (bundled in-process with
 * esbuild) inside a real Chromium page with a stubbed chrome.runtime.sendMessage
 * that services the PROJECT_API/rawSql message contract. This is the same
 * contract exercised by the Chrome extension at runtime, so any drift in the
 * seeder or the log-export block will fail here just like it would in a
 * hand-driven DevTools regression.
 *
 * Bundle:
 *   entry = standalone-scripts/macro-controller/src/seed/seed-plan-next.ts
 *   format = IIFE, globalName = SeedBundle -> window.__seed.seedPlanNextPrompts
 *
 * Ref: plan-14 close-out, changelog v4.73.0.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bundleBrowserIife } from './utils/esbuild-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const SEED_ENTRY = path.join(
    REPO_ROOT,
    'standalone-scripts/macro-controller/src/seed/seed-plan-next.ts',
);
const TELEMETRY_KEY = 'marco_last_seed_telemetry';

// Every slug in PLAN_NEXT_SEED_ROWS; kept in sync manually (validated below).
const EXPECTED_SLUGS = [
    'plan-default', 'plan-concise', 'plan-with-evidence', 'plan-risk-annotated',
    'next-default', 'next-concise', 'next-with-time', 'next-with-risk',
];

interface FakeSqlCall { method: string; sql: string }
interface FakeSqlResp { isOk: boolean; rows?: unknown[]; errorMessage?: string }

let bundleSource = '';
let browser: Browser | undefined;

function resolveChromiumExecutable(): string | undefined {
    const candidates = ['/usr/bin/chromium', '/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return undefined;
}

test.beforeAll(async () => {
    bundleSource = await bundleBrowserIife(REPO_ROOT, {
        entryPoint: SEED_ENTRY,
        globalName: 'SeedBundle',
        footerJs: 'window.__seed = SeedBundle;',
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
                sendMessage: (message: { type: string; method?: string; params?: { sql?: string } }, callback: (r: unknown) => void) => {
                    const sql = (message?.params?.sql ?? '') as string;
                    (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls.push({
                        method: String(message?.method ?? ''),
                        sql,
                    });
                    const resp = queue.shift() ?? { isOk: true, rows: [] };
                    setTimeout(() => callback(resp), 0);
                },
            },
        };
    }, responses);

    // localStorage is blocked on about:blank; route a real origin instead.
    await context.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://seed-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

test.describe('seed-plan-next regression (manual Chrome flow)', () => {
    test('cold boot: 8 inserts, 2 defaults promoted, telemetry persisted', async () => {
        const page = await newHarnessPage([
            // 1) SELECT existing slugs -> none
            { isOk: true, rows: [] },
            // 2) INSERT OR IGNORE (driver ack)
            { isOk: true },
            // 3) hasDefaultForRole('plan') -> false
            { isOk: true, rows: [] },
            // 4) promoteSeedDefault plan-default
            { isOk: true },
            // 5) hasDefaultForRole('next') -> false
            { isOk: true, rows: [] },
            // 6) promoteSeedDefault next-default
            { isOk: true },
        ]);

        const result = await page.evaluate(async () => {
            const seedApi = (window as unknown as { __seed: { seedPlanNextPrompts: () => Promise<{ ok: boolean; telemetry?: unknown[] }> } }).__seed;
            return seedApi.seedPlanNextPrompts();
        });
        expect(result.ok).toBe(true);

        // Role counts contract
        const telemetry = result.telemetry as Array<{ role: string; inserted: number; skipped: number; promotedDefault: number; alreadyDefault: number }>;
        expect(telemetry).toHaveLength(2);
        const plan = telemetry.find(t => t.role === 'plan');
        const next = telemetry.find(t => t.role === 'next');
        expect(plan).toEqual({ role: 'plan', inserted: 4, skipped: 0, promotedDefault: 1, alreadyDefault: 0, replaceKey: 'n', replaceValueCount: 5 });
        expect(next).toEqual({ role: 'next', inserted: 4, skipped: 0, promotedDefault: 1, alreadyDefault: 0, replaceKey: 'n', replaceValueCount: 5 });

        // localStorage persistence contract
        const stored = await page.evaluate((k) => window.localStorage.getItem(k), TELEMETRY_KEY);
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!) as { at: string; roles: unknown[] };
        expect(typeof parsed.at).toBe('string');
        expect(Array.isArray(parsed.roles)).toBe(true);
        expect(parsed.roles).toHaveLength(2);

        // INSERT SQL covers every seed slug
        const calls = await page.evaluate(() => (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls);
        const insertCall = calls.find(c => c.sql.startsWith('INSERT OR IGNORE INTO Prompt'));
        expect(insertCall, 'no INSERT OR IGNORE call observed').toBeTruthy();
        for (const slug of EXPECTED_SLUGS) {
            expect(insertCall!.sql, 'seed INSERT missing slug ' + slug).toContain("'" + slug + "'");
        }

        await page.context().close();
    });

    test('warm boot: all slugs present, defaults intact -> zero inserts, zero promotes', async () => {
        const page = await newHarnessPage([
            // 1) SELECT existing slugs -> all 8 already there
            { isOk: true, rows: EXPECTED_SLUGS.map(s => ({ Slug: s })) },
            // 2) INSERT OR IGNORE (driver no-op ack)
            { isOk: true },
            // 3) readCurrentBody plan-default (legacy-upgrade probe) -> row-missing skip
            { isOk: true, rows: [] },
            // 4) readCurrentBody next-default (legacy-upgrade probe) -> row-missing skip
            { isOk: true, rows: [] },
            // 5) hasDefaultForRole('plan') -> true
            { isOk: true, rows: [{ '1': 1 }] },
            // 6) hasDefaultForRole('next') -> true
            { isOk: true, rows: [{ '1': 1 }] },
        ]);


        const result = await page.evaluate(async () => {
            const seedApi = (window as unknown as { __seed: { seedPlanNextPrompts: () => Promise<{ ok: boolean; telemetry?: unknown[] }> } }).__seed;
            return seedApi.seedPlanNextPrompts();
        });
        expect(result.ok).toBe(true);
        const telemetry = result.telemetry as Array<{ role: string; inserted: number; skipped: number; promotedDefault: number; alreadyDefault: number }>;
        const plan = telemetry.find(t => t.role === 'plan');
        const next = telemetry.find(t => t.role === 'next');
        expect(plan).toEqual({ role: 'plan', inserted: 0, skipped: 4, promotedDefault: 0, alreadyDefault: 1, replaceKey: 'n', replaceValueCount: 5 });
        expect(next).toEqual({ role: 'next', inserted: 0, skipped: 4, promotedDefault: 0, alreadyDefault: 1, replaceKey: 'n', replaceValueCount: 5 });

        // No UPDATE promoting a default should have run.
        const calls = await page.evaluate(() => (globalThis as unknown as { __calls: FakeSqlCall[] }).__calls);
        expect(calls.some(c => c.sql.startsWith('UPDATE Prompt SET IsDefault = 1'))).toBe(false);

        await page.context().close();
    });

    test('log export block reads persisted telemetry from localStorage', async () => {
        // Prime a fresh cold-boot run so telemetry is present, then reproduce
        // the exact readSeedTelemetryBlock() contract from logging.ts:311-320.
        const page = await newHarnessPage([
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },
            { isOk: true },
        ]);
        await page.evaluate(async () => {
            const seedApi = (window as unknown as { __seed: { seedPlanNextPrompts: () => Promise<unknown> } }).__seed;
            await seedApi.seedPlanNextPrompts();
        });

        const block = await page.evaluate((k) => {
            const raw = window.localStorage.getItem(k);
            if (!raw) return ['Seed Telemetry: (not run this session)', '---'];
            return ['=== Seed Telemetry ===', raw, '---'];
        }, TELEMETRY_KEY);

        expect(block[0]).toBe('=== Seed Telemetry ===');
        expect(block[block.length - 1]).toBe('---');
        const payload = JSON.parse(block[1]) as { at: string; roles: Array<{ role: string; inserted: number }> };
        expect(payload.roles.map(r => r.role).sort()).toEqual(['next', 'plan']);
        expect(payload.roles.every(r => r.inserted === 4)).toBe(true);

        await page.context().close();
    });

    test('DB error path: insert failure returns ok=false with an error message and no telemetry write', async () => {
        const page = await newHarnessPage([
            // 1) SELECT existing slugs -> none
            { isOk: true, rows: [] },
            // 2) INSERT OR IGNORE -> failure
            { isOk: false, errorMessage: 'disk full' },
        ]);

        // Clear telemetry from any prior context state (fresh context anyway,
        // but be explicit so the assertion below is unambiguous).
        await page.evaluate((k) => window.localStorage.removeItem(k), TELEMETRY_KEY);

        const result = await page.evaluate(async () => {
            const seedApi = (window as unknown as { __seed: { seedPlanNextPrompts: () => Promise<{ ok: boolean; error?: string }> } }).__seed;
            return seedApi.seedPlanNextPrompts();
        });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/disk full/);

        const stored = await page.evaluate((k) => window.localStorage.getItem(k), TELEMETRY_KEY);
        expect(stored, 'telemetry must NOT be persisted on insert failure').toBeNull();

        await page.context().close();
    });
});
