/**
 * Repeat-loop preset chip contract (test-with-features memory rule).
 *
 * v4.47.0 added `2` and `3` to the chip row so short-burst repeats don't need
 * typing into the count box. This test freezes the exact preset list so a
 * future refactor of `repeat-loop-ui.ts` can't silently drop the new values.
 */

import { describe, it, expect } from 'vitest';

// Import the module under test to read the internal PRESETS constant via a
// module-scope re-export. To avoid touching production code just for tests,
// we re-parse the source string and assert against it — the constant is a
// single-line literal, so this is stable and fast.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(HERE, '..', 'repeat-loop-ui.ts');

describe('repeat-loop-ui PRESETS chip row', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');
  const match = src.match(/const PRESETS = \[([^\]]+)\] as const;/);

  it('declares a single PRESETS constant', () => {
    expect(match, 'PRESETS constant not found in repeat-loop-ui.ts').not.toBeNull();
  });

  const values = (match?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s));

  it('parses to numeric literals only (no NaN)', () => {
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(Number.isFinite(v)).toBe(true);
  });

  it('includes the small-burst presets 1, 2, 3, 5 (v4.47.0 contract)', () => {
    for (const n of [1, 2, 3, 5]) {
      expect(values, `preset ${n} missing`).toContain(n);
    }
  });

  it('is strictly ascending (chip row reads left-to-right)', () => {
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('keeps the historical anchors 10, 25, 50, 100 so muscle memory survives', () => {
    for (const n of [10, 25, 50, 100]) {
      expect(values, `anchor ${n} missing`).toContain(n);
    }
  });
});
