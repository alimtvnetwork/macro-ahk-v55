import { describe, expect, it } from 'vitest';

import { toDiagnosticId } from '../diagnostic-error';

describe('toDiagnosticId', () => {
  it('returns the sentinel for undefined', () => {
    expect(toDiagnosticId(undefined)).toBe('(unset)');
  });

  it('respects a custom fallback for undefined', () => {
    expect(toDiagnosticId(undefined, 'n/a')).toBe('n/a');
  });

  it('preserves null (a valid DiagnosticContextValue)', () => {
    expect(toDiagnosticId(null)).toBeNull();
  });

  it('passes strings through unchanged', () => {
    expect(toDiagnosticId('prompt-42')).toBe('prompt-42');
  });

  it('passes empty strings through (distinct from unset)', () => {
    expect(toDiagnosticId('')).toBe('');
  });

  it('passes numbers through unchanged', () => {
    expect(toDiagnosticId(7)).toBe(7);
  });

  it('passes booleans through unchanged', () => {
    expect(toDiagnosticId(false)).toBe(false);
  });
});
