/**
 * Unit tests — WireWorkspace guard + narrow.
 */

import { describe, it, expect } from 'vitest';
import { isWireWorkspace, toWireWorkspace } from '../wire-workspace';

describe('isWireWorkspace', () => {
  it('accepts an object with a non-empty string id', () => {
    expect(isWireWorkspace({ id: 'ws-1' })).toBe(true);
  });

  it('rejects null, primitives, and missing id', () => {
    expect(isWireWorkspace(null)).toBe(false);
    expect(isWireWorkspace('ws-1')).toBe(false);
    expect(isWireWorkspace({})).toBe(false);
    expect(isWireWorkspace({ id: '' })).toBe(false);
    expect(isWireWorkspace({ id: 42 })).toBe(false);
  });
});

describe('toWireWorkspace', () => {
  it('reads all four wire fields as strings with safe defaults', () => {
    const wire = toWireWorkspace({ id: 'ws-1', name: 'Acme', plan: 'pro_1', tier: 'PRO' });
    expect(wire).toEqual({ id: 'ws-1', name: 'Acme', plan: 'pro_1', tier: 'PRO' });
  });

  it('coerces missing/non-string fields to empty strings (never leaks unknown)', () => {
    const wire = toWireWorkspace({ id: 'ws-2', plan: 42 as unknown as string });
    expect(wire).toEqual({ id: 'ws-2', name: '', plan: '', tier: '' });
  });
});
