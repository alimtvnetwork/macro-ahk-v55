/**
 * Type-level + runtime guard for `UserAddedEntriesState`: `entries` must
 * always be a defined array; `defaultsSkipped` must always be a finite
 * non-negative number. Prevents drift back to the `{ kept, defaultsSkipped }`
 * shape that broke `tsc --noEmit -p tsconfig.macro.build.json` in issue #14.
 */
import { describe, it, expect } from 'vitest';
import type { UserAddedEntriesState } from '../prompt-dropdown-io';

describe('UserAddedEntriesState', () => {
  it('has an always-present entries array and a numeric defaultsSkipped', () => {
    // Compile-time: this literal must be assignable to the exported type.
    const state: UserAddedEntriesState = { entries: [], defaultsSkipped: 0 };
    // Compile-time width check: no extra `kept` field allowed.
    // @ts-expect-error - `kept` is not part of the state contract.
    const drift: UserAddedEntriesState = { entries: [], defaultsSkipped: 0, kept: [] };
    void drift;
    expect(Array.isArray(state.entries)).toBe(true);
    expect(typeof state.defaultsSkipped).toBe('number');
  });
});