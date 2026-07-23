/**
 * Regression test for v3.40.2 — "Free Credit panel stale during running loop".
 *
 * Root cause: `processWorkspaceData` (loop-cycle.ts) parsed the workspaces
 * response and called `mc().updateUI()`, but never invoked the pro_0 / pro_1
 * enrichment chain. Only the manual `fetchLoopCredits` path
 * (`processSuccessData` in credit-fetch.ts) called `schedulePostParseEnrichment()`.
 * Result: per-workspace `dailyFree` for pro_0/pro_1 plans went stale during
 * an actively running loop, and the "Free Credit" UI never updated.
 *
 * Fix: export `schedulePostParseEnrichment` and call it from
 * `processWorkspaceData` immediately after the `updateUI()` paint, AND also
 * await pro_1 enrichment in `doFetchLoopCreditsAsync` (post-move flow).
 *
 * This is a static-source assertion test — pure regex over the two files so
 * the fix can never silently regress, regardless of bundle/runtime behavior.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Plan-17 step 13: processWorkspaceData moved to `loop-cycle-fallback.ts`;
// contract still applies to that module.
const LOOP_CYCLE = readFileSync(resolve(__dirname, '../loop-cycle-fallback.ts'), 'utf-8');
const CREDIT_FETCH = readFileSync(resolve(__dirname, '../credit-fetch.ts'), 'utf-8');

describe('Free Credit refresh during running loop (v3.40.2)', () => {
  it('credit-fetch.ts exports schedulePostParseEnrichment', () => {
    expect(CREDIT_FETCH).toMatch(/export function schedulePostParseEnrichment\s*\(/);
  });

  it('loop-cycle.ts imports schedulePostParseEnrichment from credit-fetch', () => {
    expect(LOOP_CYCLE).toMatch(/import\s*\{[^}]*\bschedulePostParseEnrichment\b[^}]*\}\s*from\s*['"]\.\/credit-fetch['"]/);
  });

  it('loop-cycle.ts calls schedulePostParseEnrichment() inside processWorkspaceData', () => {
    // Body bounded between `async function processWorkspaceData` and the
    // next top-level `^function` / `^async function` declaration.
    const match = LOOP_CYCLE.match(/async function processWorkspaceData[\s\S]*?\n\}\n/);
    expect(match, 'processWorkspaceData function not found').not.toBeNull();
    expect(match![0]).toMatch(/schedulePostParseEnrichment\s*\(\s*\)/);
  });

  it('doFetchLoopCreditsAsync awaits BOTH pro_0 and pro_1 enrichment', () => {
    const match = CREDIT_FETCH.match(/async function doFetchLoopCreditsAsync[\s\S]*?\n\}\n/);
    expect(match, 'doFetchLoopCreditsAsync function not found').not.toBeNull();
    expect(match![0]).toMatch(/await\s+applyProZeroEnrichment\s*\(/);
    expect(match![0]).toMatch(/await\s+applyProOneEnrichment\s*\(/);
  });

  it('rationale comment is present so the fix is not silently reverted', () => {
    expect(LOOP_CYCLE).toMatch(/Free[\s\S/]{1,20}Credit\s+panel/i);
  });
});
