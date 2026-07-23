/**
 * Conflict resolver truth table (plan 12 step 26).
 *
 * Locks the 4 x 4 matrix that governs the import preview modal:
 *
 *                 add   overwrite   skip   rename
 *   new           ✅    ❌          ✅     ❌
 *   update        ❌    ✅          ✅     ✅
 *   identical     ❌    ✅          ✅     ✅
 *   duplicate     ❌    ✅          ✅     ✅
 *
 * The default action per conflict state (SS-05):
 *   new -> add, update -> overwrite, identical -> skip, duplicate -> skip
 *
 * The `classifyRow` function must produce the correct conflict state
 * given the incoming entry and the matching cache entry (if any). This
 * suite exercises all three branches: no match -> new, deep-equal ->
 * identical, deep-unequal -> update. `duplicate` is only produced when
 * two rows in the SAME incoming bundle share a slug; that is exercised
 * by `diffAgainstCache` at a higher level and covered in step 27.
 */

import { describe, expect, it } from 'vitest';
import {
  allowedActionsFor,
  classifyRow,
  defaultActionFor,
  type ConflictState,
  type RowAction,
} from '../prompt-import-modal';
import type { PromptEntry } from '../../types/ui-types';
import type { CachedPromptEntry } from '../prompt-cache';

const CONFLICTS: ConflictState[] = ['new', 'update', 'identical', 'duplicate'];
const ACTIONS: RowAction[] = ['add', 'overwrite', 'skip', 'rename'];

const EXPECTED_ALLOWED: Record<ConflictState, RowAction[]> = {
  new: ['add', 'skip'],
  update: ['overwrite', 'skip', 'rename'],
  identical: ['overwrite', 'skip', 'rename'],
  duplicate: ['overwrite', 'skip', 'rename'],
};

const EXPECTED_DEFAULT: Record<ConflictState, RowAction> = {
  new: 'add',
  update: 'overwrite',
  identical: 'skip',
  duplicate: 'skip',
};

describe('allowedActionsFor — 4 x 4 truth table', () => {
  CONFLICTS.forEach((conflict) => {
    ACTIONS.forEach((action) => {
      const shouldAllow = EXPECTED_ALLOWED[conflict].includes(action);
      const label = shouldAllow ? 'allows' : 'rejects';
      it(`${conflict} ${label} ${action}`, () => {
        expect(allowedActionsFor(conflict).includes(action)).toBe(shouldAllow);
      });
    });
  });

  it('lists exactly two options for `new`', () => {
    expect(allowedActionsFor('new').sort()).toEqual(['add', 'skip']);
  });

  it('lists exactly three options for every conflicting state', () => {
    (['update', 'identical', 'duplicate'] as ConflictState[]).forEach((c) => {
      expect(allowedActionsFor(c).sort()).toEqual(['overwrite', 'rename', 'skip']);
    });
  });
});

describe('defaultActionFor — SS-05 defaults', () => {
  CONFLICTS.forEach((conflict) => {
    it(`${conflict} defaults to ${EXPECTED_DEFAULT[conflict]}`, () => {
      expect(defaultActionFor(conflict)).toBe(EXPECTED_DEFAULT[conflict]);
    });
  });

  it('every default is inside the corresponding allowed set', () => {
    CONFLICTS.forEach((c) => {
      expect(allowedActionsFor(c)).toContain(defaultActionFor(c));
    });
  });
});

describe('classifyRow — branch coverage', () => {
  const incoming: PromptEntry = { name: 'Alpha', slug: 'alpha', text: 'body' };
  const cachedIdentical: CachedPromptEntry = { name: 'Alpha', slug: 'alpha', text: 'body' } as CachedPromptEntry;
  const cachedDifferent: CachedPromptEntry = { name: 'Alpha', slug: 'alpha', text: 'body v2' } as CachedPromptEntry;

  it('no cache match -> new + add', () => {
    const row = classifyRow(incoming, undefined);
    expect(row.conflict).toBe('new');
    expect(row.action).toBe('add');
  });

  it('deep-equal cache match -> identical + skip', () => {
    const row = classifyRow(incoming, cachedIdentical);
    expect(row.conflict).toBe('identical');
    expect(row.action).toBe('skip');
  });

  it('deep-unequal cache match -> update + overwrite', () => {
    const row = classifyRow(incoming, cachedDifferent);
    expect(row.conflict).toBe('update');
    expect(row.action).toBe('overwrite');
  });

  it('preserves the incoming entry verbatim on the row', () => {
    const row = classifyRow(incoming, undefined);
    expect(row.incoming).toBe(incoming);
    expect(row.slug).toBe('alpha');
    expect(row.name).toBe('Alpha');
  });
});
