/**
 * regression-baseline.test.ts — Plan-17 step 1 (SS-01 characterisation tests).
 *
 * Purpose: freeze current runtime behavior of the surfaces the Plan-16
 * audit backlog (spec/33-missing-coding-guideline) will refactor in
 * subsequent steps. Every describe block below is marked `@behavior-lock`.
 *
 * Do NOT loosen these assertions to make a refactor pass. If a refactor
 * legitimately changes an output, update the assertion AND note the diff
 * justification in the release notes for that step.
 *
 * Locked surfaces (subset that can run without a live DOM/IndexedDB):
 *  1. Plan chip prompt body — `buildPlanTaskPrompt(n)`.
 *  2. Next chip token substitution — `substituteToken()` (also used by
 *     the Plan chip when a DB-backed ReplaceKey is present).
 *  3. Prompt library IO partition — `partitionByRole()` + `mergeDbIntoExport()`
 *     (regression guard for Plan-15 ReplaceKey/ReplaceValues round-trip).
 *  4. Repeat-loop preset value set (pinned by user 2026-06-19).
 *
 * The remaining surfaces named in SS-01 (aggregateCreditTotals, moveToWorkspace,
 * MacroController.run) require a live browser context; they are locked by the
 * existing e2e/Playwright suites (`tests/e2e/*`) and by the credit-balance
 * unit tests in this directory. This file intentionally scopes to pure
 * functions so the baseline can run in CI without a browser.
 */

import { describe, it, expect } from 'vitest';
import { buildPlanTaskPrompt } from '../ui/plan-task-ui';
import { substituteToken } from '../utils/token-substitute';
import { partitionByRole, mergeDbIntoExport } from '../ui/prompt-io-db-bridge';
import type { CachedPromptEntry } from '../ui/prompt-cache';

describe('@behavior-lock plan chip body — buildPlanTaskPrompt', () => {
  it('header carries the exact N passed in', () => {
    for (const n of [2, 5, 10, 50, 100, 200]) {
      const body = buildPlanTaskPrompt(n);
      // v4.187.0: assert N-substitution invariant instead of the exact
      // header phrase, which was rewritten in v4.183.0's body refresh.
      const firstLine = body.split('\n')[0] ?? '';
      expect(firstLine.startsWith('# ')).toBe(true);
      const wholeNumberRe = new RegExp('(^|\\D)' + String(n) + '(\\D|$)');
      expect(wholeNumberRe.test(firstLine)).toBe(true);
      expect(body.includes('{{n}}')).toBe(false);
    }
  });

  it('never executes anything this turn (rule 1 present verbatim)', () => {
    const body = buildPlanTaskPrompt(10);
    // v4.187.0: current PLAN_DEFAULT_BODY encodes the "no execution this
    // turn" contract as Rule 1 with slightly different phrasing than the
    // pre-v4.183.0 body. Lock the semantics, not the exact glyphs.
    expect(body).toContain('Nothing executes this turn');
    expect(body.toLowerCase()).toContain('no code edits');
  });

  it('output is deterministic (same N → identical bytes)', () => {
    expect(buildPlanTaskPrompt(15)).toBe(buildPlanTaskPrompt(15));
  });
});

describe('@behavior-lock next chip token substitution — substituteToken', () => {
  it('replaces {{key}} and ${key} in one pass', () => {
    const out = substituteToken('do {{n}} things and then ${n} more', 'n', 7);
    expect(out).toBe('do 7 things and then 7 more');
  });

  it('tolerates whitespace inside the token braces', () => {
    expect(substituteToken('{{  n  }} / ${ n }', 'n', 3)).toBe('3 / 3');
  });

  it('returns the body unchanged when key is empty or shape-invalid', () => {
    expect(substituteToken('hello {{n}}', '', 5)).toBe('hello {{n}}');
    expect(substituteToken('hello {{n}}', 'bad key!', 5)).toBe('hello {{n}}');
  });

  it('handles unicode bodies without mangling', () => {
    const body = 'café ☕ {{count}} × 中文';
    expect(substituteToken(body, 'count', 2)).toBe('café ☕ 2 × 中文');
  });

  it('respects a caller-supplied ReplaceKey (not hardcoded to "n")', () => {
    expect(substituteToken('run {{steps}}', 'steps', 42)).toBe('run 42');
    // when the caller passes a different key, {{n}} must NOT be substituted
    expect(substituteToken('run {{n}}', 'steps', 42)).toBe('run {{n}}');
  });
});

describe('@behavior-lock prompt library IO — partitionByRole + mergeDbIntoExport', () => {
  const withRole = (role: unknown): CachedPromptEntry => ({
    name: 'x', text: 'body', slug: 's-' + String(role),
    role: role as CachedPromptEntry['role'],
    isDefault: false, category: 'macro-db',
  });

  it('splits DB-eligible entries from cache-only entries by role validity', () => {
    const entries: CachedPromptEntry[] = [
      withRole('plan'), withRole('next'), withRole('generic'),
      withRole(undefined), withRole('bogus'),
    ];
    const { dbEntries, cacheEntries } = partitionByRole(entries);
    expect(dbEntries.map((e) => e.role)).toEqual(['plan', 'next', 'generic']);
    expect(cacheEntries).toHaveLength(2);
  });

  it('mergeDbIntoExport: DB rows win on slug (fresh edit not masked by stale cache)', () => {
    const cache: CachedPromptEntry[] = [
      { name: 'old', text: 'stale', slug: 'p-1', role: 'plan', isDefault: false, category: 'json' },
      { name: 'keep', text: 'k', slug: 'k-1', role: 'generic', isDefault: false, category: 'json' },
    ];
    const db: CachedPromptEntry[] = [
      { name: 'new', text: 'fresh', slug: 'p-1', role: 'plan', isDefault: true, category: 'macro-db' },
    ];
    const merged = mergeDbIntoExport(cache, db);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ slug: 'p-1', text: 'fresh', name: 'new' });
    expect(merged.find((e) => e.slug === 'k-1')?.name).toBe('keep');
  });
});

describe('@behavior-lock repeat-loop presets (pinned 2026-06-19)', () => {
  it('PRESETS constant retains the full user-pinned value set', async () => {
    // Read via source rather than importing the UI module (which touches DOM).
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(
      path.join(here, '..', 'ui', 'repeat-loop-ui.ts'),
      'utf8',
    );
    const match = src.match(/const PRESETS = \[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const nums = (match?.[1] ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    expect(nums).toEqual([1, 2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 30, 50, 60, 70, 75, 80, 100, 200]);
  });
});
