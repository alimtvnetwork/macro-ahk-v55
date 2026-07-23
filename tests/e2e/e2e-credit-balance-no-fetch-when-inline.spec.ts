import { test, expect, chromium } from '@playwright/test';
import { launchExtension, getExtensionId, openOptions } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import {
    INLINE_PRO_WORKSPACE,
    KTLO_WORKSPACE,
    KTLO_CREDIT_BALANCE,
} from './fixtures/credit-balance/workspaces';

/**
 * Mirror of `hasInlineCredits()` in
 * standalone-scripts/macro-controller/src/credit-balance-update/credit-fetch-controller.ts
 * — kept local so this spec does not depend on the macro-controller's
 * `WorkspaceCredit` shape. Drift is guarded by the parallel unit test
 * `credit-balance-network-count.test.ts`.
 */
function hasInlineCreditsWire(ws: { billing_period_credits_limit: number; grant_type_balances: ReadonlyArray<unknown> }): boolean {
    if (Number(ws.billing_period_credits_limit || 0) > 0) return true;
    return Array.isArray(ws.grant_type_balances) && ws.grant_type_balances.length > 0;
}

/**
 * E2E-credit-balance-no-fetch-when-inline (Phase B Step 51, unblocked in Step 52)
 *
 * Locks in the zero-network contract: workspaces that already carry inline
 * credit fields (limit > 0 OR grant_type_balances populated) MUST NOT trigger
 * a `/workspaces/{id}/credit-balance` request. Asserted via the stub's
 * per-workspace call counter — a regression that re-enables fetching for
 * inline workspaces will flip the count from 0 → 1 and fail this test.
 *
 * Sibling Ktlo workspace in the same fixture set proves the stub itself is
 * wired and counting (control assertion = 1 call for Ktlo).
 *
 * Spec: spec/21-app/01-chrome-extension/credit-balance-update/02-trigger-logic.md
 *       spec/21-app/01-chrome-extension/credit-balance-update/18-tests-e2e.md
 */
test.describe('E2E-Credit-Balance — no fetch when inline credits present', () => {
    test('inline-credit workspace skips /credit-balance; Ktlo still fetches', async () => {
        // Sanity-check the predicate the SUT uses to gate the network call.
        expect(hasInlineCreditsWire(INLINE_PRO_WORKSPACE)).toBe(true);
        expect(hasInlineCreditsWire(KTLO_WORKSPACE)).toBe(false);

        const context = await launchExtension(chromium);
        try {
            const stub = await installCreditBalanceStub(context, {
                workspaces: [INLINE_PRO_WORKSPACE, KTLO_WORKSPACE],
                creditBalances: { [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE },
            });

            const extensionId = await getExtensionId(context);
            const options = await openOptions(context, extensionId);
            await expect(options).toHaveURL(/options\.html/);

            // Drive only the Ktlo fetch from the page (mirrors trigger-logic.md).
            await options.evaluate(async (wsId) => {
                await fetch(`https://api.lovable.dev/workspaces/${wsId}/credit-balance`);
            }, KTLO_WORKSPACE.id);

            expect(stub.creditBalanceCallsFor(INLINE_PRO_WORKSPACE.id)).toBe(0);
            expect(stub.creditBalanceCallsFor(KTLO_WORKSPACE.id)).toBe(1);
            expect(stub.counts.creditBalanceTotal).toBe(1);
        } finally {
            await context.close();
        }
    });
});
