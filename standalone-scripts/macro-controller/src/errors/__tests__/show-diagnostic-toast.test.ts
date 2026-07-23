/**
 * Plan 22 · gap #7 — end-to-end coverage of the structured-failure toast
 * rendering pipeline: DiagnosticError -> reportDiagnostic -> showToast.
 *
 * Locks: severity mapping (T1..T4), multi-line body preservation with
 * embedded newlines (T5), footerCode inclusion (T6), and that the log sink
 * fires alongside the visible toast (T7). A regression that dropped the log
 * or collapsed the body to one line would fail these assertions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const showToastMock = vi.fn();
vi.mock('../../toast', () => ({
  showToast: (message: string, level?: string, opts?: unknown) => showToastMock(message, level, opts),
}));

// Import AFTER mocks so the helper picks up the stubbed showToast.
import { DiagnosticError } from '../diagnostic-error';
import {
  showDiagnosticToast,
  severityToToastLevel,
  composeToastMessage,
} from '../show-diagnostic-toast';
import { formatDiagnosticToast } from '../format';
import {
  readDiagnosticToastTrace,
  clearDiagnosticToastTrace,
} from '../../telemetry/diagnostic-toast-telemetry';

describe('showDiagnosticToast pipeline (Plan 22 gap #7)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    showToastMock.mockClear();
    localStorage.clear();
    clearDiagnosticToastTrace();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('T1: fatal severity maps to "error" toast level', () => {
    expect(severityToToastLevel('fatal')).toBe('error');
  });
  it('T2: error severity maps to "error" toast level', () => {
    expect(severityToToastLevel('error')).toBe('error');
  });
  it('T3: warn severity maps to "warn" toast level', () => {
    expect(severityToToastLevel('warn')).toBe('warn');
  });
  it('T4: info severity maps to "info" toast level', () => {
    expect(severityToToastLevel('info')).toBe('info');
  });

  it('T5: composeToastMessage preserves newlines between title / body / footer', () => {
    const t = formatDiagnosticToast('PROMPT_VALIDATE_E001', {
      role: 'plan',
      slug: 'plan-default',
      expected: 3,
      actual: 1,
      ruleId: 'rule-0',
    });
    const message = composeToastMessage(t);
    const parts = message.split('\n');
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts[0]).toBe(t.title);
    expect(parts[parts.length - 1]).toBe(t.footerCode);
    expect(message).toContain('What happened:');
    expect(message).toContain('Next:');
  });

  it('T6: showDiagnosticToast forwards level=warn and message contains code footer', () => {
    const err = new DiagnosticError('HEALTH_CHECK_E001', {
      role: 'plan',
      issueCount: 2,
      issueSummary: 'missing body, wrong tokens',
    });
    const result = showDiagnosticToast(err);
    expect(result.level).toBe('warn');
    expect(showToastMock).toHaveBeenCalledTimes(1);
    const [message, level] = showToastMock.mock.calls[0]!;
    expect(level).toBe('warn');
    expect(message).toContain('code=HEALTH_CHECK_E001');
    expect(message.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('T7: showDiagnosticToast also drives the diagnostics log sink (console.error + console.log)', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list',
      status: 500,
      url: 'https://example/api',
      method: 'GET',
    });
    const result = showDiagnosticToast(err);
    expect(result.level).toBe('error');
    expect(errSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock.mock.calls[0]![1]).toBe('error');
  });

  it('T8: emits a diagnostic-toast telemetry event carrying code + level + noStop + redacted requestDetail', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list',
      status: 500,
      url: 'https://example/api',
      method: 'GET',
    });
    showDiagnosticToast(err, {
      noStop: true,
      requestDetail: {
        op: 'ws.members.list',
        method: 'GET',
        url: 'https://example/api',
        status: 500,
        headers: { Authorization: 'Bearer secret-token' },
        body: 'payload',
      },
    });
    const trace = readDiagnosticToastTrace();
    expect(trace.length).toBe(1);
    const evt = trace[0]!;
    expect(evt.code).toBe('HTTP_REQUEST_E001');
    expect(evt.level).toBe('error');
    expect(evt.noStop).toBe(true);
    expect(evt.requestDetail?.headerNames).toEqual(['Authorization']);
    expect(evt.requestDetail?.bodyBytes).toBe('payload'.length);
    expect(JSON.stringify(evt.requestDetail)).not.toContain('secret-token');
  });

  // ── Redaction hardening ──
  // Lock the invariant that showDiagnosticToast never persists raw credentials
  // into the ring buffer, CustomEvent detail, or localStorage payload.

  const SENSITIVE_LITERALS = [
    'Bearer super-secret-token-abcdef',
    'sk_live_51PxABCDEF1234567890',
    'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    'password=hunter2',
    'cookie-session=abcdef',
  ];

  function assertNoLiterals(serialized: string): void {
    for (const lit of SENSITIVE_LITERALS) {
      expect(serialized).not.toContain(lit);
    }
  }

  it('T9: never stores raw Authorization / Cookie / Set-Cookie header values', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list', status: 401, url: 'https://example/api', method: 'GET',
    });
    showDiagnosticToast(err, {
      requestDetail: {
        op: 'ws.members.list', method: 'GET', url: 'https://example/api', status: 401,
        headers: {
          Authorization: 'Bearer super-secret-token-abcdef',
          Cookie: 'cookie-session=abcdef',
          'Set-Cookie': 'session=abcdef; HttpOnly',
          'X-Api-Key': 'sk_live_51PxABCDEF1234567890',
        },
      },
    });
    const evt = readDiagnosticToastTrace()[0]!;
    expect(evt.requestDetail?.headerNames).toEqual([
      'Authorization', 'Cookie', 'Set-Cookie', 'X-Api-Key',
    ]);
    const serialized = JSON.stringify(evt);
    assertNoLiterals(serialized);
    expect(serialized).not.toMatch(/Bearer\s+\S+/);
  });

  it('T10: never stores raw request or response body text (only byte lengths)', () => {
    const rawBody = 'password=hunter2&username=alice';
    const rawResp = '{"token":"ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}';
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'auth.login', status: 500, url: 'https://example/login', method: 'POST',
    });
    showDiagnosticToast(err, {
      requestDetail: {
        op: 'auth.login', method: 'POST', url: 'https://example/login', status: 500,
        body: rawBody, responseBody: rawResp,
      },
    });
    const evt = readDiagnosticToastTrace()[0]!;
    expect(evt.requestDetail?.bodyBytes).toBe(rawBody.length);
    expect(evt.requestDetail?.responseBodyBytes).toBe(rawResp.length);
    expect(evt.requestDetail).not.toHaveProperty('body');
    expect(evt.requestDetail).not.toHaveProperty('responseBody');
    assertNoLiterals(JSON.stringify(evt));
  });

  it('T11: localStorage-persisted ring buffer contains no sensitive literals', () => {
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list', status: 500, url: 'https://example/api', method: 'GET',
    });
    showDiagnosticToast(err, {
      requestDetail: {
        op: 'ws.members.list', method: 'GET', url: 'https://example/api', status: 500,
        headers: { Authorization: 'Bearer super-secret-token-abcdef' },
        body: 'password=hunter2',
        responseBody: 'sk_live_51PxABCDEF1234567890',
      },
    });
    const raw = localStorage.getItem('marco_diagnostic_toast_trace') ?? '';
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain('HTTP_REQUEST_E001');
    assertNoLiterals(raw);
  });

  it('T12: CustomEvent detail carries the same redacted snapshot as the ring buffer', () => {
    let seen: unknown = null;
    const handler = (e: Event): void => { seen = (e as CustomEvent).detail; };
    window.addEventListener('marco:diagnostic-toast', handler);
    const err = new DiagnosticError('HTTP_REQUEST_E001', {
      op: 'ws.members.list', status: 500, url: 'https://example/api', method: 'GET',
    });
    showDiagnosticToast(err, {
      requestDetail: {
        op: 'ws.members.list', method: 'GET', url: 'https://example/api', status: 500,
        headers: { Authorization: 'Bearer super-secret-token-abcdef' },
        body: 'password=hunter2',
      },
    });
    window.removeEventListener('marco:diagnostic-toast', handler);
    expect(seen).toBeTruthy();
    assertNoLiterals(JSON.stringify(seen));
  });
});
