/**
 * Plan-23 Step 1/2 — prompt-modal-theme: idempotent style injection tied to
 * both modal roots. Positive + negative + integration coverage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ensurePromptModalTheme } from '../prompt-modal-theme';

describe('ensurePromptModalTheme', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('appends exactly one <style id="macro-prompt-modal-theme"> on first call', () => {
        ensurePromptModalTheme();
        const nodes = document.head.querySelectorAll('style#macro-prompt-modal-theme');
        expect(nodes.length).toBe(1);
    });

    it('is idempotent across repeated calls', () => {
        ensurePromptModalTheme();
        ensurePromptModalTheme();
        ensurePromptModalTheme();
        expect(document.head.querySelectorAll('style#macro-prompt-modal-theme').length).toBe(1);
    });

    it('pins color-scheme:dark for both modal roots', () => {
        ensurePromptModalTheme();
        const css = document.getElementById('macro-prompt-modal-theme')?.textContent ?? '';
        expect(css).toContain('#macro-prompt-library-modal');
        expect(css).toContain('#marco-prompt-modal');
        expect(css).toMatch(/color-scheme:\s*dark/);
    });

    it('locks native form-control surfaces that leak host theme', () => {
        ensurePromptModalTheme();
        const css = document.getElementById('macro-prompt-modal-theme')?.textContent ?? '';
        expect(css).toContain('::-webkit-file-upload-button');
        expect(css).toContain('::-webkit-scrollbar');
        expect(css).toMatch(/@media \(prefers-color-scheme: light\)/);
    });
});
