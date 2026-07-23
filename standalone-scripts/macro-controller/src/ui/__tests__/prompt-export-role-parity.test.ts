/**
 * Plan-14 close-out step 2: Export-format parity for role-scoped DB rows.
 *
 * Root cause guarded: JSON, ZIP, and SQLite exports all funnel through
 * `buildPromptsBundle` and (for the DB-truth merge) through
 * `collectAllExportEntries` -> `prompt-io-db-bridge.mergeDbIntoExport`.
 * If any exporter drops the `role` field or diverges on merge order, the
 * cross-machine backup silently loses plan/next/generic classification.
 *
 * This test asserts that for the SAME input set of role-tagged entries:
 *   1. `buildPromptsBundle({format:'json'})` preserves every `role`.
 *   2. `buildPromptsZip(...)` round-tripped through `parsePromptsBundleZip`
 *      returns the identical `(slug, name, role, text)` tuples.
 *   3. Both bundles report the same `entryCount` and the same set of roles.
 *
 * SQLite is intentionally excluded from this suite for the same reason
 * documented in prompt-bundle-roundtrip.test.ts: sql.js wasm cannot be
 * loaded in the Node/jsdom env. The SQLite exporter uses the same
 * upstream `buildPromptsBundle` call, so any envelope-level `role`
 * regression is caught here before it reaches the SQLite writer.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPromptsBundle,
  validatePromptsBundle,
} from '../prompt-bundle-types';
import { buildPromptsZip } from '../prompt-io-zip';
import { parsePromptsBundleZip } from '../prompt-io-zip-reader';
import type { PromptEntry } from '../../types/ui-types';

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

const ROLE_ENTRIES: PromptEntry[] = [
  { name: 'Plan Default', slug: 'plan-default', text: 'plan body with {{n}}', role: 'plan', isDefault: true },
  { name: 'Plan Variant A', slug: 'plan-variant-a', text: 'variant A ${N}', role: 'plan' },
  { name: 'Next Default', slug: 'next-default', text: 'next body {{n}}', role: 'next', isDefault: true },
  { name: 'Next Variant B', slug: 'next-variant-b', text: 'variant B', role: 'next' },
  { name: 'Generic One', slug: 'generic-one', text: 'generic body', role: 'generic' },
  { name: 'Legacy Untagged', slug: 'legacy-untagged', text: 'no role field' },
];

type Tuple = { slug: string | undefined; name: string; role: string | undefined; text: string };

function toTuples(entries: readonly PromptEntry[]): Tuple[] {
  return entries.map((e) => ({ slug: e.slug, name: e.name, role: e.role, text: e.text }));
}

describe('Plan-14 close-out: export-format parity for role-scoped rows', () => {
  it('JSON envelope preserves the role field on every entry', () => {
    const bundle = buildPromptsBundle(ROLE_ENTRIES, '4.71.0', { format: 'json' });
    expect(bundle.entryCount).toBe(ROLE_ENTRIES.length);
    // Round-trip through JSON.stringify to catch any non-serializable drift.
    const parsed = validatePromptsBundle(JSON.parse(JSON.stringify(bundle)));
    expect(parsed.isValid).toBe(true);
    expect(toTuples(parsed.bundle!.entries)).toEqual(toTuples(ROLE_ENTRIES));
  });

  it('ZIP export round-trip yields identical (slug, name, role, text) tuples as JSON', async () => {
    const jsonBundle = buildPromptsBundle(ROLE_ENTRIES, '4.71.0', { format: 'json' });
    const { blob, bundle: zipBundle } = buildPromptsZip(ROLE_ENTRIES, '4.71.0');
    const parsedZip = parsePromptsBundleZip(await blobToBytes(blob));

    expect(zipBundle.entryCount).toBe(jsonBundle.entryCount);
    expect(parsedZip.bundle.entryCount).toBe(jsonBundle.entryCount);

    // Compare as unordered sets keyed by slug so ordering differences between
    // manifest emission and central-directory scan do not produce false negatives.
    const jsonBySlug = new Map(toTuples(jsonBundle.entries).map((t) => [t.slug ?? t.name, t]));
    const zipBySlug = new Map(toTuples(parsedZip.bundle.entries).map((t) => [t.slug ?? t.name, t]));
    expect([...zipBySlug.keys()].sort()).toEqual([...jsonBySlug.keys()].sort());
    for (const [key, jsonTuple] of jsonBySlug) {
      expect(zipBySlug.get(key)).toEqual(jsonTuple);
    }
  });

  it('role histogram matches across JSON and ZIP exports', async () => {
    const jsonBundle = buildPromptsBundle(ROLE_ENTRIES, '4.71.0', { format: 'json' });
    const { blob } = buildPromptsZip(ROLE_ENTRIES, '4.71.0');
    const parsedZip = parsePromptsBundleZip(await blobToBytes(blob));

    const histogram = (entries: readonly PromptEntry[]): Record<string, number> => {
      const acc: Record<string, number> = {};
      for (const e of entries) {
        const key = e.role ?? '__none__';
        acc[key] = (acc[key] ?? 0) + 1;
      }
      return acc;
    };

    expect(histogram(parsedZip.bundle.entries)).toEqual(histogram(jsonBundle.entries));
    expect(histogram(jsonBundle.entries)).toEqual({ plan: 2, next: 2, generic: 1, __none__: 1 });
  });
});
