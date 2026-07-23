/**
 * v4.192.0 — Accessibility contract for the History panel toolbar:
 *   - Container is role=toolbar with an aria-label.
 *   - Sort buttons expose aria-pressed + aria-sort when active.
 *   - Filter chips expose aria-pressed reflecting selection state.
 *   - Roving tabindex: first control tabindex=0, siblings -1.
 *   - ArrowRight/ArrowLeft/Home/End move focus within the toolbar.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openPromptHistoryPanel } from '../prompt-history-panel';
import type { PromptRevisionRow } from '../../db/prompt-revision-db';

const rev = (over: Partial<PromptRevisionRow> = {}): PromptRevisionRow => ({
    Id: 1, PromptId: 1, Slug: 'plan-default', Name: 'Plan',
    Body: 'body {{n}}', Role: 'plan', ReplaceKey: 'n',
    ReplaceValues: '[]', CreatedAt: 1000, Reason: 'upsert',
    ...over,
}) as PromptRevisionRow;

async function mount(): Promise<HTMLElement> {
    await openPromptHistoryPanel(
        { slug: 'plan-default', role: 'plan' },
        {
            listRevisions: async () => ({
                ok: true,
                value: [
                    rev({ Id: 1, CreatedAt: 100, Reason: 'upsert' }),
                    rev({ Id: 2, CreatedAt: 200, Reason: 'import' }),
                    rev({ Id: 3, CreatedAt: 300, Reason: 'restore' }),
                ],
            }),
        },
    );
    const toolbar = document.querySelector<HTMLElement>('[data-role="history-toolbar"]');
    if (!toolbar) throw new Error('toolbar not rendered');
    return toolbar;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('History toolbar accessibility (v4.192.0)', () => {
    it('exposes toolbar role and aria-label', async () => {
        const toolbar = await mount();
        expect(toolbar.getAttribute('role')).toBe('toolbar');
        expect(toolbar.getAttribute('aria-label')).toMatch(/sort/i);
    });

    it('sort buttons expose aria-pressed and aria-sort for the active column', async () => {
        const toolbar = await mount();
        const dateBtn = toolbar.querySelector<HTMLButtonElement>('[data-sort-key="date"]')!;
        const reasonBtn = toolbar.querySelector<HTMLButtonElement>('[data-sort-key="reason"]')!;
        expect(dateBtn.getAttribute('aria-pressed')).toBe('true');
        expect(dateBtn.getAttribute('aria-sort')).toBe('descending');
        expect(reasonBtn.getAttribute('aria-pressed')).toBe('false');
        expect(reasonBtn.hasAttribute('aria-sort')).toBe(false);
    });

    it('reason chips expose aria-pressed reflecting selection state', async () => {
        const toolbar = await mount();
        const chip = toolbar.querySelector<HTMLButtonElement>('[data-role="reason-chip"][data-reason="upsert"]')!;
        expect(chip.getAttribute('aria-pressed')).toBe('false');
        chip.click();
        const toolbar2 = document.querySelector<HTMLElement>('[data-role="history-toolbar"]')!;
        const chip2 = toolbar2.querySelector<HTMLButtonElement>('[data-role="reason-chip"][data-reason="upsert"]')!;
        expect(chip2.getAttribute('aria-pressed')).toBe('true');
    });

    it('uses roving tabindex: exactly one button has tabindex=0', async () => {
        const toolbar = await mount();
        const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'));
        const zeroes = buttons.filter((b) => b.tabIndex === 0);
        const negs = buttons.filter((b) => b.tabIndex === -1);
        expect(zeroes.length).toBe(1);
        expect(negs.length).toBe(buttons.length - 1);
    });

    it('ArrowRight moves focus to the next toolbar button and updates tabindex', async () => {
        const toolbar = await mount();
        const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'));
        const first = buttons[0]!;
        const second = buttons[1]!;
        first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(second);
        expect(second.tabIndex).toBe(0);
        expect(first.tabIndex).toBe(-1);
    });

    it('End jumps to the last button, Home to the first', async () => {
        const toolbar = await mount();
        const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'));
        const first = buttons[0]!;
        const last = buttons[buttons.length - 1]!;
        first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(last);
        last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(first);
    });
});
