/**
 * Regression: the ☰ "More actions" button must be reachable via the stable
 * data-testid selector `marco-hamburger-menu`. Historically the button was
 * found by title alone, which collided with the new ⋯ overflow chip that
 * also carries the "More actions" title and triggered strict-mode locator
 * violations in E2E. Ensures the testid is exposed and clicking it opens
 * the hamburger dropdown menu.
 */
import { test, expect, chromium } from '@playwright/test';
import { launchExtension } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import { mountMacroControllerHarness } from './utils/macro-controller-harness';
import { KTLO_WORKSPACE, KTLO_CREDIT_BALANCE } from './fixtures/credit-balance/workspaces';

test.describe('More actions menu — stable data-testid selector', () => {
    test('opens the hamburger menu via getByTestId', async () => {
        const context = await launchExtension(chromium);
        try {
            await installCreditBalanceStub(context, {
                workspaces: [KTLO_WORKSPACE],
                creditBalances: { [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE },
            });

            const { page, bundleError } = await mountMacroControllerHarness(context, {
                projectId: 'more-actions-selector-e2e',
            });
            expect(bundleError, `macro-controller bundle threw on inject: ${bundleError?.message}`).toBeNull();

            const menuButton = page.getByTestId('marco-hamburger-menu');
            await expect(menuButton).toHaveCount(1);
            await expect(menuButton).toBeVisible();

            await menuButton.click();
            // The Credit Totals entry lives only in the hamburger dropdown,
            // so its visibility confirms the menu actually opened.
            await expect(page.getByText('Credit Totals')).toBeVisible();
        } finally {
            await context.close();
        }
    });
});
