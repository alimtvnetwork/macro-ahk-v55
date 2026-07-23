/**
 * task-next-ui — extended positive/negative coverage for findNextTasksPrompt
 * and findAddToTasksButton.
 *
 * Complements `task-next-ui-dom-finders.test.ts` by locking additional
 * observable contracts:
 *
 * findNextTasksPrompt:
 *   - Respects the configured taskNextState.settings.promptSlug override so
 *     callers can point at a non-default slug.
 *   - Slug match (tier 1) wins over an id/name that would also match a later
 *     tier - stability of match order.
 *   - Keyword heuristic requires BOTH "next" AND ("task" or "step") in the
 *     name; "next" alone is not enough (guards against false positives like
 *     "next-of-kin").
 *   - Handles entries whose fields are missing/empty without throwing.
 *
 * findAddToTasksButton:
 *   - Uses data-testid selector when aria-label absent.
 *   - Walks up to the closing <button> when the selector matches an inner
 *     element such as <svg data-testid="send-icon">.
 *   - Skips a disabled submit button inside a form and falls to another
 *     selector tier if available.
 *   - Returns null when the only candidate under the submit selector is
 *     disabled and no other selector matches.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    findAddToTasksButton,
    findNextTasksPrompt,
    taskNextState,
    type TaskNextDeps,
} from '../../ui/task-next-ui';

function makeDeps(entries: unknown[]): TaskNextDeps {
    return {
        sendToExtension: vi.fn(),
        getPromptsConfig: () => ({ entries }) as unknown as ReturnType<TaskNextDeps['getPromptsConfig']>,
        getByXPath: () => null,
    };
}

const originalSettings = { ...taskNextState.settings };

beforeEach(() => {
    Object.assign(taskNextState.settings, originalSettings);
    document.body.innerHTML = '';
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'warn').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'error').mockImplementation(() => { /* silent */ });
});

afterEach(() => {
    Object.assign(taskNextState.settings, originalSettings);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('findNextTasksPrompt — extended positive/negative cases', () => {
    it('respects a custom promptSlug override configured in settings', () => {
        taskNextState.settings.promptSlug = 'my-custom-target';
        const entries = [
            { id: 'a', name: 'Unrelated', slug: 'foo' },
            { id: 'b', name: 'Custom Target', slug: 'my-custom-target' },
        ];
        expect(findNextTasksPrompt(makeDeps(entries))).toEqual(entries[1]);
    });

    it('slug match wins over an id-tier candidate that appears earlier', () => {
        // Entry 0 would match tier-2 by id ("default-next-tasks"); entry 1
        // matches tier-1 by slug. The slug tier must win regardless of order.
        const entries = [
            { id: 'default-next-tasks', name: 'Id Match', slug: 'ignored' },
            { id: 'z', name: 'Slug Match', slug: 'next-tasks' },
        ];
        expect(findNextTasksPrompt(makeDeps(entries))).toEqual(entries[1]);
    });

    it('keyword heuristic does NOT match a name with "next" alone (no task/step)', () => {
        const entries = [
            { id: 'a', name: 'Next of Kin', slug: 'kin' },
        ];
        expect(findNextTasksPrompt(makeDeps(entries))).toBeNull();
    });

    it('handles entries with missing name/slug/id fields without throwing', () => {
        const entries = [
            {}, { name: '' }, { slug: '' }, { id: '' },
        ];
        expect(() => findNextTasksPrompt(makeDeps(entries))).not.toThrow();
        expect(findNextTasksPrompt(makeDeps(entries))).toBeNull();
    });

    it('picks the FIRST slug-matching entry when multiple qualify', () => {
        const entries = [
            { id: 'first', name: 'First', slug: 'next-tasks' },
            { id: 'second', name: 'Second', slug: 'next-tasks' },
        ];
        expect(findNextTasksPrompt(makeDeps(entries))).toEqual(entries[0]);
    });
});

describe('findAddToTasksButton — extended positive/negative cases', () => {
    beforeEach(() => {
        // Force XPath tier to miss so we probe the selector tier deterministically.
        taskNextState.settings.buttonXPath = '//does/not/exist';
    });

    it('finds a button via data-testid selector when aria-label is absent', () => {
        const btn = document.createElement('button');
        btn.setAttribute('data-testid', 'chat-send-button');
        document.body.appendChild(btn);
        expect(findAddToTasksButton()).toBe(btn);
    });

    it('walks up to the closing <button> when the selector matches a child <svg>', () => {
        const form = document.createElement('form');
        const btn = document.createElement('button');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-testid', 'send-icon');
        btn.appendChild(svg);
        form.appendChild(btn);
        document.body.appendChild(form);
        expect(findAddToTasksButton()).toBe(btn);
    });

    it('skips a disabled form-submit button and falls to the aria-label selector', () => {
        const form = document.createElement('form');
        const disabled = document.createElement('button');
        disabled.type = 'submit';
        disabled.disabled = true;
        form.appendChild(disabled);
        document.body.appendChild(form);

        const fallback = document.createElement('button');
        fallback.setAttribute('aria-label', 'Send message');
        document.body.appendChild(fallback);

        // form button[type="submit"] tier matches but is disabled; the loop
        // continues and eventually hits the aria-label tier.
        expect(findAddToTasksButton()).toBe(fallback);
    });

    it('returns null when the only candidate is a disabled submit button with no alternative', () => {
        const form = document.createElement('form');
        const disabled = document.createElement('button');
        disabled.type = 'submit';
        disabled.disabled = true;
        form.appendChild(disabled);
        document.body.appendChild(form);
        expect(findAddToTasksButton()).toBeNull();
    });

    it('returns null on a completely empty DOM without throwing', () => {
        expect(() => findAddToTasksButton()).not.toThrow();
        expect(findAddToTasksButton()).toBeNull();
    });
});
