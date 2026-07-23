/**
 * Downloadable sample JSON for the Prompt Library import feature.
 *
 * Root cause this addresses: users had no reference payload to craft valid
 * Import JSON (issue 04: "how this JSON will be created? There is no guideline").
 *
 * Emits a fully-validated `PromptsBundleV1` envelope containing one entry per
 * role (plan, next, generic) with placeholder tokens present so the drift
 * guard passes on re-import.
 */

import { log } from '../logger';
import { showToast } from '../toast';
import { VERSION } from '../shared-state';
import { buildPromptsBundle } from './prompt-bundle-types';
import type { PromptEntry } from '../types/ui-types';


const SAMPLE_ENTRIES: readonly PromptEntry[] = [
    {
        name: 'Sample Plan prompt',
        text: 'Rewrite the plan into {{n}} concise bullet points that preserve intent.',
        category: 'plan',
        slug: 'sample-plan',
        role: 'plan',
        isFavorite: false,
        isDefault: false,
    },
    {
        name: 'Sample Next prompt',
        text: 'Return the next {{n}} actionable steps as a numbered list.',
        category: 'next',
        slug: 'sample-next',
        role: 'next',
        isFavorite: false,
        isDefault: false,
    },
    {
        name: 'Sample Generic prompt',
        text: 'Freeform prompt body. Generic role has no required tokens.',
        category: 'generic',
        slug: 'sample-generic',
        role: 'generic',
        isFavorite: false,
        isDefault: false,
    },
];

export function buildSamplePromptsJson(_nowIso?: string): string {
    const bundle = buildPromptsBundle([...SAMPLE_ENTRIES], VERSION, { format: 'json' });
    return JSON.stringify(bundle, null, 2);
}


export function downloadSamplePromptsJson(): void {
    try {
        const data = buildSamplePromptsJson();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompts-sample.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        showToast('Downloaded prompts-sample.json', 'success');
    } catch (err) {
        log('[PromptLibrary] Sample JSON download failed: ' + String(err), 'error');
        showToast('Sample download failed', 'error');
    }
}
