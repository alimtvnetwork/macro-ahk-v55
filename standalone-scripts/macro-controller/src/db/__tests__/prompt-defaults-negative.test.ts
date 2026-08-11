import { describe, it, expect } from 'vitest';
import { getDefaultBody } from '../prompt-defaults';
import { DiagnosticError } from '../../errors/diagnostic-error';

describe('getDefaultBody negative path (Plan 22 gap #6)', () => {
  it('throws DiagnosticError for unknown role/slug instead of returning empty string', () => {
    let thrownError: unknown = null;
    try {
      getDefaultBody('plan', 'unknown-slug-123');
    } catch (e) {
      thrownError = e;
    }
    
    expect(thrownError).toBeInstanceOf(DiagnosticError);
    const diag = thrownError as DiagnosticError;
    expect(diag.code).toBe('PROMPT_DEFAULTS_E001');
    expect(diag.context).toEqual({ role: 'plan', slug: 'unknown-slug-123', reason: 'unknown role/slug' });
  });
});
