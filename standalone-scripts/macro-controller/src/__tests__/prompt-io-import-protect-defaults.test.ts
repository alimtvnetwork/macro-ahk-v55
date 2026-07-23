/**
 * v4.400.0: mergePrompts MUST refuse to overwrite entries with isDefault=true
 * and MUST count them into results.defaultsProtected. Also verifies the
 * validator forces isDefault=false on every incoming entry (crafted bundle
 * defense).
 */
import { describe, it, expect } from 'vitest';
import { mergePrompts, validatePromptEntry } from '../ui/prompt-io';
import type { CachedPromptEntry } from '../ui/prompt-cache';

describe('Prompt import: default protection (v4.400.0)', () => {
    it('validatePromptEntry forces isDefault=false even when input claims true', () => {
        const validated = validatePromptEntry({ name: 'X', text: 'Y', isDefault: true, slug: 'x' });
        expect(validated).not.toBeNull();
        expect(validated?.isDefault).toBe(false);
    });

    it('skips overwrite when existing target is isDefault=true and counts it', () => {
        const existing: CachedPromptEntry[] = [
            { name: 'Plan Default', text: 'seed body', slug: 'plan-default', isDefault: true },
            { name: 'User', text: 'old body', slug: 'user', isDefault: false },
        ];
        const imported: CachedPromptEntry[] = [
            { name: 'Plan Default', text: 'HACKED body', slug: 'plan-default', isDefault: false },
            { name: 'User', text: 'new body', slug: 'user', isDefault: false },
            { name: 'Fresh', text: 'fresh body', slug: 'fresh', isDefault: false },
        ];
        const { merged, results } = mergePrompts(existing, imported, true);

        const planDefault = merged.find((e) => e.slug === 'plan-default');
        expect(planDefault?.text).toBe('seed body');
        expect(planDefault?.isDefault).toBe(true);

        const user = merged.find((e) => e.slug === 'user');
        expect(user?.text).toBe('new body');

        const fresh = merged.find((e) => e.slug === 'fresh');
        expect(fresh?.text).toBe('fresh body');

        expect(results.defaultsProtected).toBe(1);
        expect(results.updated).toBe(1);
        expect(results.added).toBe(1);
    });
});
