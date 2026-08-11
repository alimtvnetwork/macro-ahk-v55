import { describe, it, expect } from 'vitest';
import { substituteToken } from '../token-substitute';
import { DiagnosticError } from '../../errors/diagnostic-error';

describe('substituteToken negative (Plan 22 gap #7)', () => {
  it('throws DiagnosticError when value is missing', () => {
    let thrownError: unknown = null;
    try {
      substituteToken('body {{n}}', 'n', '');
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(DiagnosticError);
    expect((thrownError as DiagnosticError).code).toBe('PROMPT_TOKEN_E001');
  });

  it('throws DiagnosticError when value is zero', () => {
    let thrownError: unknown = null;
    try {
      substituteToken('body {{n}}', 'n', 0);
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(DiagnosticError);
    expect((thrownError as DiagnosticError).code).toBe('PROMPT_TOKEN_E001');
  });

  it('throws DiagnosticError when value is non-integer', () => {
    let thrownError: unknown = null;
    try {
      substituteToken('body {{n}}', 'n', 1.5);
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(DiagnosticError);
    expect((thrownError as DiagnosticError).code).toBe('PROMPT_TOKEN_E001');
  });

  it('throws DiagnosticError when value is NaN/string not number', () => {
    let thrownError: unknown = null;
    try {
      substituteToken('body {{n}}', 'n', 'abc');
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(DiagnosticError);
    expect((thrownError as DiagnosticError).code).toBe('PROMPT_TOKEN_E001');
  });
});
