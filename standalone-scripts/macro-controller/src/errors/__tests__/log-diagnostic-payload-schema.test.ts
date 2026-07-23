/**
 * Schema pin for the structured `console` payload emitted by
 * `logDiagnostic` / `logDiagnosticFromCode` across every accepted logger
 * variant.
 *
 * Contract (frozen — do not weaken without a MAJOR bump):
 *
 *   logger.console(scope, 'diagnostic-report', payload)
 *
 *   payload = {
 *     code:       string  (registered in ERROR_CODES)
 *     area:       string
 *     action:     string
 *     severity:   'error' | 'warn' | 'info'
 *     message:    string  (rendered from humanTemplate)
 *     timestamp:  string  (ISO-8601)
 *     context:    Record<string, DiagnosticContextValue>   // masked
 *     cause?:     { name: string, message: string, stack?: string }
 *   }
 *
 * Extra keys are forbidden — the diagnostics ZIP exporter (Plan 26 step 18)
 * indexes by `code` and expects a stable column set. If a new field is
 * genuinely required, add it to `reportToLogArg` AND to `SCHEMA_KEYS_ALL`
 * below in the same commit, then bump MINOR.
 *
 * This file validates that shape structurally for FIVE logger variants
 * (full surface, min surface, extra-methods, stackTrace=undefined,
 * warn+debug present but stackTrace missing) and asserts a stable JSON
 * snapshot with volatile fields (`timestamp`) normalized.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { logDiagnosticFromCode } from '../../error-utils';

const REQUIRED_KEYS = ['code', 'area', 'action', 'severity', 'message', 'timestamp', 'context'] as const;
const OPTIONAL_KEYS = ['cause'] as const;
const SCHEMA_KEYS_ALL = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const ALLOWED_SEVERITIES = new Set(['error', 'warn', 'info']);
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const CTX = {
  role: 'plan',
  slug: 'plan-default',
  reason: 'row missing',
  action: 'edit',
  bearer: 'secret-token-value',
  authorization: 'Bearer abc123',
  cookie: 'session=xyz',
};

type WindowSlot = { window?: { RiseupAsiaMacroExt?: { Logger?: unknown } } };
const slot = globalThis as unknown as WindowSlot;

function uninstallLogger(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}

function installLogger(loggerValue: unknown): void {
  slot.window = { RiseupAsiaMacroExt: { Logger: loggerValue as never } };
}

interface Payload {
  code: string;
  area: string;
  action: string;
  severity: string;
  message: string;
  timestamp: string;
  context: Record<string, unknown>;
  cause?: { name: string; message: string; stack?: string };
}

function extractPayload(consoleMock: Mock): Payload {
  expect(consoleMock).toHaveBeenCalledTimes(1);
  const call = consoleMock.mock.calls[0] ?? [];
  expect(call.length).toBe(3);
  expect(typeof call[0]).toBe('string'); // scope
  expect(call[1]).toBe('diagnostic-report');
  return call[2] as Payload;
}

function assertPayloadSchema(payload: Payload): void {
  // 1. No unknown top-level keys.
  for (const key of Object.keys(payload)) {
    expect(SCHEMA_KEYS_ALL.has(key), `unexpected payload key: ${key}`).toBe(true);
  }
  // 2. All required keys present and typed correctly.
  for (const key of REQUIRED_KEYS) {
    expect(payload[key], `missing required key: ${key}`).toBeDefined();
  }
  expect(typeof payload.code).toBe('string');
  expect(payload.code.length).toBeGreaterThan(0);
  expect(typeof payload.area).toBe('string');
  expect(typeof payload.action).toBe('string');
  expect(ALLOWED_SEVERITIES.has(payload.severity)).toBe(true);
  expect(typeof payload.message).toBe('string');
  expect(payload.message.length).toBeGreaterThan(0);
  expect(ISO_8601.test(payload.timestamp)).toBe(true);
  expect(typeof payload.context).toBe('object');
  expect(payload.context).not.toBeNull();

  // 3. Sensitive keys must be masked (never raw).
  expect(payload.context.bearer).toBe('[REDACTED]');
  expect(payload.context.authorization).toBe('[REDACTED]');
  expect(payload.context.cookie).toBe('[REDACTED]');
  expect(payload.context.slug).toBe('plan-default');
  expect(payload.context.role).toBe('plan');

  // 4. Serializes cleanly (JSON round-trip = same shape).
  const roundtripped = JSON.parse(JSON.stringify(payload));
  expect(roundtripped.code).toBe(payload.code);
  expect(roundtripped.context).toEqual(payload.context);
}

/** Normalize a payload for snapshotting — strip volatile fields. */
function normalize(payload: Payload): Record<string, unknown> {
  const { timestamp, ...rest } = payload;
  expect(ISO_8601.test(timestamp)).toBe(true);
  return { ...rest, timestamp: '<ISO-8601>' };
}

