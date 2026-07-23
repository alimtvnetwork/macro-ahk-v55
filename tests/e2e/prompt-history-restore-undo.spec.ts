/**
 * prompt-history-restore-undo.spec.ts
 *
 * Browser regression for the Restore -> Undo round-trip surfaced through the
 * Prompt History panel (v4.185.0+ Undo affordance).
 *
 * Flow:
 *   1. Open the panel with 2 native revisions + 3 imported revisions so the
 *      list shows 5 rows and 3 `imported` badges.
 *   2. Click "Restore this version" on the first row. The stubbed
 *      `confirmFn` auto-approves, `listByRole` returns a live row so the
 *      update-path (not insert-path) is exercised, and `upsert` succeeds.
 *   3. Assert the real `showUndoToast` renders with the expected id chip and
 *      an "Undo restore" action button.
 *   4. Click the Undo button. Verify the revert `upsert` call was issued
 *      with the original (pre-restore) body, and that reopening the panel
 *      shows the same row count (5) and the same 3 imported badges as
 *      before the restore. The prior state is preserved.
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
        interface RuntimeMessage { type?: string; method?: string; params?: { sql?: string } }
        interface RuntimeResponse { isOk: boolean; rows?: Array<Record<string, unknown>>; lastInsertId?: number }
        const calls: Array<{ type: string; method?: string; sql?: string }> = [];
        (globalThis as typeof globalThis & { __calls: typeof calls }).__calls = calls;
        (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
            runtime: {
                lastError: null,
                sendMessage: (message: RuntimeMessage, callback: (response: RuntimeResponse) => void) => {
                    const sql = message.params?.sql ?? '';
                    calls.push({ type: String(message.type ?? ''), method: message.method, sql });
                    setTimeout(() => callback({ isOk: true, rows: [], lastInsertId: 999 }), 0);
                },
            },
        };
    });

    await page.route('**/*', (route) => {
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto('https://prompt-history-restore-undo-harness.test/');
    await page.addScriptTag({ content: bundleSource });
    return page;
}

