/**
 * Plan 22 · credit-balance toast migration.
 *
 * Verifies that every failure surface in credit-balance.ts routes through
 * showDiagnosticToast with a registered CREDIT_BALANCE_E00N code, and that
 * the user-visible low-balance warn still fires with warn severity.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const showDiagnosticToastSpy = vi.fn();
const resolveTokenSpy = vi.fn(() => 'tok_abc');
const markBearerTokenExpiredSpy = vi.fn();
const recoverAuthOnceSpy = vi.fn(async () => null as string | null);
const extractProjectIdSpy = vi.fn(() => 'proj_1');
const performDirectMoveSpy = vi.fn();

vi.mock('../errors/show-diagnostic-toast', () => ({
  showDiagnosticToast: showDiagnosticToastSpy,
}));

vi.mock('../logging', () => ({
  log: vi.fn(),
  logSub: vi.fn(),
}));

vi.mock('../auth', () => ({
  resolveToken: resolveTokenSpy,
  markBearerTokenExpired: markBearerTokenExpiredSpy,
  recoverAuthOnce: recoverAuthOnceSpy,
}));

vi.mock('../workspace-detection', () => ({
  extractProjectIdFromUrl: extractProjectIdSpy,
}));

vi.mock('../shared-state', () => ({
  CREDIT_API_BASE: 'https://api.example.test',
  state: { direction: 'down', hasFreeCredit: false },
}));

vi.mock('../constants', () => ({
  MIN_CREDIT_CALL_GAP_MS: 0,
}));

vi.mock('../loop-dom-fallback', () => ({
  performDirectMove: performDirectMoveSpy,
}));

import { DiagnosticError } from '../errors/diagnostic-error';

interface TestWindow {
  marco?: {
    api?: {
      workspace: { resolveByProject: (id: string, opts: unknown) => Promise<{ ok: boolean; status: number; data: unknown }> };
      credits: { fetchBalance: (id: string, opts: unknown) => Promise<{ ok: boolean; status: number; data: unknown }> };
    };
  };
  __MARCO_CONFIG__?: Record<string, unknown>;
}
const testWin = globalThis as unknown as TestWindow;

function stubMarco(workspaceResp: { ok: boolean; status: number; data: unknown }, balanceResp: { ok: boolean; status: number; data: unknown }): void {
  testWin.marco = {
    api: {
      workspace: { resolveByProject: vi.fn(async () => workspaceResp) },
      credits: { fetchBalance: vi.fn(async () => balanceResp) },
    },
  };
}

function firstToastCode(): string {
  const err = showDiagnosticToastSpy.mock.calls[0]?.[0] as DiagnosticError;
  return err.code;
}

async function loadModule(): Promise<typeof import('../credit-balance')> {
  vi.resetModules();
  return await import('../credit-balance');
}

beforeEach(() => {
  showDiagnosticToastSpy.mockClear();
  markBearerTokenExpiredSpy.mockClear();
  recoverAuthOnceSpy.mockClear();
  recoverAuthOnceSpy.mockResolvedValue(null);
  resolveTokenSpy.mockReturnValue('tok_abc');
  performDirectMoveSpy.mockClear();
});

describe('credit-balance diagnostic toasts', () => {
  it('CREDIT_BALANCE_E001 fires on workspace-resolve HTTP failure', async () => {
    stubMarco({ ok: false, status: 500, data: null }, { ok: true, status: 200, data: {} });
    const mod = await loadModule();
    mod.clearResolvedWorkspace();

    const result = await mod.resolveWorkspaceId();

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E001');
  });

  it('CREDIT_BALANCE_E002 fires when workspace payload is missing id', async () => {
    stubMarco({ ok: true, status: 200, data: { workspace: {} } }, { ok: true, status: 200, data: {} });
    const mod = await loadModule();
    mod.clearResolvedWorkspace();

    const result = await mod.resolveWorkspaceId();

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E002');
  });

  it('CREDIT_BALANCE_E003 fires when workspace resolve throws', async () => {
    testWin.marco = {
      api: {
        workspace: { resolveByProject: vi.fn(async () => { throw new Error('boom'); }) },
        credits: { fetchBalance: vi.fn(async () => ({ ok: true, status: 200, data: {} })) },
      },
    };
    const mod = await loadModule();
    mod.clearResolvedWorkspace();

    const result = await mod.resolveWorkspaceId();

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E003');
  });

  it('CREDIT_BALANCE_E004 fires when auth recovery fails on 401', async () => {
    recoverAuthOnceSpy.mockResolvedValueOnce(null);
    stubMarco({ ok: true, status: 200, data: { workspace: { id: 'ws_1', name: 'W' } } }, { ok: false, status: 401, data: null });
    const mod = await loadModule();

    const result = await mod.fetchCreditBalance('ws_1');

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E004');
  });

  it('CREDIT_BALANCE_E005 fires on non-auth HTTP failure', async () => {
    stubMarco({ ok: true, status: 200, data: { workspace: { id: 'ws_1', name: 'W' } } }, { ok: false, status: 500, data: null });
    const mod = await loadModule();

    const result = await mod.fetchCreditBalance('ws_1');

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E005');
  });

  it('CREDIT_BALANCE_E006 fires when daily_remaining is missing', async () => {
    stubMarco({ ok: true, status: 200, data: { workspace: { id: 'ws_1' } } }, { ok: true, status: 200, data: { total_remaining: 1 } });
    const mod = await loadModule();

    const result = await mod.fetchCreditBalance('ws_1');

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E006');
  });

  it('CREDIT_BALANCE_E007 fires on network error', async () => {
    testWin.marco = {
      api: {
        workspace: { resolveByProject: vi.fn(async () => ({ ok: true, status: 200, data: { workspace: { id: 'ws_1' } } })) },
        credits: { fetchBalance: vi.fn(async () => { throw new Error('offline'); }) },
      },
    };
    const mod = await loadModule();

    const result = await mod.fetchCreditBalance('ws_1');

    expect(result).toBeNull();
    expect(firstToastCode()).toBe('CREDIT_BALANCE_E007');
  });

  it('CREDIT_BALANCE_E008 fires with warn severity on low-balance move', async () => {
    stubMarco(
      { ok: true, status: 200, data: { workspace: { id: 'ws_1' } } },
      { ok: true, status: 200, data: { daily_remaining: 0, daily_limit: 5, total_remaining: 0 } },
    );
    const mod = await loadModule();

    const acted = await mod.checkAndActOnCreditBalance();

    expect(acted).toBe(true);
    const err = showDiagnosticToastSpy.mock.calls[0]?.[0] as DiagnosticError;
    expect(err.code).toBe('CREDIT_BALANCE_E008');
    expect(err.severity).toBe('warn');
    expect(performDirectMoveSpy).toHaveBeenCalledWith('down');
  });
});
