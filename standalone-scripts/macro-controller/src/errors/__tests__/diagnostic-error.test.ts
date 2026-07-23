import { describe, it, expect } from 'vitest';
import {
  DiagnosticError,
  DiagnosticMetaError,
  isDiagnosticError,
  throwDiagnostic,
} from '../diagnostic-error';

describe('DiagnosticError', () => {
  it('constructs a professional prefixed message from the template', () => {
    const err = new DiagnosticError('PROMPT_VALIDATE_E001', {
      role: 'plan',
      slug: 'plan-default',
      expected: 3,
      actual: 1,
      ruleId: 'rule-0',
    });
    expect(err.code).toBe('PROMPT_VALIDATE_E001');
    expect(err.area).toBe('PROMPT');
    expect(err.severity).toBe('error');
    expect(err.message).toContain('[PROMPT_VALIDATE_E001]');
    expect(err.message).toContain('plan');
    expect(err.message).toContain('plan-default');
    expect(err.message).toContain('{{n}}'); // template retains the {{n}} literal
    expect(isDiagnosticError(err)).toBe(true);
  });

  it('throws DiagnosticMetaError when the code is unknown', () => {
    expect(() =>
      new DiagnosticError('NOT_A_REAL_CODE_E999', { role: 'plan' } as never),
    ).toThrow(DiagnosticMetaError);
  });

  it('throws DiagnosticMetaError when required context keys are missing', () => {
    expect(() =>
      // @ts-expect-error deliberately missing keys
      new DiagnosticError('PROMPT_VALIDATE_E001', { role: 'plan' }),
    ).toThrow(/missing required context keys/);
  });

  it('throws DiagnosticMetaError when template placeholders are missing from context', () => {
    // HTTP_REQUEST_E001 template references {op}{status}{url}; omit `url`.
    expect(() =>
      // @ts-expect-error deliberately missing keys
      new DiagnosticError('HTTP_REQUEST_E001', { op: 'fetchCredits', status: 500, method: 'GET' }),
    ).toThrow(/missing required context keys|placeholders not supplied/);
  });

  it('masks sensitive context keys in toReport()', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'fetchCredits',
      status: 401,
      url: 'https://example/api',
      method: 'GET',
      // Extra sensitive keys the caller might attach:
      authorization: 'Bearer sk-live-xxx',
      cookie: 'session=abc',
    });
    const report = err.toReport();
    expect(report.context.authorization).toBe('[REDACTED]');
    expect(report.context.cookie).toBe('[REDACTED]');
    expect(report.context.url).toBe('https://example/api');
    expect(report.code).toBe('HTTP_REQUEST_E001');
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('captures cause when supplied', () => {
    const inner = new Error('socket hang up');
    const err = new DiagnosticError(
      'HTTP_REQUEST_E001',
      { op: 'fetchCredits', status: 0, url: 'https://example/api', method: 'GET' },
      inner,
    );
    const report = err.toReport();
    expect(report.cause?.message).toBe('socket hang up');
    expect(report.cause?.name).toBe('Error');
  });

  it('throwDiagnostic() rejects unknown codes with a meta error', () => {
    expect(() => throwDiagnostic('BOGUS_E001', { role: 'plan' } as never)).toThrow(DiagnosticMetaError);
  });
});
