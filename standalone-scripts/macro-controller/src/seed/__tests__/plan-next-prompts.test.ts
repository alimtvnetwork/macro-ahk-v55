/**
 * Tests for the Plan/Next seed rows (plan-14, step 8).
 */
import { describe, it, expect } from 'vitest';
import {
    PLAN_NEXT_SEED_ROWS, PLAN_DEFAULT_BODY, NEXT_DEFAULT_BODY,
} from '../plan-next-prompts';
import { extractParamTokens } from '../../db/prompt-token-guard';

describe('PLAN_NEXT_SEED_ROWS', () => {
    it('contains exactly 8 rows: 4 plan + 4 next', () => {
        expect(PLAN_NEXT_SEED_ROWS).toHaveLength(8);
        expect(PLAN_NEXT_SEED_ROWS.filter(r => r.role === 'plan')).toHaveLength(4);
        expect(PLAN_NEXT_SEED_ROWS.filter(r => r.role === 'next')).toHaveLength(4);
    });

    it('has exactly one isDefault=true per role and marks the *-default slugs', () => {
        const planDefaults = PLAN_NEXT_SEED_ROWS.filter(r => r.role === 'plan' && r.isDefault);
        const nextDefaults = PLAN_NEXT_SEED_ROWS.filter(r => r.role === 'next' && r.isDefault);
        expect(planDefaults.map(r => r.slug)).toEqual(['plan-default']);
        expect(nextDefaults.map(r => r.slug)).toEqual(['next-default']);
    });

    it('slugs are unique', () => {
        const slugs = PLAN_NEXT_SEED_ROWS.map(r => r.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('every seed body carries at least one parameterized token so the guard is active', () => {
        for (const row of PLAN_NEXT_SEED_ROWS) {
            const tokens = extractParamTokens(row.body);
            expect(tokens.length, 'row ' + row.slug + ' must contain a token').toBeGreaterThan(0);
        }
    });
});

describe('PLAN_DEFAULT_BODY', () => {
    it('is derived from buildPlanTaskPrompt with a {{n}} placeholder (no sentinel leaks)', () => {
        expect(PLAN_DEFAULT_BODY).toContain('{{n}}');
        expect(PLAN_DEFAULT_BODY).not.toContain('-2147483647');
        // v4.187.0: header phrasing is not a locked invariant; only require
        // that the body starts with a markdown H1 that carries the sentinel.
        expect(PLAN_DEFAULT_BODY).toMatch(/^# .*\{\{n\}\}/);
    });

    it('substituting {{n}} back to a number reproduces buildPlanTaskPrompt(n) byte-for-byte', async () => {
        const { buildPlanTaskPrompt } = await import('../../ui/plan-task-ui');
        for (const n of [2, 8, 30, 100]) {
            const rendered = PLAN_DEFAULT_BODY.split('{{n}}').join(String(n));
            expect(rendered).toBe(buildPlanTaskPrompt(n));
        }
    });
});

describe('NEXT_DEFAULT_BODY', () => {
    it('contains the {{n}} token and starts with the canonical Next header', () => {
        expect(NEXT_DEFAULT_BODY).toContain('{{n}}');
        expect(NEXT_DEFAULT_BODY).toMatch(/^# Next \{\{n\}\} steps or tasks/);
    });
});
