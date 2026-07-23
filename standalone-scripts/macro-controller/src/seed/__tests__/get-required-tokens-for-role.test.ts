/**
 * Plan-23 remaining-item #3: regression coverage for `getRequiredTokensForRole`,
 * the single source of truth for the drift-guard contract used by the editor
 * chip strip, the AI guideline export, and the DB parity check.
 *
 * Root contract:
 *   plan    -> tokens present in PLAN_DEFAULT_BODY   (currently ['n'])
 *   next    -> tokens present in NEXT_DEFAULT_BODY   (currently ['n'])
 *   generic -> []
 *
 * These tests deliberately assert BOTH the shape (dedup, sorted-set-like) and
 * the current values so that removing `{{n}}` from a shipped seed body fails
 * loudly here before the drift guard silently accepts a token-less save.
 */
import { describe, it, expect } from 'vitest';
import { getRequiredTokensForRole, PLAN_DEFAULT_BODY, NEXT_DEFAULT_BODY } from '../plan-next-prompts';

describe('getRequiredTokensForRole', () => {
    it('returns ["n"] for role=plan (matches PLAN_DEFAULT_BODY)', () => {
        const tokens = getRequiredTokensForRole('plan');
        expect(tokens).toEqual(['n']);
        // Guard: if the seed body itself lost the token, this test still fails.
        expect(PLAN_DEFAULT_BODY).toContain('{{n}}');
    });

    it('returns ["n"] for role=next (matches NEXT_DEFAULT_BODY)', () => {
        const tokens = getRequiredTokensForRole('next');
        expect(tokens).toEqual(['n']);
        expect(NEXT_DEFAULT_BODY).toContain('{{n}}');
    });

    it('returns [] for role=generic (no required tokens by contract)', () => {
        expect(getRequiredTokensForRole('generic')).toEqual([]);
    });

    it('deduplicates tokens even though the seed body mentions {{n}} many times', () => {
        // NEXT_DEFAULT_BODY intentionally uses {{n}} multiple times; the helper
        // must collapse them to a single required-token entry.
        const occurrences = (NEXT_DEFAULT_BODY.match(/\{\{n\}\}/g) ?? []).length;
        expect(occurrences).toBeGreaterThan(1);
        expect(getRequiredTokensForRole('next')).toHaveLength(1);
    });

    it('is a pure synchronous function (no Promise, no throw for known roles)', () => {
        // The chip strip re-runs this on every keystroke; a stray async or throw
        // would freeze the editor. Locking the sync contract here.
        expect(() => getRequiredTokensForRole('plan')).not.toThrow();
        const result: string[] = getRequiredTokensForRole('plan');
        expect(Array.isArray(result)).toBe(true);
    });
});
