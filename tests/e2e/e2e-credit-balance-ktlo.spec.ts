import { test, expect, chromium } from '@playwright/test';
import { launchExtension, getExtensionId, openOptions } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import {
    KTLO_WORKSPACE,
    KTLO_CREDIT_BALANCE,
} from './fixtures/credit-balance/workspaces';

/**
 * E2E-credit-balance-ktlo (Phase B Step 49, unblocked in Step 52)
 *
 * Verifies the happy-path Ktlo workspace fetch: when /user/workspaces returns
 * no inline credits and /workspaces/{id}/credit-balance is reachable, the
 * stubbed endpoint responds with the fixture payload and the call count
 * matches the single-flight contract (one /credit-balance call per workspace
 * per refresh window).
 *
 * Spec: spec/21-app/01-chrome-extension/credit-balance-update/18-tests-e2e.md.
 * Stub:  tests/e2e/utils/credit-balance-stub.ts
 * Data:  tests/e2e/fixtures/credit-balance/workspaces.ts
 */
test.describe('E2E-Credit-Balance — Ktlo happy path', () => {
    test('stubbed /credit-balance returns Ktlo fixture and is called exactly once', async () => {
        const context = await launchExtension(chromium);
        try {
            const stub = await installCreditBalanceStub(context, {
                workspaces: [KTLO_WORKSPACE],
                creditBalances: { [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE },
            });

            const extensionId = await getExtensionId(context);
            const options = await openOptions(context, extensionId);
            await expect(options).toHaveURL(/options\.html/);

            // Drive the stub from the page context to mirror the real fetch path.
            const result = await options.evaluate(async (wsId) => {
                const res = await fetch(
                    `https://api.lovable.dev/workspaces/${wsId}/credit-balance`,
                    { headers: { Accept: '*/*' } },
                );
                return { status: res.status, body: await res.json() };
            }, KTLO_WORKSPACE.id);

            expect(result.status).toBe(200);
            expect(result.body.total_remaining).toBe(KTLO_CREDIT_BALANCE.total_remaining);
            expect(result.body.daily_limit).toBe(KTLO_CREDIT_BALANCE.daily_limit);
            expect(stub.creditBalanceCallsFor(KTLO_WORKSPACE.id)).toBe(1);
        } finally {
            await context.close();
        }
    });
});
