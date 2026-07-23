import { describe, it, expect } from 'vitest';
import { PROMPT_ROLES, isPromptRole, assertNeverRole, type PromptRole } from '../prompt-role';

describe('PromptRole', () => {
    it('exposes exactly the three canonical roles in a stable order', () => {
        expect(PROMPT_ROLES).toEqual(['plan', 'next', 'generic']);
    });

    it('isPromptRole accepts every declared role', () => {
        for (const role of PROMPT_ROLES) {
            expect(isPromptRole(role)).toBe(true);
        }
    });

    it('isPromptRole rejects unknown strings, wrong types, and empty values', () => {
        for (const bad of ['', 'PLAN', 'planner', 'Plan ', null, undefined, 0, {}, []]) {
            expect(isPromptRole(bad)).toBe(false);
        }
    });

    it('switch over PromptRole is exhaustive (assertNeverRole guards drift)', () => {
        const label = (r: PromptRole): string => {
            switch (r) {
                case 'plan': return 'Plan';
                case 'next': return 'Next';
                case 'generic': return 'Generic';
                default: return assertNeverRole(r);
            }
        };
        expect(PROMPT_ROLES.map(label)).toEqual(['Plan', 'Next', 'Generic']);
    });

    it('assertNeverRole throws when a bogus role slips through at runtime', () => {
        expect(() => assertNeverRole('bogus' as never)).toThrow(/TYPE_EXHAUSTIVE_E001|Unhandled discriminant/);
    });
});
