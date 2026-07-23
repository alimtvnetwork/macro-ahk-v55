/**
 * Step 3 (Plan Task RCA) — Tests for plan-task-ui.ts.
 *
 * Covers:
 *  - buildPlanTaskPrompt(n) shape for several N values (unit).
 *  - PasteOutcome surface: caller-side toast only on 'failed' (component).
 *  - 120ms mouseleave auto-collapse is gone (component).
 *  - parseInt radix: custom "08" → 8 (component).
 *  - Dropdown closes AFTER injectPlanPrompt (component).
 *
 * JSDOM env via root vitest config.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPromptLoaderMock } from './helpers/prompt-loader-mock';

import { buildPlanTaskPrompt, renderPlanTaskSubmenu } from '../ui/plan-task-ui';
import type { PasteOutcome } from '../ui/prompt-utils';

// ── Mocks ──
const showPasteToastSpy = vi.fn();
let mockOutcome: PasteOutcome = 'injected';

vi.mock('../ui/prompt-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/prompt-utils')>();
  return {
    ...actual,
    showPasteToast: (...args: unknown[]) => showPasteToastSpy(...args),
    pasteIntoEditor: () => mockOutcome,
  };
});
vi.mock('../ui/prompt-loader', () => buildPromptLoaderMock({
  getPromptsConfig: () => ({ editorXPath: '//div' }),
  // v4.187.0: required by runSql; empty-rows response drives the fallback path.
  sendToExtension: async () => ({ isOk: true, rows: [] }),
}));
vi.mock('../xpath-utils', () => ({
  getByXPath: () => document.createElement('div'),
}));
// Plan-14 step 15: injection now reads plan-default from the Prompt table.
// Return `undefined` so the code path exercises the hardcoded fallback,
// preserving the pre-existing PasteOutcome behaviour these tests assert.
vi.mock('../db/prompt-db', () => ({
  getDefaultPromptForRole: async () => ({ ok: true, value: undefined }),
}));

interface PromptContextLike {
  promptsDropdown: HTMLElement;
}

function makeCtx(): PromptContextLike {
  const dd = document.createElement('div');
  dd.style.display = 'block';
  document.body.appendChild(dd);
  return { promptsDropdown: dd };
}

beforeEach(() => {
  document.body.innerHTML = '';
  showPasteToastSpy.mockReset();
  mockOutcome = 'injected';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('buildPlanTaskPrompt', () => {
  it('contains the N value in heading + body for n=5/10/15/99', () => {
    for (const n of [5, 10, 15, 99]) {
      const out = buildPlanTaskPrompt(n);
      // v4.187.0: invariant assertion (see plan-task-ui-boundary-sweep for
      // the same pattern) so cosmetic body rewrites do not regress the test.
      const firstLine = out.split('\n')[0] ?? '';
      expect(firstLine.startsWith('# ')).toBe(true);
      const wholeNumberRe = new RegExp('(^|\\D)' + String(n) + '(\\D|$)');
      expect(wholeNumberRe.test(firstLine)).toBe(true);
      expect(out).toContain('`' + String(n) + '`');
      expect(out.includes('{{n}}')).toBe(false);
    }
  });

  it('includes guideline check block', () => {
    const out = buildPlanTaskPrompt(7);
    expect(out).toContain('.lovable/coding-guidelines.md');
    expect(out).toContain('spec/coding-guidelines/');
  });
});

describe('renderPlanTaskSubmenu — toast surface', () => {
  it('does NOT show a caller-side toast when outcome=injected', () => {
    const ctx = makeCtx();
    const container = document.createElement('div');
    document.body.appendChild(container);
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);

    const header = container.querySelector('div') as HTMLElement;
    header.click(); // open sub
    const presets = container.querySelectorAll('[data-plan-preset]');
    (presets[0] as HTMLElement).click(); // "Plan 2"

    expect(showPasteToastSpy).not.toHaveBeenCalled();
  });

  it('does NOT show a caller-side toast when outcome=clipboard', () => {
    mockOutcome = 'clipboard';
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    (container.querySelector('div') as HTMLElement).click();
    const preset = container.querySelector('[data-plan-preset]') as HTMLElement;
    preset.click();
    expect(showPasteToastSpy).not.toHaveBeenCalled();
  });

  it('SHOWS a red toast only when outcome=failed', async () => {
    mockOutcome = 'failed';
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    (container.querySelector('div') as HTMLElement).click();
    (container.querySelector('[data-plan-preset]') as HTMLElement).click();
    // Injection now runs on a microtask (async DB lookup with fallback).
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(showPasteToastSpy).toHaveBeenCalledTimes(1);
    expect(showPasteToastSpy.mock.calls[0][0]).toMatch(/injection failed/);
    expect(showPasteToastSpy.mock.calls[0][1]).toBe(true);
  });
});

describe('renderPlanTaskSubmenu — RC-3 no auto-collapse', () => {
  it('sub stays open after mouseleave + 500ms (no setTimeout collapse)', async () => {
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    const item = container.firstChild as HTMLElement;
    const sub = item.querySelector('[data-plan-task-sub]') as HTMLElement;

    // Force-open the sub (bypassing header click which has issues with synthetic events in JSDOM
    // when scoped purely to `.onclick`). The RC-3 contract is: once OPEN, mouseleave must NOT close it.
    sub.style.display = 'block';

    item.dispatchEvent(new Event('mouseleave'));
    await new Promise((r) => setTimeout(r, 500)); // far longer than the legacy 120ms timer

    expect(sub.style.display).toBe('block'); // STILL open — auto-collapse removed
  });
});

describe('renderPlanTaskSubmenu — RC-4 custom parse radix', () => {
  it('treats "08" as 8 (decimal), not 0 (octal)', () => {
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    (container.querySelector('div') as HTMLElement).click(); // open sub

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    const goBtn = input.nextSibling as HTMLElement;
    input.value = '08';
    goBtn.click();

    // outcome=injected → no toast. If parsed as 0, would have triggered '⚠️ Enter 1–999'.
    expect(showPasteToastSpy).not.toHaveBeenCalled();
  });

  it('rejects 0 with warning toast', () => {
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    (container.querySelector('div') as HTMLElement).click();
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    const goBtn = input.nextSibling as HTMLElement;
    input.value = '0';
    goBtn.click();
    expect(showPasteToastSpy).toHaveBeenCalledWith('⚠️ Enter 1–999', true);
  });
});

describe('renderPlanTaskSubmenu — RC-5 dropdown closes after paste', () => {
  it('dropdown remains open until injectPlanPrompt returns', () => {
    const ctx = makeCtx();
    const container = document.createElement('div');
    // @ts-expect-error ctx narrowed for test
    renderPlanTaskSubmenu(container, ctx);
    (container.querySelector('div') as HTMLElement).click();
    expect(ctx.promptsDropdown.style.display).toBe('block');
    (container.querySelector('[data-plan-preset]') as HTMLElement).click();
    // After click, paste already ran (sync mock), then dropdown closes.
    expect(ctx.promptsDropdown.style.display).toBe('none');
  });
});
