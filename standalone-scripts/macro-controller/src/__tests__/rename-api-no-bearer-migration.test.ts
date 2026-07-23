/**
 * Plan 22 · gap #7 follow-up: `rename-api.rejectNoBearerToken` migration to
 * the `showDiagnosticToast` single-sink pipeline.
 *
 * Root cause of the design under test: pre-migration, `rejectNoBearerToken`
 * emitted a hand-crafted `showToast('No bearer token…', 'error', opts)` string
 * AND returned a `DiagnosticError('RENAME_NO_BEARER_E001', {wsId})`. Two
 * sources of truth: any drift between the toast copy and the registry entry
 * (severity, human template, next-fix hint, code footer) would surface a
 * different message to the user than the one recorded to the diagnostics log.
 *
 * These tests lock the fixed contract:
 *   R1. `showDiagnosticToast` is called exactly once with the returned
 *       `DiagnosticError` — the toast IS the diagnostic, not a copy.
 *   R2. The forwarded `opts` still include `noStop: true` and a
 *       `requestDetail` describing the blocked PUT (so the persistent-toast
 *       + HTTP-detail UI does not regress).
 *   R3. The returned Error is a `DiagnosticError` carrying `RENAME_NO_BEARER_E001`
 *       and `context.wsId`.
 *   R4. `logError('Rename', ...)` still fires with the wsId so plain log
 *       consumers keep working.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showDiagnosticToastMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const resolveTokenMock = vi.hoisted(() => vi.fn());

vi.mock('../errors/show-diagnostic-toast', () => ({
    showDiagnosticToast: showDiagnosticToastMock,
}));
vi.mock('../error-utils', () => ({
    logError: logErrorMock,
    reportDiagnostic: vi.fn().mockReturnValue({ toast: { severity: 'error', title: '', body: '', footerCode: '' } }),
}));
vi.mock('../toast', () => ({
    showToast: vi.fn(),
}));
vi.mock('../auth', () => ({
    resolveToken: resolveTokenMock,
    recoverAuthOnce: vi.fn(),
    invalidateSessionBridgeKey: vi.fn(),
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
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('rename-api.rejectNoBearerToken — showDiagnosticToast migration', () => {
    it('R1+R2+R3+R4: no-bearer path emits DiagnosticError via showDiagnosticToast with noStop+requestDetail, and logs via logError', async () => {
        // Force the no-bearer branch: resolveToken() returns '' so executeRename
        // hits `throw rejectNoBearerToken(wsId)` on its first line.
        resolveTokenMock.mockReturnValue('');

        await expect(renameWorkspace('ws-123', 'new name')).rejects.toBeInstanceOf(DiagnosticError);

        // R1: exactly one structured toast call
        expect(showDiagnosticToastMock).toHaveBeenCalledTimes(1);
        const [errArg, optsArg] = showDiagnosticToastMock.mock.calls[0];

        // R3: it IS a DiagnosticError with the registry code + context
        expect(errArg).toBeInstanceOf(DiagnosticError);
        expect((errArg as DiagnosticError).code).toBe('RENAME_NO_BEARER_E001');
        expect((errArg as DiagnosticError).context).toEqual({ wsId: 'ws-123' });

        // R2: noStop + requestDetail preserved for persistent-toast + HTTP-detail UI
        expect(optsArg).toBeDefined();
        expect(optsArg.noStop).toBe(true);
        expect(optsArg.requestDetail).toEqual({
            method: 'PUT',
            url: '/user/workspaces/ws-123',
        });

        // R4: logError still fires with the plain-text scope + wsId
        expect(logErrorMock).toHaveBeenCalledWith(
            'Rename',
            expect.stringContaining('wsId=ws-123'),
        );
    });
});
