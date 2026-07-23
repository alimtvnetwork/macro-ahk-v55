/**
 * Vitest suite for `validatePromptsBundle` (plan 12 step 24).
 *
 * Loads every fixture under `test/fixtures/prompt-bundles/` and locks the
 * envelope invariants that the three importers (JSON, ZIP, SQLite) all
 * rely on. If this suite goes red, at least one importer is about to
 * accept bytes that a well-formed exporter would never produce — that is
 * the definition of a schema break for plan 12.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildPromptsBundle,
  validatePromptsBundle,
  PROMPTS_BUNDLE_SCHEMA_VERSION,
} from '../prompt-bundle-types';
import type { PromptEntry } from '../../types/ui-types';

function loadFixture(name: string): unknown {
  const path = resolve(__dirname, '../../../../../test/fixtures/prompt-bundles', name);
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('validatePromptsBundle — valid fixtures', () => {
  it('accepts the minimal single-entry bundle', () => {
    const result = validatePromptsBundle(loadFixture('valid-minimal.json'));
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.bundle?.entries).toHaveLength(1);
    expect(result.bundle?.entries[0]?.name).toBe('Hello');
    expect(result.bundle?.format).toBe('json');
  });

  it('round-trips every optional field on the full fixture', () => {
    const result = validatePromptsBundle(loadFixture('valid-full.json'));
    expect(result.isValid).toBe(true);
    expect(result.bundle?.entryCount).toBe(3);
    const dynamic = result.bundle?.entries[0];
    expect(dynamic?.slugTemplate).toBe('next-${N}');
    expect(dynamic?.replaceValues).toEqual(['2', '3', '5']);
    expect(dynamic?.parentSlug).toBe('next-n');
    expect(dynamic?.isDynamic).toBe(true);
    expect(result.bundle?.format).toBe('zip');
  });
});

describe('validatePromptsBundle — invalid fixtures', () => {
  it('rejects a non-UUID id', () => {
    const result = validatePromptsBundle(loadFixture('invalid-bad-uuid.json'));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/malformed id/i);
  });

  it('rejects schemaVersion !== 1', () => {
    const result = validatePromptsBundle(loadFixture('invalid-schema-version.json'));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/schemaVersion must equal 1/);
  });

  it('rejects entryCount mismatch', () => {
    const result = validatePromptsBundle(loadFixture('runtime-invalid-count-mismatch.json'));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/entryCount \(5\).*!=.*\(1\)/);
  });

  it('rejects entries missing required name', () => {
    const result = validatePromptsBundle(loadFixture('invalid-entry-missing-name.json'));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/entries\[1\] missing required name\/text/);
  });

  it('rejects non-array entries', () => {
    const result = validatePromptsBundle(loadFixture('invalid-entries-not-array.json'));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/entries must be an array/);
  });

  it('rejects a null root', () => {
    const result = validatePromptsBundle(null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Bundle root is not an object');
  });

  it('rejects an array root', () => {
    const result = validatePromptsBundle([]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Bundle root is not an object');
  });
});

describe('validatePromptsBundle — build/validate round-trip', () => {
  const entries: PromptEntry[] = [
    { name: 'A', text: 'aaa' },
    { name: 'B', text: 'bbb', slug: 'b', tags: ['x'] },
    { name: 'Hidden', text: 'nope', excludeFromExport: true },
  ];

  it('output of buildPromptsBundle round-trips through validatePromptsBundle', () => {
    const built = buildPromptsBundle(entries, '4.43.0', { format: 'json' });
    expect(built.schemaVersion).toBe(PROMPTS_BUNDLE_SCHEMA_VERSION);
    expect(built.entryCount).toBe(2); // excludeFromExport filtered out by default
    const result = validatePromptsBundle(JSON.parse(JSON.stringify(built)));
    expect(result.isValid).toBe(true);
    expect(result.bundle?.entries.map((e) => e.name)).toEqual(['A', 'B']);
    expect(result.bundle?.format).toBe('json');
  });

  it('keeps excluded entries when includeExcluded=true', () => {
    const built = buildPromptsBundle(entries, '4.43.0', { includeExcluded: true });
    expect(built.entryCount).toBe(3);
    const result = validatePromptsBundle(JSON.parse(JSON.stringify(built)));
    expect(result.isValid).toBe(true);
    expect(result.bundle?.entries).toHaveLength(3);
  });

  it('rejects a rebuilt bundle whose entryCount is manually corrupted', () => {
    const built = buildPromptsBundle(entries, '4.43.0');
    const corrupted = { ...built, entryCount: 99 };
    const result = validatePromptsBundle(JSON.parse(JSON.stringify(corrupted)));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toMatch(/entryCount/);
  });
});
