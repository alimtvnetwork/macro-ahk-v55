/**
 * Tests for rule-zero-validator.ts — the "step count is law" gate.
 *
 * Positive cases:
 *   R1. Template body carrying `{{n}}` in `Steps:` frontmatter -> template.
 *   R2. `EXACTLY {{n}} steps` in prose -> template.
 *   R3. Body with declared `Steps: 5` and exactly 5 numbered steps -> match.
 *   R4. Body with no declaration at all -> no-declaration (pass).
 *
 * Negative cases:
 *   R5. Declared `Steps: 5` but body has 3 numbered steps -> mismatch.
 *   R6. Declared `Steps: 5` but body has 0 numbered steps -> no-steps.
 *   R7. `# 20 steps Plan` header but body has 18 steps -> mismatch.
 *   R8. Nested/indented enumerations do not inflate the top-level count.
 *   R9. Fenced code blocks are ignored so example lists don't count.
 */
import { describe, it, expect } from 'vitest';
import {
    validateRuleZero,
    parseDeclaredStepCount,
    countTopLevelSteps,
} from '../rule-zero-validator';

describe('parseDeclaredStepCount', () => {
    it('parses literal Steps frontmatter', () => {
        const r = parseDeclaredStepCount('Slug: x\nSteps: 7\n\n# Plan');
        expect(r).toEqual({ kind: 'literal', value: 7 });
    });
    it('detects {{n}} template placeholder', () => {
        const r = parseDeclaredStepCount('Steps: {{n}}');
        expect(r.kind).toBe('template');
    });
    it('parses "# 20 steps Plan" header', () => {
        const r = parseDeclaredStepCount('# 20 steps Plan, Maximal Enforcement\n');
        expect(r).toEqual({ kind: 'literal', value: 20 });
    });
    it('parses "EXACTLY 5 steps" prose', () => {
        const r = parseDeclaredStepCount('Write EXACTLY 5 steps\n');
        expect(r).toEqual({ kind: 'literal', value: 5 });
    });
    it('returns none when nothing matches', () => {
        expect(parseDeclaredStepCount('no plan here').kind).toBe('none');
    });
});

describe('countTopLevelSteps', () => {
    it('counts top-level numbered items under ## Steps', () => {
        const body = '## Steps\n\n1. a\n2. b\n3. c\n\n## Verification\n\n1. skip\n';
        expect(countTopLevelSteps(body)).toBe(3);
    });
    it('falls back to whole document when no ## Steps heading', () => {
        expect(countTopLevelSteps('1. a\n2. b\n')).toBe(2);
    });
    it('ignores indented / nested enumerations', () => {
        const body = '## Steps\n1. a\n   1. nested\n   2. nested\n2. b\n';
        expect(countTopLevelSteps(body)).toBe(2);
    });
    it('ignores fenced code blocks', () => {
        const body = '## Steps\n1. a\n```\n2. fake\n3. fake\n```\n2. b\n';
        expect(countTopLevelSteps(body)).toBe(2);
    });
});

describe('validateRuleZero', () => {
    it('R1: template body with Steps:{{n}} passes as template', () => {
        const r = validateRuleZero('Steps: {{n}}\n\n## Steps\n1. do\n');
        expect(r.ok).toBe(true);
        expect(r.code).toBe('template');
    });
    it('R2: prose "EXACTLY {{n}} steps" passes as template', () => {
        const r = validateRuleZero('Write EXACTLY {{n}} steps.\n1. do\n');
        expect(r.ok).toBe(true);
        expect(r.code).toBe('template');
    });
    it('R3: declared 5 with exactly 5 steps -> match', () => {
        const body = 'Steps: 5\n\n## Steps\n1. a\n2. b\n3. c\n4. d\n5. e\n';
        const r = validateRuleZero(body);
        expect(r.ok).toBe(true);
        expect(r.code).toBe('match');
        expect(r.expectedN).toBe(5);
        expect(r.actualN).toBe(5);
    });
    it('R4: no declaration -> pass with no-declaration', () => {
        const r = validateRuleZero('Just some notes with 1. thing and 2. more');
        expect(r.ok).toBe(true);
        expect(r.code).toBe('no-declaration');
    });
    it('R5: declared 5 but body has 3 -> mismatch (blocked)', () => {
        const body = 'Steps: 5\n\n## Steps\n1. a\n2. b\n3. c\n';
        const r = validateRuleZero(body);
        expect(r.ok).toBe(false);
        expect(r.code).toBe('mismatch');
        expect(r.expectedN).toBe(5);
        expect(r.actualN).toBe(3);
        expect(r.reason).toMatch(/Rule 0/);
    });
    it('R6: declared 5 but no numbered steps -> no-steps (blocked)', () => {
        const body = 'Steps: 5\n\n## Steps\n\nprose only, no list\n';
        const r = validateRuleZero(body);
        expect(r.ok).toBe(false);
        expect(r.code).toBe('no-steps');
    });
    it('R7: "# 20 steps Plan" header but only 18 items -> mismatch', () => {
        const items = Array.from({ length: 18 }, (_, i) => (i + 1) + '. item').join('\n');
        const body = '# 20 steps Plan\n\n## Steps\n' + items + '\n';
        const r = validateRuleZero(body);
        expect(r.ok).toBe(false);
        expect(r.expectedN).toBe(20);
        expect(r.actualN).toBe(18);
    });
    it('R8: nested lists do not inflate the count', () => {
        const body = 'Steps: 2\n\n## Steps\n1. a\n   1. nested\n   2. nested\n2. b\n';
        expect(validateRuleZero(body).ok).toBe(true);
    });
    it('R9: fenced code blocks are ignored', () => {
        const body = 'Steps: 2\n\n## Steps\n1. a\n```\n2. fake\n3. fake\n```\n2. b\n';
        expect(validateRuleZero(body).ok).toBe(true);
    });
    it('empty body passes (nothing to enforce)', () => {
        expect(validateRuleZero('').ok).toBe(true);
    });
});
