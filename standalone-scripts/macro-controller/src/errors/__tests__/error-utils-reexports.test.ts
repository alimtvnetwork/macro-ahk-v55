/**
 * Plan 26 · Step 7 · error-utils diagnostic surface re-exports + bridges.
 *
 * Proves that consumers can import the diagnostic surface from `error-utils`
 * (single migration entry point) and that `reportDiagnostic` and `wrapCaught`
 * behave per contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DiagnosticError,
  DiagnosticMetaError,
  isDiagnosticError,
  throwDiagnostic,
  formatDiagnosticToast,
  ERROR_CODES,
  reportDiagnostic,
  wrapCaught,
  logDiagnostic,
} from '../../error-utils';

describe('error-utils diagnostic re-exports (step 7)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('re-exports DiagnosticError, throwDiagnostic, and ERROR_CODES', () => {
    expect(typeof DiagnosticError).toBe('function');
    expect(typeof DiagnosticMetaError).toBe('function');
    expect(typeof throwDiagnostic).toBe('function');
    expect(typeof isDiagnosticError).toBe('function');
    expect(typeof formatDiagnosticToast).toBe('function');
    expect(ERROR_CODES.PROMPT_VALIDATE_E001).toBeDefined();
  });

  it('reportDiagnostic logs the error and returns both report + toast payload', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list',
      status: 500,
      url: 'https://example/api',
      method: 'GET',
    });
    const { report, toast } = reportDiagnostic(err);
    expect(report.code).toBe('HTTP_REQUEST_E001');
    expect(report.context.status).toBe(500);
    expect(toast.footerCode).toContain('HTTP_REQUEST_E001');
    expect(errSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('wrapCaught wraps a bare Error under a registered code and preserves cause', () => {
    const raw = new Error('boom');
    const wrapped = wrapCaught(
      'DB_WRITE_E001',
      { table: 'PromptRow', op: 'update', pkey: 42, sqliteCode: 'SQLITE_BUSY' },
      raw,
    );
    expect(wrapped).toBeInstanceOf(DiagnosticError);
    expect(wrapped.code).toBe('DB_WRITE_E001');
    expect(wrapped.cause).toBe(raw);
  });

  it('wrapCaught returns the original DiagnosticError unchanged when passed one', () => {
    const original = new DiagnosticError('SEED_INSERT_E001', {
      role: 'plan',
      reason: 'sqlite locked',
      boot: 1,
      dbVersion: '4.277.0',
    });
    const passthrough = wrapCaught(
      'DB_WRITE_E001',
      { table: 'x', op: 'y', pkey: 'z', sqliteCode: 'ok' },
      original,
    );
    expect(passthrough).toBe(original);
    expect(passthrough.code).toBe('SEED_INSERT_E001');
  });

  it('logDiagnostic is callable from error-utils and returns a report', () => {
    const err = new DiagnosticError('HEALTH_CHECK_E001', {
      role: 'next',
      issueCount: 2,
      issueSummary: 'missing default; slug mismatch',
    });
    const report = logDiagnostic(err);
    expect(report.area).toBe('HEALTH');
    expect(report.severity).toBe('warn');
  });
});
