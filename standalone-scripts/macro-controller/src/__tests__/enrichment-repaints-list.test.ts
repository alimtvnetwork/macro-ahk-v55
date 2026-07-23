/**
 * Regression — v3.55.x credit-bar empty after Refresh for Free / Lite / Cancelled.
 *
 * Root cause (see `.lovable/plan.md` 2026-06-06):
 * `schedulePostParseEnrichment` overlays /credit-balance numbers onto each
 * WorkspaceCredit row but only called `mc().updateUI()` — never
 * `populateLoopWorkspaceDropdown()`. The per-row credit bar
 * (`renderCreditBar` inside `renderLoopWorkspaceList`) therefore stayed
 * pinned to the original 0/0 values.
 *
 * Static guard: every `.then()` block inside `schedulePostParseEnrichment`
 * that calls `mc().updateUI()` MUST also funnel through
 * `repaintWorkspaceRowsAfterEnrichment` (which in turn calls
 * `populateLoopWorkspaceDropdown`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..', 'credit-fetch.ts');

function getSchedulePostParseEnrichmentSource(): string {
    const full = readFileSync(SRC, 'utf8');
    const start = full.indexOf('export function schedulePostParseEnrichment');
    expect(start, 'schedulePostParseEnrichment must exist').toBeGreaterThan(-1);
    const rest = full.slice(start);
    const endRel = rest.indexOf('\n}\n');
    return endRel === -1 ? rest : rest.slice(0, endRel + 2);
}

describe('schedulePostParseEnrichment — per-row repaint contract', () => {
    const body = getSchedulePostParseEnrichmentSource();

    it('imports the per-row dropdown renderer (static or dynamic)', () => {
        const full = readFileSync(SRC, 'utf8');
        // Static import OR dynamic import('./ws-list-renderer') — both invoke
        // populateLoopWorkspaceDropdown after enrichment; dynamic form is used
        // to avoid a 2-node madge cycle (Plan-17 step 18).
        const staticImport = /import\s*\{\s*populateLoopWorkspaceDropdown\s*\}\s*from\s*['"]\.\/ws-list-renderer['"]/;
        const dynamicImport = /import\(\s*['"]\.\/ws-list-renderer['"]\s*\)[\s\S]*populateLoopWorkspaceDropdown/;
        expect(staticImport.test(full) || dynamicImport.test(full)).toBe(true);
    });

    it('defines repaintWorkspaceRowsAfterEnrichment helper', () => {
        const full = readFileSync(SRC, 'utf8');
        expect(full).toMatch(/function\s+repaintWorkspaceRowsAfterEnrichment/);
        expect(full).toMatch(/populateLoopWorkspaceDropdown\s*\(\s*\)/);
    });

    it('every mc().updateUI() inside the function is followed by repaintWorkspaceRowsAfterEnrichment', () => {
        const updateUiCount = (body.match(/mc\(\)\.updateUI\(\)/g) || []).length;
        const repaintCount = (body.match(/repaintWorkspaceRowsAfterEnrichment\(/g) || []).length;
        expect(updateUiCount).toBeGreaterThanOrEqual(3);
        expect(repaintCount).toBe(updateUiCount);
    });

    it('all three known enrichment scopes are tagged', () => {
        expect(body).toMatch(/repaintWorkspaceRowsAfterEnrichment\(\s*['"]pro_0['"]\s*\)/);
        expect(body).toMatch(/repaintWorkspaceRowsAfterEnrichment\(\s*['"]pro_1['"]\s*\)/);
        expect(body).toMatch(/repaintWorkspaceRowsAfterEnrichment\(\s*['"]ktlo\/free\/cancelled['"]\s*\)/);
    });
});
