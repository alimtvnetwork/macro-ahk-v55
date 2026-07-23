/**
 * v4.298.0 — coverage for the diagnostic-toast telemetry sink.
 *
 * Locks: event shape (code / severity / level / title), noStop flag
 * capture, redacted requestDetail snapshot (header names only, byte
 * lengths never raw text), ring buffer trimming, and CustomEvent
 * dispatch on `marco:diagnostic-toast`.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

import {
  emitDiagnosticToastEvent,
  readDiagnosticToastTrace,
  clearDiagnosticToastTrace,
  generateCorrelationId,
  DIAGNOSTIC_TOAST_TRACE_MAX,
} from '../diagnostic-toast-telemetry';


describe('diagnostic-toast-telemetry', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDiagnosticToastTrace();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('T1: emits an event with core fields', () => {
    const evt = emitDiagnosticToastEvent({
      code: 'HEALTH_CHECK_E001',
      severity: 'warn',
      level: 'warn',
      title: 'Prompt health failed',
    });
    expect(evt.code).toBe('HEALTH_CHECK_E001');
    expect(evt.severity).toBe('warn');
    expect(evt.level).toBe('warn');
    expect(evt.title).toBe('Prompt health failed');
    expect(evt.noStop).toBe(false);
    expect(evt.requestDetail).toBeUndefined();
    expect(new Date(evt.at).toString()).not.toBe('Invalid Date');
  });

  it('T2: captures noStop and redacts requestDetail (headerNames + byte lengths only)', () => {
    const evt = emitDiagnosticToastEvent({
      code: 'HTTP_REQUEST_E001',
      severity: 'error',
      level: 'error',
      title: 'HTTP failed',
      opts: {
        noStop: true,
        requestDetail: {
          op: 'ws.members.list',
          method: 'GET',
          url: 'https://example/api',
          status: 500,
          statusText: 'ISE',
          headers: { Authorization: 'Bearer secret-token', 'X-Trace': 'abc' },
          body: 'raw-body-should-not-leak',
          responseBody: '{"err":"boom"}',
        },
      },
    });
    expect(evt.noStop).toBe(true);
    const rd = evt.requestDetail;
    expect(rd).toBeDefined();
    expect(rd?.op).toBe('ws.members.list');
    expect(rd?.status).toBe(500);
    expect(rd?.headerNames).toEqual(['Authorization', 'X-Trace']);
    expect(rd?.bodyBytes).toBe('raw-body-should-not-leak'.length);
    expect(rd?.responseBodyBytes).toBe('{"err":"boom"}'.length);
    // No raw body/headers values allowed on the snapshot.
    expect(JSON.stringify(rd)).not.toContain('secret-token');
    expect(JSON.stringify(rd)).not.toContain('raw-body-should-not-leak');
  });

  it('T3: dispatches marco:diagnostic-toast CustomEvent', () => {
    const seen: unknown[] = [];
    const handler = (e: Event): void => {
      seen.push((e as CustomEvent).detail);
    };
    window.addEventListener('marco:diagnostic-toast', handler);
    emitDiagnosticToastEvent({
      code: 'X_E001',
      severity: 'info',
      level: 'info',
      title: 'hi',
    });
    window.removeEventListener('marco:diagnostic-toast', handler);
    expect(seen.length).toBe(1);
    expect((seen[0] as { code: string }).code).toBe('X_E001');
  });

  it('T4: ring buffer trims to DIAGNOSTIC_TOAST_TRACE_MAX', () => {
    for (let i = 0; i < DIAGNOSTIC_TOAST_TRACE_MAX + 10; i++) {
      emitDiagnosticToastEvent({
        code: 'X_E' + String(i),
        severity: 'info',
        level: 'info',
        title: 't',
      });
    }
    const trace = readDiagnosticToastTrace();
    expect(trace.length).toBe(DIAGNOSTIC_TOAST_TRACE_MAX);
    // Oldest entries evicted → first code is offset by 10.
    expect(trace[0]?.code).toBe('X_E10');
  });

  it('T5: readDiagnosticToastTrace tolerates corrupt localStorage payloads', () => {
    localStorage.setItem('marco_diagnostic_toast_trace', '{not json');
    expect(readDiagnosticToastTrace()).toEqual([]);
  });

  it('T6: propagates correlationId from opts.requestDetail verbatim', () => {
    const cid = 'req-ws-members-42';
    const evt = emitDiagnosticToastEvent({
      code: 'HTTP_REQUEST_E001',
      severity: 'error',
      level: 'error',
      title: 'HTTP failed',
      opts: { requestDetail: { op: 'ws.members.list', correlationId: cid } },
    });
    expect(evt.correlationId).toBe(cid);
    expect(evt.requestDetail?.correlationId).toBe(cid);
  });

  it('T7: auto-generates correlationId when caller omits one and stamps snapshot', () => {
    const evt = emitDiagnosticToastEvent({
      code: 'HTTP_REQUEST_E001',
      severity: 'error',
      level: 'error',
      title: 'HTTP failed',
      opts: { requestDetail: { op: 'ws.members.list' } },
    });
    expect(evt.correlationId).toMatch(/^dtx-[a-z0-9]+-[a-z0-9]+$/);
    expect(evt.requestDetail?.correlationId).toBe(evt.correlationId);
  });

  it('T8: correlationId is stable across trace buffer + CustomEvent surfaces', () => {
    let dispatched: string | null = null;
    const handler = (e: Event): void => {
      dispatched = (e as CustomEvent<{ correlationId: string }>).detail.correlationId;
    };
    window.addEventListener('marco:diagnostic-toast', handler);
    const evt = emitDiagnosticToastEvent({
      code: 'X_E001',
      severity: 'info',
      level: 'info',
      title: 'hi',
      correlationId: 'explicit-cid-1',
    });
    window.removeEventListener('marco:diagnostic-toast', handler);
    expect(evt.correlationId).toBe('explicit-cid-1');
    expect(dispatched).toBe('explicit-cid-1');
    const trace = readDiagnosticToastTrace();
    expect(trace[trace.length - 1]?.correlationId).toBe('explicit-cid-1');
  });

  it('T9: generateCorrelationId produces unique ids on rapid calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(generateCorrelationId());
    expect(ids.size).toBe(50);
  });

});
