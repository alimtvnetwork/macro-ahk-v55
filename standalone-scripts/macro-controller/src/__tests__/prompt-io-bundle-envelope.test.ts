/**
 * Plan 22 gap #10 (applyBundle positive + schema-version-mismatch negative)
 * and part of gap #9 (bundle envelope parsing).
 *
 * Root cause pinned: `parseBundleEnvelope` in `ui/prompt-io.ts` is the only
 * choke point that decides whether a v1 bundle is honored, degraded to a bare
 * array (legacy), or reported with per-entry JSON-pointer errors. It also
 * carries revision rows onward. None of that behavior had a direct unit test,
 * so a silent regression (e.g., schemaVersion drift, revision-drop, or
 * legacy fallback swallowing envelope errors) would not fail CI.
 *
 * These tests are pure: no DB, no dynamic imports.
 */
import { describe, it, expect } from 'vitest';
import { parsePromptsText, applyRoleFilter } from '../ui/prompt-io';
import { PROMPTS_BUNDLE_SCHEMA_VERSION } from '../ui/prompt-bundle-types';
import type { CachedPromptEntry } from '../ui/prompt-cache';

function makeEnvelope(overrides: Record<string, unknown> = {}): string {
  const base = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    schemaVersion: PROMPTS_BUNDLE_SCHEMA_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    exporterVersion: '4.286.0',
    entryCount: 1,
    entries: [{ name: 'P1', text: 'body', slug: 'p1', role: 'plan' }],
  };
  return JSON.stringify({ ...base, ...overrides });
}

describe('parsePromptsText - bundle envelope (Plan 22 gap #9/#10)', () => {
  it('B1: accepts a valid v1 envelope and returns typed entries', () => {
    const { valid, errors, revisions } = parsePromptsText(makeEnvelope());
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0]?.slug).toBe('p1');
    expect(revisions).toBeUndefined();
  });

  it('B2: carries revisions when the envelope supplies well-formed rows', () => {
    const json = makeEnvelope({
      revisions: [
        {
          Slug: 'p1', Name: 'P1', Body: 'v1', Role: 'plan',
          ReplaceKey: '{{n}}', ReplaceValues: '["1"]', CreatedAt: 1, Reason: 'seed',
        },
      ],
    });
    const { valid, revisions } = parsePromptsText(json);
    expect(valid).toHaveLength(1);
    expect(revisions).toBeDefined();
    expect(revisions).toHaveLength(1);
    expect(revisions?.[0]?.Slug).toBe('p1');
  });

  it('B3: rejects schema-version drift and surfaces the envelope error', () => {
    const json = makeEnvelope({ schemaVersion: 999 });
    const { valid, errors, revisions } = parsePromptsText(json);
    expect(valid).toEqual([]);
    expect(revisions).toBeUndefined();
    expect(errors.some((e) => e.includes(`schemaVersion must equal ${PROMPTS_BUNDLE_SCHEMA_VERSION}`))).toBe(true);
  });

  it('B4: on invalid envelope with valid entries[], reports per-index JSON pointers for the bad rows', () => {
    // Malformed id triggers envelope-level failure; entries[] fallback path
    // records per-index errors for rows missing name/text.
    const json = JSON.stringify({
      id: 'not-a-uuid',
      schemaVersion: PROMPTS_BUNDLE_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      exporterVersion: '4.286.0',
      entryCount: 2,
      entries: [{ name: 'P1', text: 't' }, { text: 'missing-name' }],
    });
    const { valid, errors } = parsePromptsText(json);
    // envelope invalid -> valid[] not populated from the envelope path
    expect(valid).toEqual([]);
    // Per-entry errors surfaced with /entries/<i>/... JSON pointer
    expect(errors.some((e) => e.startsWith('/entries/1'))).toBe(true);
  });

  it('B5: bare-array fallback still parses when there is no envelope shape', () => {
    const json = JSON.stringify([{ name: 'A', text: 'a' }, { name: 'B', text: 'b' }]);
    const { valid, errors, revisions } = parsePromptsText(json);
    expect(valid).toHaveLength(2);
    expect(errors).toEqual([]);
    expect(revisions).toBeUndefined();
  });
});

describe('applyRoleFilter (Plan 22 gap #9 - role-scoped partitioning)', () => {
  const entries: CachedPromptEntry[] = [
    { name: 'A', text: 'a', slug: 'a', role: 'plan' },
    { name: 'B', text: 'b', slug: 'b', role: 'next' },
    { name: 'C', text: 'c', slug: 'c' }, // no role -> dropped when filter set
    // @ts-expect-error - intentional invalid role to lock the guard path
    { name: 'D', text: 'd', slug: 'd', role: 'bogus' },
  ];

  it('R1: returns all entries and droppedCount=0 when no filter is given', () => {
    const { kept, droppedCount } = applyRoleFilter(entries, undefined);
    expect(kept).toHaveLength(entries.length);
    expect(droppedCount).toBe(0);
  });

  it('R2: keeps only entries matching the filter and counts invalid/missing roles as dropped', () => {
    const { kept, droppedCount } = applyRoleFilter(entries, 'plan');
    expect(kept.map((e) => e.slug)).toEqual(['a']);
    expect(droppedCount).toBe(3);
  });

  it('R3: empty input yields empty kept and zero dropped', () => {
    const { kept, droppedCount } = applyRoleFilter([], 'plan');
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(0);
  });
});
