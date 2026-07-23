import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readPrompt(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('default prompt content', () => {
  it('release prompts define the full release contract', () => {
    const releasePrompts = [
      readPrompt('standalone-scripts/prompts/08-minor-bump/prompt.md'),
      readPrompt('standalone-scripts/prompts/09-major-bump/prompt.md'),
      readPrompt('standalone-scripts/prompts/10-patch-bump/prompt.md'),
    ].join('\n');

    expect(releasePrompts).toContain('Release trigger rule');
    expect(releasePrompts).toContain('version.json');
    expect(releasePrompts).toContain('fallback copies');
    expect(releasePrompts).toContain('root readme');
  });

  it('next prompt requires N steps with reasoning and remaining items', () => {
    const prompt = readPrompt('standalone-scripts/prompts/13-next-tasks/prompt.md');

    expect(prompt).toContain('NEXT `{{n}}` STEPS');
    expect(prompt).toContain('Reasoning');
    expect(prompt).toContain('EVERY remaining item');
  });

  it('next prompt enforces root-cause-before-fix discipline', () => {
    const prompt = readPrompt('standalone-scripts/prompts/13-next-tasks/prompt.md');

    expect(prompt).toContain('STOP and read first');
    expect(prompt).toContain('Root cause before fix');
    expect(prompt).toContain('Definition of done');
  });

  it('bundles the numbered Plan prompt source', () => {
    const prompt = readPrompt('standalone-scripts/prompts/14-plan-steps/prompt.md');

    expect(prompt).toContain('steps plan, maximum enforcement');
    expect(prompt).toContain('Nothing executes this turn');
    expect(prompt).toContain('Hard rules');
  });

  it('release prompt (22-release) enforces MINOR-bump ceremony v7 contract', () => {
    const prompt = readPrompt('standalone-scripts/prompts/22-release/prompt.md');
    const mirror = readPrompt('.lovable/prompts/14-release.md');

    for (const body of [prompt, mirror]) {
      expect(body).toContain('Release, MINOR bump, MUST enforcement');
      expect(body).toContain('RULE 0, MUST, NON-NEGOTIABLE');
      expect(body).toContain('PATCH MUST reset to `0`');
      expect(body).toContain('canonical version source');
      expect(body).toContain('Idempotency guard');
      expect(body).toContain('Placeholder guard');
      expect(body).toContain('date -u +%Y-%m-%d');
      expect(body).toContain('.lovable/release/issues/');
      expect(body).toContain('### Issues');
      expect(body).toContain('Ambiguity handling');
      expect(body).not.toMatch(/[\u2014\u2013]/);
    }

    expect(prompt).toBe(mirror);
  });
});
