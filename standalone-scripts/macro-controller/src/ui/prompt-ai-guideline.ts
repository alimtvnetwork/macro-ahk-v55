/**
 * Plan-23 step 6: canonical AI editing guideline surfaced through the editor's
 * `📥 Download AI guideline` button. The body is a plain string constant so it
 * is trivially unit-testable and cannot drift out-of-sync with a bundled asset
 * file at build time (issue 04 required reuse across chip + library editors).
 *
 * When you update this text, also update:
 *   - spec/33-missing-coding-guideline/prompt-editor-reuse.md (contract)
 *   - RELEASE_NOTES.md for the next minor bump
 */

import { REPLACE_KEY_DEFAULT } from '../db/prompt-defaults';
import { logError } from '../error-utils';
import { showToast } from '../toast';

export interface AiGuidelineInput {
    roleLabel: string;
    requiredTokens: string[];
    /**
     * Plan-23 remaining-item #4: byte-exact shipped default body for the slug
     * being edited. When provided, the guideline appends a "Canonical default"
     * fenced block so an external AI can diff against the original before
     * proposing edits. Undefined for slugs without a seed (user-authored rows).
     */
    seedBody?: string;
}

export function buildAiGuidelineMarkdown(input: AiGuidelineInput): string {
    const tokens = input.requiredTokens.length > 0
        ? input.requiredTokens.map(t => '`{{' + t + '}}`').join(', ')
        : '(none — this role has no required tokens)';
    const lines: string[] = [
        '# Marco Prompt Editing Guideline (' + input.roleLabel + ')',
        '',
        '**Contract version:** 1',
        '**Generated:** ' + new Date().toISOString(),
        '',
        '## Required tokens (do NOT rename or delete)',
        '',
        tokens,
        '',
        'These tokens are substituted at paste time by the Marco Chrome extension.',
        'If any of them are missing from the saved body, the drift guard will refuse',
        'to save and the paste will fail.',
        '',
        '## Editing rules for the AI',
        '',
        '1. Preserve every required token verbatim, including the double curly braces.',
        '2. Keep the token substring case-sensitive. `{{' + REPLACE_KEY_DEFAULT + '}}` and `{{N}}` are NOT interchangeable.',
        '3. You may reorder, rewrite, or translate the surrounding prose freely.',
        '4. You may add new `{{token}}` placeholders, but never remove an existing required one.',
        '5. Do not wrap the body in Markdown code fences unless the original body used them.',
        '6. Keep the body under 50 KB. The extension rejects longer payloads.',
        '',
        '## How the extension validates your edit',
        '',
        'On save, the editor calls `extractParamTokens(body)` and requires the set',
        'above to be a subset of the returned list. Extra tokens are allowed;',
        'missing tokens block Save with a toast listing exactly which token was lost.',
        '',
        '## When in doubt',
        '',
        'Return the original body unchanged and explain what you would have changed.',
        'A refused save costs the user more time than a conservative no-op.',
        '',
    ];
    if (typeof input.seedBody === 'string' && input.seedBody.length > 0) {
        lines.push(
            '## Canonical default (shipped body for this slug)',
            '',
            'Use this as the diff base. Preserve every `{{token}}` present here unless',
            'the user explicitly asks you to drop it. When in doubt, return this body',
            'unchanged.',
            '',
            '```text',
            input.seedBody,
            '```',
            '',
        );
    }
    return lines.join('\n');
}

/**
 * Trigger a browser download of the guideline. Never throws: any failure is
 * logged via `logError('PromptEditor', ...)` and surfaced with a toast so the
 * click is never a silent no-op (guideline 33 error-management rule).
 */
export function downloadAiGuideline(input: AiGuidelineInput): void {
    try {
        const md = buildAiGuidelineMarkdown(input);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'marco-prompt-guideline-' + input.roleLabel.toLowerCase() + '.md';
        document.body.appendChild(a);
        a.click();
        // Defer cleanup so Safari/Firefox finish the download before revoking.
        setTimeout(() => {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        showToast('📥 Guideline downloaded for ' + input.roleLabel, 'success');
    } catch (err) {
        logError('PromptEditor', 'downloadAiGuideline failed for role=' + input.roleLabel, err);
        showToast('❌ Failed to download AI guideline', 'error');
    }
}
