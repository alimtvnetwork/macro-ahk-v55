/**
 * Playwright network stub for the credit-balance flow (Phase B Step 52).
 *
 * Installs `context.route()` handlers for:
 *   - GET https://api.lovable.dev/user/workspaces
 *   - GET https://api.lovable.dev/workspaces/{id}/credit-balance
 *
 * Tracks per-URL call counts so specs can assert the no-fetch-when-inline
 * contract from `spec/21-app/01-chrome-extension/credit-balance-update/02-trigger-logic.md`.
 *
 * Used by the four credit-balance E2E specs unblocked in Step 52:
 *   - e2e-credit-balance-ktlo.spec.ts
 *   - e2e-credit-balance-timeout.spec.ts
 *   - e2e-credit-balance-no-fetch-when-inline.spec.ts
 *   - e2e-credit-totals-modal.spec.ts
 */
import type { BrowserContext, Route } from '@playwright/test';
import type { WireWorkspace, WireCreditBalance } from '../fixtures/credit-balance/workspaces';

export interface CreditStubOptions {
    /** Workspaces returned by GET /user/workspaces. */
    workspaces: ReadonlyArray<WireWorkspace>;
    /** Per-workspace /credit-balance payloads (omit for 404). */
    creditBalances?: Readonly<Record<string, WireCreditBalance>>;
    /** Artificial delay (ms) on /credit-balance responses — for timeout tests. */
    creditBalanceDelayMs?: number;
    /** Force HTTP status on /credit-balance (defaults to 200, or 404 if missing). */
    creditBalanceStatus?: number;
}

export interface CreditStubHandle {
    /** Total intercepted calls keyed by URL pattern. */
    readonly counts: Readonly<{
        userWorkspaces: number;
        creditBalanceByWorkspaceId: ReadonlyMap<string, number>;
        creditBalanceTotal: number;
    }>;
    /** Per-workspace call count (0 if never hit). */
    creditBalanceCallsFor(workspaceId: string): number;
    /** Tear down all routes registered by this stub. */
    teardown(): Promise<void>;
}

const API_HOST = 'https://api.lovable.dev';
const USER_WORKSPACES_PATTERN = `${API_HOST}/user/workspaces`;
const CREDIT_BALANCE_PATTERN = new RegExp(
    '^https://api\\.lovable\\.dev/workspaces/([^/]+)/credit-balance(?:\\?.*)?$',
);

export async function installCreditBalanceStub(
    context: BrowserContext,
    options: CreditStubOptions,
): Promise<CreditStubHandle> {
    let userWorkspacesCount = 0;
    const creditBalanceCounts = new Map<string, number>();

    const userWorkspacesHandler = async (route: Route): Promise<void> => {
        userWorkspacesCount += 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ workspaces: options.workspaces }),
        });
    };

    const creditBalanceHandler = async (route: Route): Promise<void> => {
        const url = route.request().url();
        const match = CREDIT_BALANCE_PATTERN.exec(url);
        const workspaceId = match?.[1] ?? '<unknown>';
        creditBalanceCounts.set(workspaceId, (creditBalanceCounts.get(workspaceId) ?? 0) + 1);

        if (options.creditBalanceDelayMs && options.creditBalanceDelayMs > 0) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, options.creditBalanceDelayMs);
            });
        }

        const payload = options.creditBalances?.[workspaceId];
        const status = options.creditBalanceStatus ?? (payload ? 200 : 404);
        if (status !== 200 || !payload) {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({ error: `No fixture for workspace ${workspaceId}` }),
            });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(payload),
        });
    };

    await context.route(USER_WORKSPACES_PATTERN, userWorkspacesHandler);
    await context.route(CREDIT_BALANCE_PATTERN, creditBalanceHandler);

    return {
        get counts() {
            let total = 0;
            for (const count of creditBalanceCounts.values()) total += count;
            return {
                userWorkspaces: userWorkspacesCount,
                creditBalanceByWorkspaceId: new Map(creditBalanceCounts),
                creditBalanceTotal: total,
            };
        },
        creditBalanceCallsFor(workspaceId: string): number {
            return creditBalanceCounts.get(workspaceId) ?? 0;
        },
        async teardown(): Promise<void> {
            await context.unroute(USER_WORKSPACES_PATTERN, userWorkspacesHandler);
            await context.unroute(CREDIT_BALANCE_PATTERN, creditBalanceHandler);
        },
    };
}
