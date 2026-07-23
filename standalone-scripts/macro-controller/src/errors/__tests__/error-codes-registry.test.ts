/**
 * Plan 26 / step 17 — Runtime Vitest suite for the ERROR_CODES registry.
 *
 * The static CI gate (`scripts/check-error-codes-unique.mjs`) parses the file
 * as text. This suite exercises the *runtime* object so a regression that
 * survives static parsing (deep-frozen mutation, placeholder drift, silent
 * severity typo, template referencing an undeclared context key) fails a
 * unit test rather than leaking a broken toast into production.
 *
 * Root cause this suite guards against (one sentence):
 * Without a runtime registry test, a PR could add a `{placeholder}` to
 * `humanTemplate`, forget it in `requiredContextKeys`, and only fail at
 * throw time deep in a user-facing surface as a `DiagnosticMetaError`.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_ERROR_CODES,
  ERROR_CODES,
  extractTemplatePlaceholders,
  getErrorCodeEntry,
  type ErrorArea,
  type ErrorCodeEntry,
  type ErrorSeverity,
} from '../error-codes';
import { DiagnosticError, DiagnosticMetaError } from '../diagnostic-error';
import { formatDiagnosticToast } from '../format';

// ────────────────────────────────────────────────────────────────────────
// Reference sets — kept in sync with error-codes.ts via runtime assertions.
// ────────────────────────────────────────────────────────────────────────
const VALID_SEVERITIES: readonly ErrorSeverity[] = ['fatal', 'error', 'warn', 'info'];
const VALID_AREAS: readonly ErrorArea[] = [
  'PROMPT', 'PROMPT_IO', 'SEED', 'HEALTH', 'REPAIR', 'HISTORY', 'DB',
  'HTTP', 'SDK', 'WS_MEMBERS', 'WS_MOVE', 'WS_CONTEXT', 'REMIX', 'RENAME',
  'GITSYNC', 'CREDIT', 'PROZERO', 'SETTINGS', 'SPLITTER', 'TELEMETRY', 'UI',
  'ASYNC', 'LOOP', 'QUEUE', 'TYPE',
];
const CODE_SHAPE = /^[A-Z][A-Z_]*_E\d{3}$/;

/**
 * Build a synthetic context that satisfies `requiredContextKeys` and every
 * placeholder in the template — used to prove each entry can round-trip
 * through DiagnosticError + formatDiagnosticToast without meta-errors.
 */
function synthContext(entry: ErrorCodeEntry): Record<string, string | number | boolean> {
  const context: Record<string, string | number | boolean> = {};
  const keys = new Set<string>([
    ...entry.requiredContextKeys,
    ...extractTemplatePlaceholders(entry.humanTemplate),
    ...extractTemplatePlaceholders(entry.nextFixHint ?? ''),
  ]);
  for (const key of keys) {
    // Numeric-looking keys get numbers; everything else is a benign string.
    if (/count|status|ms|elapsed|initial|final|fixed|still|newly|revisionId|promptId/i.test(key)) {
      context[key] = 1;
    } else if (/^(bodyMatches|nameMatches|force)$/i.test(key)) {
      context[key] = true;
    } else {
      context[key] = 'test-' + key;
    }
  }
  return context;
}

