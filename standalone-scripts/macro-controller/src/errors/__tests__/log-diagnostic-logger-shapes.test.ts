/**
 * Logger-shape acceptance/rejection matrix for `logDiagnosticFromCode`.
 *
 * Contract enforced in `error-utils.ts` (`isSdkLogger`):
 *   ACCEPTED: an object with callable `error` AND callable `console`.
 *             Optional helpers (`warn`, `debug`, `stackTrace`) may be absent.
 *   REJECTED: anything else. When rejected, the SDK path is skipped and
 *             the code falls back to `console.error` + `console.log` so
 *             the diagnostic is NEVER silently swallowed.
 *
 * These tests pin the contract so future edits to the guard cannot
 * accidentally widen it (e.g. accept a stub with only `error`) or
 * narrow it (e.g. require `warn`/`debug`/`stackTrace`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticError } from '../diagnostic-error';
import { logDiagnosticFromCode } from '../../error-utils';

const CTX = { role: 'plan', slug: 'plan-default', reason: 'row missing', action: 'edit' };

type WindowSlot = { window?: { RiseupAsiaMacroExt?: { Logger?: unknown } } };
const slot = globalThis as unknown as WindowSlot;

function installLoggerValue(loggerValue: unknown): void {
  slot.window = { RiseupAsiaMacroExt: { Logger: loggerValue as never } };
}

function uninstallLogger(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}

interface FallbackSpies {
  err: ReturnType<typeof vi.spyOn>;
  log: ReturnType<typeof vi.spyOn>;
  restore: () => void;
}

function spyOnFallback(): FallbackSpies {
  const err = vi.spyOn(console, 'error').mockImplementation(() => { /* silence */ });
  const log = vi.spyOn(console, 'log').mockImplementation(() => { /* silence */ });
  return {
    err,
    log,
    restore: () => { err.mockRestore(); log.mockRestore(); },
  };
}

describe('logDiagnosticFromCode — accepted logger shapes', () => {
  beforeEach(() => uninstallLogger());
  afterEach(() => uninstallLogger());

  it('accepts the minimum surface: { error, console }', () => {
    const errorSink = vi.fn();
    const consoleSink = vi.fn();
    installLoggerValue({ error: errorSink, console: consoleSink });

    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);

    expect(errorSink).toHaveBeenCalledTimes(1);
    expect(consoleSink).toHaveBeenCalledTimes(1);
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('accepts the full surface: error + console + warn + debug + stackTrace + info', () => {
    const full = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      console: vi.fn(),
      stackTrace: vi.fn(),
    };
    installLoggerValue(full);

    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);

    expect(full.error).toHaveBeenCalledTimes(1);
    expect(full.console).toHaveBeenCalledTimes(1);
    // The optional helpers must NOT be invoked by logDiagnostic itself.
    expect(full.warn).not.toHaveBeenCalled();
    expect(full.debug).not.toHaveBeenCalled();
    expect(full.stackTrace).not.toHaveBeenCalled();
    expect(full.info).not.toHaveBeenCalled();
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });

  it('accepts a logger with extra unknown methods (forward-compat)', () => {
    const forwardCompat = {
      error: vi.fn(),
      console: vi.fn(),
      // Simulate a future addition like `metric` or `trace`.
      metric: vi.fn(),
      trace: vi.fn(),
    };
    installLoggerValue(forwardCompat);

    const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);

    expect(forwardCompat.error).toHaveBeenCalledTimes(1);
    expect(forwardCompat.console).toHaveBeenCalledTimes(1);
    expect(forwardCompat.metric).not.toHaveBeenCalled();
    expect(forwardCompat.trace).not.toHaveBeenCalled();
    expect(report.code).toBe('PROMPT_EDIT_E001');
  });
});

describe('logDiagnosticFromCode — rejected logger shapes fall back cleanly', () => {
  beforeEach(() => uninstallLogger());
  afterEach(() => uninstallLogger());

  const REJECTED_CASES: ReadonlyArray<readonly [string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['plain empty object', {}],
    ['string', 'not-a-logger'],
    ['number', 42],
    ['boolean', true],
    ['array', ['error', 'console']],
    ['missing console method', { error: vi.fn() }],
    ['missing error method', { console: vi.fn() }],
    ['error is not callable', { error: 'nope', console: vi.fn() }],
    ['console is not callable', { error: vi.fn(), console: 'nope' }],
    ['both non-callable', { error: 1, console: 2 }],
    ['error is a getter that throws', Object.defineProperty({ console: vi.fn() }, 'error', {
      get() { throw new Error('boom'); },
    })],
  ];

  for (const [label, loggerValue] of REJECTED_CASES) {
    it(`rejects ${label} and falls back to console.error + console.log`, () => {
      installLoggerValue(loggerValue);
      const spies = spyOnFallback();
      try {
        // If the guard is strict, any of the rejected shapes above must
        // route through the console fallback (never call into the stub).
        let threw: unknown;
        try {
          logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
        } catch (e) {
          threw = e;
        }

        // Getters that throw are allowed to propagate — that is a caller
        // bug, not a diagnostic bug. Every other rejected shape must reach
        // the fallback exactly once for BOTH sinks.
        if (label === 'error is a getter that throws') {
          expect(threw).toBeInstanceOf(Error);
          return;
        }

        expect(threw).toBeUndefined();
        expect(spies.err).toHaveBeenCalledTimes(1);
        expect(spies.log).toHaveBeenCalledTimes(1);
        const firstArg = String(spies.err.mock.calls[0]?.[0] ?? '');
        expect(firstArg).toContain('[PROMPT_EDIT_E001]');
      } finally {
        spies.restore();
      }
    });
  }

  it('falls back when window itself is undefined (no SDK bootstrap)', () => {
    uninstallLogger();
    const spies = spyOnFallback();
    try {
      const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
      expect(spies.err).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(report.code).toBe('PROMPT_EDIT_E001');
    } finally {
      spies.restore();
    }
  });

  it('falls back when window.RiseupAsiaMacroExt is defined but Logger is missing', () => {
    slot.window = { RiseupAsiaMacroExt: {} };
    const spies = spyOnFallback();
    try {
      const report = logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
      expect(spies.err).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(report.code).toBe('PROMPT_EDIT_E001');
    } finally {
      spies.restore();
    }
  });

  it('never silently swallows: fallback fires for a DiagnosticError instance too', () => {
    installLoggerValue(null);
    const spies = spyOnFallback();
    try {
      // Sanity: constructing the error directly and logging via the same
      // path must still surface through the console fallback.
      const err = new DiagnosticError('PROMPT_EDIT_E001', CTX);
      expect(err.code).toBe('PROMPT_EDIT_E001');
      logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
      expect(spies.err).toHaveBeenCalled();
      expect(spies.log).toHaveBeenCalled();
    } finally {
      spies.restore();
    }
  });
});
