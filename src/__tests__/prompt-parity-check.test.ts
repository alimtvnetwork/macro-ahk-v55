import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PromptBundleEntry {
  id?: string;
  slug?: string;
  name?: string;
  text?: string;
}

interface PromptBundle {
  prompts?: PromptBundleEntry[];
}

function readBundle(path: string): PromptBundleEntry[] {
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(text) as PromptBundle;
  return Array.isArray(parsed.prompts) ? parsed.prompts : [];
}

function releaseEntry(entries: PromptBundleEntry[]): PromptBundleEntry | undefined {
  return entries.find(entry => entry.slug === 'release');
}

describe('prompt bundle parity', () => {
  const extensionPrompts = readBundle('chrome-extension/prompts/macro-prompts.json');
  const standalonePrompts = readBundle('standalone-scripts/macro-controller/03-macro-prompts.json');

  it('standalone fallback bundle exactly matches extension bundle', () => {
    expect(standalonePrompts).toEqual(extensionPrompts);
  });

  it('bundles the canonical Release v7 prompt', () => {
    const release = releaseEntry(standalonePrompts);
    expect(release?.name).toBe('Release');
    expect(release?.text).toContain('Release, MINOR bump, MUST enforcement');
    expect(release?.text).toContain('RULE 0, MUST, NON-NEGOTIABLE');
    expect(release?.text).toContain('PATCH MUST reset to `0`');
  });

  it('does not keep legacy release prompt fragments in bundles', () => {
    const bundleText = JSON.stringify(standalonePrompts);
    expect(bundleText).not.toContain('Unified Release Prompt');
    expect(bundleText).not.toContain('fallback copies before claiming the release is complete');
    expect(bundleText).not.toContain('manifest.json, version.json, src/shared/constants.ts');
  });
});