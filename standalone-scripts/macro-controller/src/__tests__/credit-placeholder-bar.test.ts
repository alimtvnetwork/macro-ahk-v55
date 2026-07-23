/**
 * Plan 01 Step 8b — resolver Pending vs. resolved render contract.
 *
 * Asserts the placeholder bar logic in `ws-list-renderer.ts`:
 *  - source==='Pending' → animated `.marco-skeleton` shimmer (height 8px).
 *  - source==='Timeout'/'Missing' → thin red 2px warning bar.
 *  - Both keep min-width:160px so the row never reflows when the resolver
 *    completes — the bug Step 6 of plan 01 was created to fix.
 */
import { describe, it, expect } from 'vitest';
import { buildCreditPlaceholderBarHtml } from '../ws-list-renderer';

describe('buildCreditPlaceholderBarHtml — plan 01 step 8b', () => {
    it('Pending source renders a marco-skeleton shimmer bar', () => {
        const html = buildCreditPlaceholderBarHtml(true, 'Fetching…');
        expect(html).toContain('class="marco-skeleton"');
        expect(html).toContain('title="Fetching…"');
        expect(html).toContain('min-width:160px');
        expect(html).toContain('height:8px');
        expect(html).not.toContain('background:');
    });

    it('non-Pending source renders a thin red warning bar', () => {
        const html = buildCreditPlaceholderBarHtml(false, 'Timed out');
        expect(html).not.toContain('marco-skeleton');
        expect(html).toContain('title="Timed out"');
        expect(html).toContain('min-width:160px');
        expect(html).toContain('height:2px');
        expect(html).toContain('background:');
        expect(html).toContain('opacity:0.85');
    });

    it('both states preserve the 160px slot width (no row reflow)', () => {
        expect(buildCreditPlaceholderBarHtml(true, 't')).toContain('min-width:160px');
        expect(buildCreditPlaceholderBarHtml(false, 't')).toContain('min-width:160px');
    });
});