const LOGGER_VARIANTS: ReadonlyArray<{
  label: string;
  build: () => { logger: unknown; consoleMock: Mock };
}> = [
  {
    label: 'full surface (error, warn, info, debug, console, stackTrace)',
    build: () => {
      const consoleMock = vi.fn();
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        console: consoleMock,
        stackTrace: vi.fn(),
      };
      return { logger, consoleMock };
    },
  },
  {
    label: 'minimum surface (error + console only)',
    build: () => {
      const consoleMock = vi.fn();
      const logger = { error: vi.fn(), console: consoleMock };
      return { logger, consoleMock };
    },
  },
  {
    label: 'stackTrace defined but returns undefined',
    build: () => {
      const consoleMock = vi.fn();
      const logger = {
        error: vi.fn(),
        console: consoleMock,
        stackTrace: vi.fn().mockReturnValue(undefined),
      };
      return { logger, consoleMock };
    },
  },
  {
    label: 'warn + debug present, stackTrace missing',
    build: () => {
      const consoleMock = vi.fn();
      const logger = {
        error: vi.fn(),
        console: consoleMock,
        warn: vi.fn(),
        debug: vi.fn(),
      };
      return { logger, consoleMock };
    },
  },
  {
    label: 'forward-compat (extra unknown methods: metric, trace)',
    build: () => {
      const consoleMock = vi.fn();
      const logger = {
        error: vi.fn(),
        console: consoleMock,
        metric: vi.fn(),
        trace: vi.fn(),
      };
      return { logger, consoleMock };
    },
  },
];

describe('logDiagnosticFromCode — structured payload schema (all logger variants)', () => {
  beforeEach(() => uninstallLogger());
  afterEach(() => uninstallLogger());

  for (const variant of LOGGER_VARIANTS) {
    it(`emits schema-valid payload — ${variant.label}`, () => {
      const { logger, consoleMock } = variant.build();
      installLogger(logger);
      logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
      const payload = extractPayload(consoleMock);
      assertPayloadSchema(payload);
    });
  }

  it('payload snapshot is stable across every logger variant (volatile fields normalized)', () => {
    const normalized: Record<string, unknown>[] = [];
    for (const variant of LOGGER_VARIANTS) {
      const { logger, consoleMock } = variant.build();
      installLogger(logger);
      logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
      normalized.push(normalize(extractPayload(consoleMock)));
      uninstallLogger();
    }
    // Every variant must produce byte-identical payloads (bar timestamp).
    for (let i = 1; i < normalized.length; i++) {
      expect(normalized[i]).toEqual(normalized[0]);
    }
    // Freeze the exact shape as a snapshot. Any drift (new key, renamed
    // field, changed severity/area/action) will fail here and force an
    // intentional update.
    expect(normalized[0]).toMatchInlineSnapshot(`
      {
        "action": "EDIT",
        "area": "PROMPT",
        "code": "PROMPT_EDIT_E001",
        "context": {
          "action": "edit",
          "authorization": "[REDACTED]",
          "bearer": "[REDACTED]",
          "cookie": "[REDACTED]",
          "reason": "row missing",
          "role": "plan",
          "slug": "plan-default",
        },
        "message": "[PROMPT_EDIT_E001] Cannot open the plan prompt editor for "plan-default": row missing.",
        "severity": "error",
        "timestamp": "<ISO-8601>",
      }
    `);
  });

  it('adds a well-formed `cause` block when an underlying error is passed', () => {
    const consoleMock = vi.fn();
    installLogger({ error: vi.fn(), console: consoleMock });
    const underlying = new Error('sqlite: no such row');
    logDiagnosticFromCode('PROMPT_EDIT_E001', CTX, underlying);
    const payload = extractPayload(consoleMock);
    assertPayloadSchema(payload);
    expect(payload.cause).toBeDefined();
    expect(payload.cause?.name).toBe('Error');
    expect(payload.cause?.message).toBe('sqlite: no such row');
    // stack is optional; when present it must be a string.
    if (payload.cause?.stack !== undefined) {
      expect(typeof payload.cause.stack).toBe('string');
    }
  });

  it('omits `cause` entirely when no underlying error is supplied', () => {
    const consoleMock = vi.fn();
    installLogger({ error: vi.fn(), console: consoleMock });
    logDiagnosticFromCode('PROMPT_EDIT_E001', CTX);
    const payload = extractPayload(consoleMock);
    expect('cause' in payload).toBe(false);
  });
});