test.describe('prompt history restore undo round-trip', () => {
    test('Restore then Undo returns list to prior row count and imported badges', async () => {
        const page = await newHarnessPage();

        await page.evaluate(async ({ slug, role }) => {
            interface RevRow {
                Id: number; PromptId: number; Slug: string; Name: string; Body: string;
                Role: string; ReplaceKey: string; ReplaceValues: string; CreatedAt: number; Reason: string;
            }
            interface DbOk<T> { ok: boolean; value?: T; error?: string }

            const revisions: RevRow[] = [
                { Id: 92, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'v2 body', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_100_000, Reason: 'upsert' },
                { Id: 91, PromptId: 7, Slug: slug, Name: 'Plan default', Body: 'v1 body', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_000_000, Reason: 'upsert' },
                { Id: 103, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported C', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_400_000, Reason: 'import' },
                { Id: 102, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported B', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_300_000, Reason: 'import' },
                { Id: 101, PromptId: 0, Slug: slug, Name: 'Plan default', Body: 'imported A', Role: role, ReplaceKey: 'n', ReplaceValues: '["1","2","3"]', CreatedAt: 1_700_000_200_000, Reason: 'import' },
            ];

            interface UpsertArgs {
                id?: number; slug: string; name: string; body: string; role: string;
                replaceKey: string; replaceValues: string[];
                previousBody?: string; previousReplaceKey?: string;
            }
            const state = {
                upsertCalls: [] as UpsertArgs[],
                currentBody: 'live body BEFORE restore',
                currentReplaceKey: 'n',
                currentReplaceValues: ['1', '2', '3'] as string[],
                currentId: 7,
            };
            (window as unknown as { __state: typeof state }).__state = state;

            const listRevisions = async (): Promise<DbOk<RevRow[]>> => ({ ok: true, value: revisions.slice() });
            const listByRole = async (): Promise<DbOk<Array<Record<string, unknown>>>> => ({
                ok: true,
                value: [{
                    Id: state.currentId,
                    Slug: slug,
                    Name: 'Plan default',
                    Body: state.currentBody,
                    Role: role,
                    ReplaceKey: state.currentReplaceKey,
                    ReplaceValues: state.currentReplaceValues.slice(),
                }],
            });
            const upsert = async (args: UpsertArgs): Promise<DbOk<number>> => {
                state.upsertCalls.push(args);
                state.currentBody = args.body;
                state.currentReplaceKey = args.replaceKey;
                state.currentReplaceValues = args.replaceValues.slice();
                return { ok: true, value: args.id ?? state.currentId };
            };
            const confirmFn = (): boolean => true;

            (window as unknown as { __deps: unknown }).__deps = {
                listRevisions,
                listByRole,
                upsert,
                confirmFn,
                // Deliberately do NOT stub `undoToast` so the real
                // showUndoToast renders and we can click the DOM button.
            };

            interface HistoryApi {
                openPromptHistoryPanel: (
                    input: { role: string; slug: string },
                    deps: unknown,
                ) => Promise<void>;
            }
            const api = (window as unknown as { __promptHistoryPanel: HistoryApi }).__promptHistoryPanel;
            await api.openPromptHistoryPanel({ role, slug }, (window as unknown as { __deps: unknown }).__deps);
        }, { slug: SLUG, role: ROLE });

        const panel = page.locator('#marco-prompt-history-panel');

        // Prior state: capture row count + imported badge count.
        const rowsBefore = await panel.locator('[data-role="revision-row"]').count();
        const badgesBefore = await panel.locator('[data-role="imported-badge"]').count();
        expect(rowsBefore).toBe(5);
        expect(badgesBefore).toBe(3);

        // Click Restore on the row for revision Id=92 ("v2 body"). Selecting
        // an explicit row keeps the assertion stable regardless of default
        // sort order (newest CreatedAt first).
        await panel.locator('[data-role="revision-row"][data-revision-id="92"]')
            .locator('button[data-action="restore-revision"]').click();

        // Undo toast is present with the id chip and Undo button.
        const undoToast = page.locator('[data-testid="undo-toast"]');
        await expect(undoToast).toBeVisible();
        await expect(undoToast.locator('[data-testid="undo-toast-restored-id"]')).toHaveText('#7');
        const undoBtn = undoToast.locator('[data-testid="undo-toast-action"]');
        await expect(undoBtn).toHaveText('Undo restore');

        // Restore issued exactly one upsert with the revision body.
        await expect.poll(async () =>
            page.evaluate(() => (window as unknown as {
                __state: { upsertCalls: Array<{ body: string }> };
            }).__state.upsertCalls.length),
        ).toBe(1);
        const afterRestore = await page.evaluate(() => (window as unknown as {
            __state: { upsertCalls: Array<{ body: string }>; currentBody: string };
        }).__state);
        expect(afterRestore.upsertCalls[0]?.body).toBe('v2 body');
        expect(afterRestore.currentBody).toBe('v2 body');

        // Click Undo. The onUndo wires a revert upsert back to the pre-image.
        await undoBtn.click();

        await expect.poll(async () =>
            page.evaluate(() => (window as unknown as {
                __state: { upsertCalls: Array<unknown> };
            }).__state.upsertCalls.length),
        ).toBe(2);
        const afterUndo = await page.evaluate(() => (window as unknown as {
            __state: { upsertCalls: Array<{ body: string }>; currentBody: string };
        }).__state);
        expect(afterUndo.upsertCalls[1]?.body).toBe('live body BEFORE restore');
        expect(afterUndo.currentBody).toBe('live body BEFORE restore');

        // Reopen the panel and confirm prior state is preserved.
        await page.evaluate(async ({ slug, role }) => {
            interface HistoryApi {
                openPromptHistoryPanel: (input: { role: string; slug: string }, deps: unknown) => Promise<void>;
            }
            const api = (window as unknown as { __promptHistoryPanel: HistoryApi }).__promptHistoryPanel;
            await api.openPromptHistoryPanel({ role, slug }, (window as unknown as { __deps: unknown }).__deps);
        }, { slug: SLUG, role: ROLE });

        const panelAfter = page.locator('#marco-prompt-history-panel');
        await expect(panelAfter.locator('[data-role="revision-row"]')).toHaveCount(rowsBefore);
        await expect(panelAfter.locator('[data-role="imported-badge"]')).toHaveCount(badgesBefore);

        await page.context().close();
    });
});
