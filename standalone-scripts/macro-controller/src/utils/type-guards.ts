/**
 * Type guard to check if a value is a plain object (not null, not array, is object).
 */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Type guard to check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Truthiness check matching Handlebars conventions.
 */
export function isTruthy(value: string | number | boolean | null | undefined): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === '') {
    return false;
  }

  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  return true;
}

/**
 * Checks if a number is finite and non-negative.
 */
export function isFiniteNonNegative(n: number | undefined | null): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}
