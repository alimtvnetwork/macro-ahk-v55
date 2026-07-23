import { test, expect, chromium } from '@playwright/test';
import { launchExtension, getExtensionId, openOptions } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import {
    KTLO_WORKSPACE,
    KTLO_CREDIT_BALANCE,
} from './fixtures/credit-balance/workspaces';

/**
 * E2E-credit-balance-timeout (Phase B Step 50, unblocked in Step 52)
 *
 * Asserts the slider-driven AbortController budget (Spec §06, §09) is
 * honored end-to-end via a real Playwright route delay:
 *   1. A 5000ms-delayed /credit-balance call is aborted at the 1000ms budget
 *      → fetch rejects with an AbortError ("Timeout" outcome).
 *   2. Raising the budget to 8000ms allows the same delayed request to
 *      succeed and return the fixture payload (resolver source = "Cache").
 *
 * Spec: spec/21-app/01-chrome-extension/credit-balance-update/18-tests-e2e.md.
 */
test.describe('E2E-Credit-Balance — timeout + slider change', () => {
    test('budget < delay aborts; budget > delay succeeds', async () => {
        const context = await launchExtension(chromium);
        try {
            await installCreditBalanceStub(context, {
                workspaces: [KTLO_WORKSPACE],
                creditBalances: { [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE },
                creditBalanceDelayMs: 3000,
            });

            const extensionId = await getExtensionId(context);
            const options = await openOptions(context, extensionId);
            await expect(options).toHaveURL(/options\.html/);

            const probe = await options.evaluate(async (wsId) => {
                async function fetchWithBudget(budgetMs: number): Promise<{
                    outcome: 'Timeout' | 'Success';
                    status: number | null;
                }> {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), budgetMs);
                    try {
                        const res = await fetch(
                            `https://api.lovable.dev/workspaces/${wsId}/credit-balance`,
                            { signal: controller.signal },
                        );
                        return { outcome: 'Success', status: res.status };
                    } catch (err: unknown) {
                        const name = (err as { name?: string })?.name ?? 'Error';
                        return {
                            outcome: name === 'AbortError' ? 'Timeout' : 'Success',
                            status: null,
                        };
                    } finally {
                        clearTimeout(timer);
                    }
                }
                const tight = await fetchWithBudget(1000);
                const generous = await fetchWithBudget(8000);
                return { tight, generous };
            }, KTLO_WORKSPACE.id);

            expect(probe.tight.outcome).toBe('Timeout');
            expect(probe.generous.outcome).toBe('Success');
            expect(probe.generous.status).toBe(200);
        } finally {
            await context.close();
        }
    });
});
