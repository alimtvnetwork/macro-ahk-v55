/**
 * Plan 26 / step 6 — verifies that `logDiagnostic` and
 * `logDiagnosticFromCode` route DiagnosticError instances through the SDK
 * logger as BOTH a human error line and a structured `console` record whose
 * first argument is `'diagnostic-report'` and whose payload contains the
 * indexable `code` field. Also verifies the console fallback fires when the
 * SDK logger is absent (never silently swallowed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { DiagnosticError } from '../diagnostic-error';
import { logDiagnostic, logDiagnosticFromCode } from '../../error-utils';

interface LoggerStub {
  error: Mock;
  warn: Mock;
  info: Mock;
  debug: Mock;
  console: Mock;
  stackTrace: Mock;
}

function installLogger(): LoggerStub {
  const stub: LoggerStub = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    console: vi.fn(),
    stackTrace: vi.fn(),
  };
  (globalThis as unknown as { window: { RiseupAsiaMacroExt: { Logger: LoggerStub } } }).window = {
    RiseupAsiaMacroExt: { Logger: stub },
  };
  return stub;
}

function uninstallLogger(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}

const CTX = {
  role: 'plan',
  slug: 'plan-default',
  reason: 'row missing',
  action: 'edit',
};

const SENSITIVE_CTX = {
  ...CTX,
  bearer: 'secret-token-value',
  authorization: 'Bearer abc123',
  cookie: 'session=xyz',
};

interface StructuredPayload {
  code?: string;
  area?: string;
  action?: string;
  severity?: string;
  message?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

function assertStructuredPayload(
  consoleCall: unknown[],
  expected: { code: string; contextMasked?: boolean },
): void {
  expect(consoleCall[0]).toBe('PROMPT');
  expect(consoleCall[1]).toBe('diagnostic-report');
  const payload = consoleCall[2] as StructuredPayload;
  expect(payload.code).toBe(expected.code);
  expect(typeof payload.area).toBe('string');
  expect(typeof payload.action).toBe('string');
  expect(typeof payload.severity).toBe('string');
  expect(typeof payload.message).toBe('string');
  expect(typeof payload.timestamp).toBe('string');
  expect(payload.context).toBeDefined();
  expect(payload.context?.slug).toBe('plan-default');
  if (expected.contextMasked) {
    expect(payload.context?.bearer).toBe('[REDACTED]');
    expect(payload.context?.authorization).toBe('[REDACTED]');
    expect(payload.context?.cookie).toBe('[REDACTED]');
  }
}

describe('logDiagnostic (Plan 26 step 6)', () => {
  beforeEach(() => uninstallLogger());
  afterEach(() => uninstallLogger());

  it('emits error + console records through the SDK logger with the error code', () => {
    const stub = installLogger();
    const err = new DiagnosticError('PROMPT_EDIT_E001', CTX);
    const report = logDiagnostic(err);

    expect(stub.error).toHaveBeenCalledTimes(1);
    const errorCall = stub.error.mock.calls[0] ?? [];
    expect(errorCall[0]).toBe('PROMPT');
    expect(String(errorCall[1] ?? '')).toContain('[PROMPT_EDIT_E001]');
    expect(errorCall[2]).toBe(err);

    expect(stub.console).toHaveBeenCalledTimes(1);
    const consoleCall = stub.console.mock.calls[0] ?? [];
    expect(consoleCall[0]).toBe('PROMPT');
    expect(consoleCall[1]).toBe('diagnostic-report');
    const payload = consoleCall[2] as { code?: string; context?: Record<string, unknown> };
    expect(payload.code).toBe('PROMPT_EDIT_E001');
    expect(payload.context?.slug).toBe('plan-default');

    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('falls back to console.error + console.log when the SDK logger is absent', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const err = new DiagnosticError('PROMPT_EDIT_E001', CTX);
      logDiagnostic(err);
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const firstArg = String(errSpy.mock.calls[0]?.[0] ?? '');
      expect(firstArg).toContain('[PROMPT_EDIT_E001]');
    } finally {
      errSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it('logDiagnosticFromCode constructs + logs in one call', () => {
    const stub = installLogger();
    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
    expect(stub.error).toHaveBeenCalledTimes(1);
    expect(stub.console).toHaveBeenCalledTimes(1);
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('masks sensitive keys in the structured console payload', () => {
    const stub = installLogger();
    logDiagnosticFromCode('PROMPT_EDIT_E001', {
      ...CTX,
      bearer: 'secret-token-value',
    });
    const consoleCall = stub.console.mock.calls[0] ?? [];
    const payload = consoleCall[2] as { context: Record<string, unknown> };
    expect(payload.context.bearer).toBe('[REDACTED]');
    expect(payload.context.slug).toBe('plan-default');
  });

  it('propagates DiagnosticMetaError when the code is unknown (no silent swallow)', () => {
    installLogger();
    expect(() =>
      logDiagnosticFromCode('DEFINITELY_NOT_A_CODE_E999', CTX),
    ).toThrow(/Unknown error code/);
  });

  it('logs correctly when the SDK logger omits stackTrace entirely', () => {
    const errorFn = vi.fn();
    const consoleFn = vi.fn();
    const partial = { error: errorFn, console: consoleFn };
    (globalThis as unknown as { window: { RiseupAsiaMacroExt: { Logger: unknown } } }).window = {
      RiseupAsiaMacroExt: { Logger: partial },
    };
    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', SENSITIVE_CTX);
    expect(errorFn).toHaveBeenCalledTimes(1);
    expect(consoleFn).toHaveBeenCalledTimes(1);
    assertStructuredPayload(consoleFn.mock.calls[0] ?? [], {
      code: 'PROMPT_EDIT_E001',
      contextMasked: true,
    });
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('logs correctly when stackTrace exists but returns undefined', () => {
    const stub = installLogger();
    stub.stackTrace.mockReturnValue(undefined);
    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', SENSITIVE_CTX);
    expect(stub.error).toHaveBeenCalledTimes(1);
    expect(stub.console).toHaveBeenCalledTimes(1);
    expect(stub.stackTrace).not.toHaveBeenCalled();
    assertStructuredPayload(stub.console.mock.calls[0] ?? [], {
      code: 'PROMPT_EDIT_E001',
      contextMasked: true,
    });
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('logs correctly when only the minimum surface (error + console) is present', () => {
    const errorFn = vi.fn();
    const consoleFn = vi.fn();
    (globalThis as unknown as { window: { RiseupAsiaMacroExt: { Logger: unknown } } }).window = {
      RiseupAsiaMacroExt: { Logger: { error: errorFn, console: consoleFn } },
    };
    const err = new DiagnosticError('PROMPT_EDIT_E001', SENSITIVE_CTX);
    const report = logDiagnostic(err);
    expect(errorFn).toHaveBeenCalledTimes(1);
    expect(consoleFn).toHaveBeenCalledTimes(1);
    assertStructuredPayload(consoleFn.mock.calls[0] ?? [], {
      code: 'PROMPT_EDIT_E001',
      contextMasked: true,
    });
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('routes and masks structured payload identically across full and partial loggers', () => {
    const stub = installLogger();
    logDiagnosticFromCode('PROMPT_EDIT_E001', SENSITIVE_CTX);
    const fullPayload = (stub.console.mock.calls[0] ?? [])[2] as StructuredPayload;

    // Re-install with a minimum-surface logger and compare shape+masking.
    uninstallLogger();
    const errorFn = vi.fn();
    const consoleFn = vi.fn();
    (globalThis as unknown as { window: { RiseupAsiaMacroExt: { Logger: unknown } } }).window = {
      RiseupAsiaMacroExt: { Logger: { error: errorFn, console: consoleFn } },
    };
    logDiagnosticFromCode('PROMPT_EDIT_E001', SENSITIVE_CTX);
    const partialPayload = (consoleFn.mock.calls[0] ?? [])[2] as StructuredPayload;

    // Structural fields (excluding volatile timestamp) MUST match.
    expect(partialPayload.code).toBe(fullPayload.code);
    expect(partialPayload.area).toBe(fullPayload.area);
    expect(partialPayload.action).toBe(fullPayload.action);
    expect(partialPayload.severity).toBe(fullPayload.severity);
    expect(partialPayload.message).toBe(fullPayload.message);
    expect(partialPayload.context).toEqual(fullPayload.context);
    expect(partialPayload.context?.bearer).toBe('[REDACTED]');
    expect(partialPayload.context?.authorization).toBe('[REDACTED]');
    expect(partialPayload.context?.cookie).toBe('[REDACTED]');
  });
});