// ────────────────────────────────────────────────────────────────────────
// Frozen-object invariants
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — frozen object invariants', () => {
  it('the top-level ERROR_CODES object is frozen', () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
  });

  it('mutating a registered entry throws in strict mode', () => {
    'use strict';
    expect(() => {
      (ERROR_CODES as unknown as Record<string, unknown>).INJECTED_E001 = { code: 'INJECTED_E001' };

    }).toThrow();
  });

  it('ALL_ERROR_CODES matches Object.keys(ERROR_CODES) exactly', () => {
    expect([...ALL_ERROR_CODES].sort()).toEqual(Object.keys(ERROR_CODES).sort());
  });

  it('ALL_ERROR_CODES is frozen', () => {
    expect(Object.isFrozen(ALL_ERROR_CODES)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Per-entry shape + uniqueness
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — per-entry shape', () => {
  it('has no duplicate codes', () => {
    const seen = new Set<string>();
    for (const key of Object.keys(ERROR_CODES)) {
      expect(seen.has(key), `duplicate code: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it.each(Object.entries(ERROR_CODES))('entry key equals entry.code — %s', (key, entry) => {
    expect(entry.code).toBe(key);
  });

  it.each(Object.entries(ERROR_CODES))('code matches <AREA>_<VERB>_E<NNN> shape — %s', (_, entry) => {
    expect(entry.code).toMatch(CODE_SHAPE);
  });

  it.each(Object.entries(ERROR_CODES))('area is a registered ErrorArea — %s', (_, entry) => {
    expect(VALID_AREAS).toContain(entry.area);
  });

  it.each(Object.entries(ERROR_CODES))('severity is a valid ErrorSeverity — %s', (_, entry) => {
    expect(VALID_SEVERITIES).toContain(entry.severity);
  });

  it.each(Object.entries(ERROR_CODES))('humanTemplate is non-empty and does not start with "Failed" bare — %s', (_, entry) => {
    expect(entry.humanTemplate.length).toBeGreaterThan(0);
    // Wording contract W1: body must state what failed, never bare "Failed."
    expect(entry.humanTemplate).not.toMatch(/^\s*(Failed|Error)\s*[.:!]?\s*$/);
  });

  it.each(Object.entries(ERROR_CODES))('code prefix matches area — %s', (_, entry) => {
    // e.g. PROMPT_VALIDATE_E001 must start with the area token or an accepted alias.
    // PROMPT_IO -> PROMPT_IO_, DB -> DB_, etc.
    const prefix = entry.area + '_';
    expect(entry.code.startsWith(prefix)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Placeholder <-> requiredContextKeys coverage
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — placeholder coverage', () => {
  it.each(Object.entries(ERROR_CODES))(
    'every {placeholder} in humanTemplate is declared in requiredContextKeys — %s',
    (_, entry) => {
      const placeholders = extractTemplatePlaceholders(entry.humanTemplate);
      for (const name of placeholders) {
        expect(
          entry.requiredContextKeys.includes(name),
          `code ${entry.code}: placeholder {${name}} in humanTemplate is not in requiredContextKeys`,
        ).toBe(true);
      }
    },
  );

  it('extractTemplatePlaceholders ignores the {{n}} prompt-body token', () => {
    // {{n}} is used inside prompt bodies, not as a diagnostic template variable.
    // The extractor must never surface it as a context key requirement.
    expect(extractTemplatePlaceholders('Save {role} prompt with {{n}} token')).toEqual(['role']);
  });

  it('extractTemplatePlaceholders returns each name only once', () => {
    expect(extractTemplatePlaceholders('{a} then {a} then {b}')).toEqual(['a', 'b']);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Round-trip: every entry survives DiagnosticError + formatDiagnosticToast
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — round-trip through DiagnosticError', () => {
  it.each(Object.entries(ERROR_CODES))(
    'DiagnosticError(%s, synthContext) does not throw a meta-error and interpolates every placeholder',
    (_, entry) => {
      const context = synthContext(entry);
      const err = new DiagnosticError(entry.code, context);
      // After interpolation, the message must not contain any leftover {name}
      // placeholders (except the {{n}} prompt-body sentinel, which is escaped).
      const leftover = err.message.replace(/\{\{n\}\}/g, '').match(/(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
      expect(leftover, `code ${entry.code}: leftover placeholder in message "${err.message}"`).toBeNull();
      expect(err.code).toBe(entry.code);
      expect(err.severity).toBe(entry.severity);
    },
  );

  it.each(Object.entries(ERROR_CODES))(
    'formatDiagnosticToast(%s, synthContext) yields a professional toast payload',
    (_, entry) => {
      const context = synthContext(entry);
      const toast = formatDiagnosticToast(entry.code, context);
      expect(toast.footerCode).toBe('code=' + entry.code);
      expect(toast.title.length).toBeGreaterThan(0);
      expect(toast.body.length).toBeGreaterThan(0);
      // No leftover unfilled variables anywhere.
      expect(toast.body).not.toMatch(/(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
      expect(toast.title).not.toMatch(/(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
    },
  );

  it('DiagnosticError throws DiagnosticMetaError when a required context key is missing', () => {
    // PROMPT_VALIDATE_E001 requires role, slug, expected, actual, ruleId.
    expect(() => new DiagnosticError('PROMPT_VALIDATE_E001', { role: 'plan', slug: 's' })).toThrow(
      DiagnosticMetaError,
    );
  });

  it('DiagnosticError throws DiagnosticMetaError for an unknown code', () => {
    expect(() => new DiagnosticError('NOT_A_REAL_CODE_E999', {})).toThrow(DiagnosticMetaError);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Deprecation policy
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — deprecation policy', () => {
  it('every deprecated entry names its replacement, and the replacement exists', () => {
    for (const entry of Object.values(ERROR_CODES)) {
      if (entry.deprecated) {
        expect(
          entry.replacedBy,
          `deprecated code ${entry.code} must set replacedBy`,
        ).toBeDefined();
        expect(
          getErrorCodeEntry(entry.replacedBy as string),
          `replacedBy target ${entry.replacedBy} for ${entry.code} not found in registry`,
        ).toBeDefined();
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Sanity: the registry stays large enough to cover every migrated area
// ────────────────────────────────────────────────────────────────────────
describe('ERROR_CODES registry — area coverage', () => {
  const MIGRATED_AREAS: readonly ErrorArea[] = [
    'PROMPT', 'PROMPT_IO', 'SEED', 'HEALTH', 'REPAIR', 'HISTORY', 'DB', 'UI',
  ];

  it.each(MIGRATED_AREAS)('area %s has at least one entry', (area) => {
    const hits = Object.values(ERROR_CODES).filter((e) => e.area === area);
    expect(hits.length, `area ${area} has no registry entries`).toBeGreaterThan(0);
  });
});
