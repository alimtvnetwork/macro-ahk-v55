/**
 * prompt-role-contract.test.ts — v4.179.0
 *
 * Contract matrix: for EVERY seeded row in `PLAN_NEXT_SEED_ROWS`, assert the
 * four invariants that all downstream code (editor Save button, drift guard,
 * Rule-0 live indicator, boot-time health check) already assume hold. If any
 * seed body or validator regresses so that one row silently violates a
 * contract, this test fails at CI time instead of at Save time in the user's
 * browser.
 *
 * Contracts checked per row:
 *   C1. `getRequiredTokensForRole(role)` returns a subset of tokens actually
 *       present in the row body (else the drift guard is impossible to satisfy
 *       even for a pristine seed).
 *   C2. `assertParamTokensUnchanged(body, body)` is a no-op — a row is its own
 *       drift-guard baseline. Guards against `extractParamTokens` non-determinism.
 *   C3. `validateRuleZero(body).ok === true` — every seed body must either use
 *       the `{{n}}` template placeholder or declare a matching step count.
 *   C4. Slug uniqueness and default-per-role uniqueness (exactly one
 *       `isDefault:true` row per non-generic role) — the health-check inspector
 *       relies on this to pick the row to validate at boot.
 */
import { describe, it, expect } from 'vitest';
import {
    PLAN_NEXT_SEED_ROWS,
    getRequiredTokensForRole,
    getSeedBodyForSlug,
} from '../plan-next-prompts';
import { extractParamTokens, assertParamTokensUnchanged } from '../../db/prompt-token-guard';
import { validateRuleZero } from '../../db/rule-zero-validator';
import type { PromptRole } from '../../db/prompt-db';

const ROLES: PromptRole[] = ['plan', 'next', 'generic'];

describe('Prompt role contract matrix (v4.179.0)', () => {
    describe('C1. required tokens ⊆ tokens in default body', () => {
        for (const role of ROLES) {
            it('role=' + role + ' — every required token appears in the default body', () => {
                const required = getRequiredTokensForRole(role);
                if (role === 'generic') {
                    expect(required).toEqual([]);
                    return;
                }
                const defaultRow = PLAN_NEXT_SEED_ROWS.find(r => r.role === role && r.isDefault);
                expect(defaultRow, 'missing default row for role=' + role).toBeDefined();
                const present = new Set(extractParamTokens(defaultRow!.body));
                for (const tok of required) {
                    expect(present.has(tok), 'required token {{' + tok + '}} missing from default body for role=' + role).toBe(true);
                }
            });
        }
    });

    describe('C2. each seed body is its own drift-guard baseline', () => {
        for (const row of PLAN_NEXT_SEED_ROWS) {
            it('slug=' + row.slug + ' — assertParamTokensUnchanged(body,body) does not throw', () => {
                expect(() => assertParamTokensUnchanged(row.body, row.body)).not.toThrow();
            });
        }
    });

    describe('C3. Rule-0 passes for every seed body (template or declared-count)', () => {
        for (const row of PLAN_NEXT_SEED_ROWS) {
            it('slug=' + row.slug + ' — validateRuleZero.ok===true', () => {
                const result = validateRuleZero(row.body);
                expect(
                    result.ok,
                    'Rule-0 violation on seed slug=' + row.slug + ' code=' + result.code
                    + ' reason=' + result.reason,
                ).toBe(true);
            });
        }
    });

    describe('C4. structural invariants used by health check + reseeder', () => {
        it('slug set is unique', () => {
            const slugs = PLAN_NEXT_SEED_ROWS.map(r => r.slug);
            expect(new Set(slugs).size).toBe(slugs.length);
        });

        it('exactly one isDefault:true row per non-generic role', () => {
            for (const role of ['plan', 'next'] as const) {
                const defaults = PLAN_NEXT_SEED_ROWS.filter(r => r.role === role && r.isDefault);
                expect(defaults.length, 'role=' + role + ' must have exactly one default').toBe(1);
            }
        });

        it('getSeedBodyForSlug is consistent with PLAN_NEXT_SEED_ROWS', () => {
            for (const row of PLAN_NEXT_SEED_ROWS) {
                expect(getSeedBodyForSlug(row.slug)).toBe(row.body);
            }
            expect(getSeedBodyForSlug('does-not-exist')).toBeNull();
        });

        it('no seed body contains an em dash (memory rule)', () => {
            for (const row of PLAN_NEXT_SEED_ROWS) {
                expect(row.body.includes('\u2014'), 'em dash in slug=' + row.slug).toBe(false);
            }
        });
    });

    /**
     * C5 (v4.183.0). Rule-0 save gate must apply to BOTH `plan` and `next`
     * roles. This is a contract test against the validator (the source of
     * truth), not the caller: if any future edit weakens `validateRuleZero`
     * so that a mismatched-step Next body slips through, this fails.
     * Wire-up in `ui/prompt-injection.ts::saveRoleScopedPrompt`.
     */
    describe('C5. Rule-0 gate covers plan AND next role saves (v4.183.0)', () => {
        const MISMATCH_BODY = '# 5 steps Plan, Maximal Enforcement\n\n1. one\n2. two\n3. three\n';
        it('validateRuleZero flags mismatch (shared by plan and next callers)', () => {
            const r = validateRuleZero(MISMATCH_BODY);
            expect(r.ok).toBe(false);
        });
        it('validateRuleZero passes on template bodies for both roles', () => {
            const r = validateRuleZero('# {{n}} steps Plan\n\n1. only\n');
            expect(r.ok).toBe(true);
        });
    });
});
