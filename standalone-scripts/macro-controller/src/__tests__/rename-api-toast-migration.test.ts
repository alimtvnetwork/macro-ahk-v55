/**
 * Plan 22 · gap #7 follow-up: remaining `rename-api` toast sites migrated to
 * `showDiagnosticToast`.
 *
 * Locks the fixed contract for the three surviving raw-showToast callsites:
 *   F1. `handleCreditLimitFallback` (403 with monthly-limit field) fires
 *       exactly one `showDiagnosticToast` carrying `RENAME_CREDIT_LIMIT_FALLBACK_E001`
 *       with { wsId, status, bodyPreview } and forwards `requestDetail`.
 *   A1. `handleRenameAuthRecovery` (401 recovery notice) fires exactly one
 *       `showDiagnosticToast` carrying `RENAME_AUTH_RECOVERY_E001` with { wsId }.
 *   E1. `handleRenameError` (generic HTTP failure) builds a single
 *       `DiagnosticError('RENAME_REQUEST_E001', {url,status,wsId})`, surfaces
 *       it via `showDiagnosticToast`, and the caller throws the SAME instance
 *       (no double-emit, no drift between toast copy and thrown message).
 *
 * A regression that reintroduces a raw `showToast(...)` string in any of
 * these paths will fail these assertions because the sink mock will not be
 * called, and/or the thrown error will not match the toast argument.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showDiagnosticToastMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const resolveTokenMock = vi.hoisted(() => vi.fn());
const recoverAuthOnceMock = vi.hoisted(() => vi.fn());
const invalidateSessionBridgeKeyMock = vi.hoisted(() => vi.fn().mockReturnValue('sb-key'));
const workspaceRenameMock = vi.hoisted(() => vi.fn());

vi.mock('../errors/show-diagnostic-toast', () => ({
    showDiagnosticToast: showDiagnosticToastMock,
}));
vi.mock('../error-utils', () => ({
    logError: logErrorMock,
    reportDiagnostic: vi.fn().mockReturnValue({
        toast: { severity: 'error', title: '', body: '', footerCode: '' },
    }),
}));
vi.mock('../toast', () => ({ showToast: vi.fn() }));
vi.mock('../auth', () => ({
    resolveToken: resolveTokenMock,
    recoverAuthOnce: recoverAuthOnceMock,
    invalidateSessionBridgeKey: invalidateSessionBridgeKeyMock,
}));
vi.mock('../logging', () => ({ log: vi.fn(), logSub: vi.fn() }));
vi.mock('../rename-forbidden-cache', () => ({
    hasForbidden: () => false,
    addForbidden: vi.fn(),
    removeForbidden: vi.fn(),
}));
vi.mock('../rename-auth-recovery-flag', () => ({
    getAuthRecoveryExhausted: () => false,
    setAuthRecoveryExhausted: vi.fn(),
}));
vi.mock('../async-utils', () => ({ delay: vi.fn().mockResolvedValue(undefined) }));

import { DiagnosticError } from '../errors/diagnostic-error';
import { renameWorkspace } from '../rename-api';

beforeEach(() => {
    showDiagnosticToastMock.mockReset();
    logErrorMock.mockReset();
    resolveTokenMock.mockReset();
    resolveTokenMock.mockReturnValue('tok-abcdef123456');
    recoverAuthOnceMock.mockReset();
    workspaceRenameMock.mockReset();

    // Wire the marco SDK bridge that rename-api awaits.
    (globalThis as unknown as { window: { marco: unknown } }).window = {
        ...(globalThis as unknown as { window?: object }).window,
        marco: {
            api: {
                workspace: { rename: workspaceRenameMock },
            },
        },
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('rename-api remaining toast migrations', () => {
    it('F1: 403 credit-limit fallback path emits RENAME_CREDIT_LIMIT_FALLBACK_E001 via showDiagnosticToast', async () => {
        // First call → 403 (triggers fallback + retry), second → 200 OK success.
        workspaceRenameMock
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                data: { error: 'monthly limit field forbidden' },
                headers: {},
            })
            .mockResolvedValueOnce({ ok: true, status: 200, data: {}, headers: {} });

        await expect(renameWorkspace('ws-403', 'renamed')).resolves.toBe('no-limit');

        expect(showDiagnosticToastMock).toHaveBeenCalledTimes(1);
        const [errArg, optsArg] = showDiagnosticToastMock.mock.calls[0];
        expect(errArg).toBeInstanceOf(DiagnosticError);
        expect((errArg as DiagnosticError).code).toBe('RENAME_CREDIT_LIMIT_FALLBACK_E001');
        const context = (errArg as DiagnosticError).context as {
            wsId: string; status: number; bodyPreview: string;
        };
        expect(context.wsId).toBe('ws-403');
        expect(context.status).toBe(403);
        expect(context.bodyPreview).toContain('monthly limit field forbidden');
        expect(optsArg.requestDetail.method).toBe('PUT');
        expect(optsArg.requestDetail.url).toBe('/user/workspaces/ws-403');
        expect(optsArg.requestDetail.status).toBe(403);
    });

    it('A1: 401 auth-recovery path emits RENAME_AUTH_RECOVERY_E001 via showDiagnosticToast', async () => {
        recoverAuthOnceMock.mockResolvedValue('tok-new-recovered');
        workspaceRenameMock
            .mockResolvedValueOnce({ ok: false, status: 401, data: {}, headers: {} })
            .mockResolvedValueOnce({ ok: true, status: 200, data: {}, headers: {} });

        await expect(renameWorkspace('ws-401', 'renamed')).resolves.toBe('auth-retry');

        expect(showDiagnosticToastMock).toHaveBeenCalledTimes(1);
        const [errArg, optsArg] = showDiagnosticToastMock.mock.calls[0];
        expect(errArg).toBeInstanceOf(DiagnosticError);
        expect((errArg as DiagnosticError).code).toBe('RENAME_AUTH_RECOVERY_E001');
        expect((errArg as DiagnosticError).context).toEqual({ wsId: 'ws-401' });
        expect(optsArg.requestDetail).toEqual({
            method: 'PUT',
            url: '/user/workspaces/ws-401',
            status: 401,
        });
    });

    it('E1: generic HTTP failure surfaces RENAME_REQUEST_E001 once and throws the SAME DiagnosticError instance', async () => {
        workspaceRenameMock.mockResolvedValueOnce({
            ok: false,
            status: 500,
            data: { message: 'boom' },
            headers: {},
        });

        let thrown: unknown;
        try {
            await renameWorkspace('ws-500', 'renamed');
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(DiagnosticError);
        expect((thrown as DiagnosticError).code).toBe('RENAME_REQUEST_E001');

        // Exactly one structured toast, and it is the same DiagnosticError instance
        // that was thrown — no drift between toast copy and thrown error.
        expect(showDiagnosticToastMock).toHaveBeenCalledTimes(1);
        const [errArg, optsArg] = showDiagnosticToastMock.mock.calls[0];
        expect(errArg).toBe(thrown);
        expect((errArg as DiagnosticError).context).toEqual({
            url: '/user/workspaces/ws-500',
            status: 500,
            wsId: 'ws-500',
        });
        expect(optsArg.requestDetail.status).toBe(500);
        expect(optsArg.requestDetail.responseBody).toContain('boom');

        // The logError('Rename', ...) diagnostic sink is preserved.
        expect(logErrorMock).toHaveBeenCalledWith(
            'Rename',
            expect.stringContaining('HTTP 500'),
        );
    });
});
