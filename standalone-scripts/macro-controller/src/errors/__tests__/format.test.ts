import { describe, it, expect } from 'vitest';
import { DiagnosticError } from '../diagnostic-error';
import {
  formatDiagnosticToast,
  formatDiagnosticToastPlain,
  previewToast,
  _forTests,
} from '../format';

describe('formatDiagnosticToast', () => {
  it('produces title / body / footerCode from a live DiagnosticError', () => {
    const err = new DiagnosticError('PROMPT_VALIDATE_E001', {
      role: 'plan',
      slug: 'plan-default',
      expected: 3,
      actual: 1,
      ruleId: 'rule-0',
    });
    const t = formatDiagnosticToast(err);
    expect(t.title).toContain('Prompt');
    expect(t.title).toContain('Validate');
    expect(t.title.startsWith('❌')).toBe(true);
    expect(t.body).toContain('What happened:');
    expect(t.body).toContain('Details:');
    expect(t.body).toContain('ruleId=rule-0');
    expect(t.body).toContain('Next:');
    expect(t.footerCode).toBe('code=PROMPT_VALIDATE_E001');
    expect(t.severity).toBe('error');
    expect(t.durationMs).toBe(15000);
  });

  it('accepts (code, context) directly', () => {
    const t = formatDiagnosticToast('HTTP_REQUEST_E001', {
      op: 'fetchCredits',
      status: 500,
      url: 'https://example/api',
      method: 'GET',
    });
    expect(t.footerCode).toBe('code=HTTP_REQUEST_E001');
    expect(t.body).toContain('method=GET');
  });

  it('flatten helper concatenates title/body/footerCode with newlines', () => {
    const plain = formatDiagnosticToastPlain('HISTORY_RESOLVE_E001', {
      requestedSlug: 'plan-default',
      role: 'plan',
      fallbackChain: 'chain-1',
    });
    expect(plain).toMatch(/^❌ Prompt history/);
    expect(plain).toContain('code=HISTORY_RESOLVE_E001');
  });

  it('uses warn icon and shorter duration for warn severity', () => {
    const t = formatDiagnosticToast('HEALTH_CHECK_E001', {
      role: 'plan',
      issueCount: 2,
      issueSummary: 'missing body, wrong tokens',
    });
    expect(t.title.startsWith('⚠️')).toBe(true);
    expect(t.severity).toBe('warn');
    expect(t.durationMs).toBe(8000);
  });

  it('rejects payloads containing forbidden words', () => {
    expect(() => _forTests.assertProfessionalWording({
      title: 'oops something broke',
      body: 'x',
      footerCode: 'code=X',
      severity: 'error',
      durationMs: 15000,
    })).toThrow(/forbidden word/);
  });

  it('rejects a bare "Failed" body', () => {
    expect(() => _forTests.assertProfessionalWording({
      title: '❌ Prompt — Validate',
      body: 'Failed.',
      footerCode: 'code=X',
      severity: 'error',
      durationMs: 15000,
    })).toThrow(/state the object/);
  });

  it('previewToast throws for unknown codes', () => {
    expect(() => previewToast('BOGUS_E999', { role: 'plan' } as never)).toThrow(/Unknown error code/);
  });
});
