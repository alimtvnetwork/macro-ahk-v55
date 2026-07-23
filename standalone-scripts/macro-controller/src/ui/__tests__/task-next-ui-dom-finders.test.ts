/**
 * G4: DOM finder coverage for task-next-ui.
 *
 * Locks the 3-tier match cascade in findNextTasksPrompt (slug -> id ->
 * derived-slug / keywords) and the XPath-then-selectors chain in
 * findAddToTasksButton, including the disabled-button skip.
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

describe('findNextTasksPrompt — match cascade', () => {
    it('matches by slug (tier 1) when a canonical alias is present', () => {
        const entries = [
            { id: 'x', name: 'Other', slug: 'other' },
            { id: 'target', name: 'Next Steps', slug: 'next-steps' },
        ];
        const found = findNextTasksPrompt(makeDeps(entries));
        expect(found).toEqual(entries[1]);
    });

    it('matches by id (tier 2) when slugs miss but id contains alias', () => {
        const entries = [
            { id: 'default-next-tasks', name: 'Whatever', slug: 'no-match' },
        ];
        const found = findNextTasksPrompt(makeDeps(entries));
        expect(found).toEqual(entries[0]);
    });

    it('matches by derived slug from name (tier 3a)', () => {
        const entries = [
            { id: 'a', name: 'Next Tasks', slug: 'unrelated' },
        ];
        const found = findNextTasksPrompt(makeDeps(entries));
        // derived-slug: "next-tasks" is an alias -> hit.
        expect(found).toEqual(entries[0]);
    });

    it('matches by keyword heuristic on name (tier 3b)', () => {
        const entries = [
            { id: 'a', name: 'Do the Next Step Please', slug: 'unmatchable' },
        ];
        const found = findNextTasksPrompt(makeDeps(entries));
        expect(found).toEqual(entries[0]);
    });

    it('returns null when nothing matches across all tiers', () => {
        const entries = [
            { id: 'a', name: 'Unrelated', slug: 'foo' },
            { id: 'b', name: 'Also Unrelated', slug: 'bar' },
        ];
        const found = findNextTasksPrompt(makeDeps(entries));
        expect(found).toBeNull();
    });

    it('returns null when entries is empty (no throw)', () => {
        expect(findNextTasksPrompt(makeDeps([]))).toBeNull();
    });
});

describe('findAddToTasksButton — XPath then selectors', () => {
    it('returns the XPath-matched button when it exists and is enabled', () => {
        // Configure the settings XPath to a real DOM node.
        const btn = document.createElement('button');
        btn.id = 'via-xpath';
        btn.textContent = 'Go';
        document.body.appendChild(btn);
        taskNextState.settings.buttonXPath = '//button[@id="via-xpath"]';

        expect(findAddToTasksButton()).toBe(btn);
    });

    it('skips a disabled XPath-matched button and falls through to selectors', () => {
        const disabled = document.createElement('button');
        disabled.id = 'via-xpath';
        disabled.setAttribute('disabled', 'true');
        (disabled as HTMLButtonElement).disabled = true;
        document.body.appendChild(disabled);
        taskNextState.settings.buttonXPath = '//button[@id="via-xpath"]';

        // Selector-tier candidate: form > submit button.
        const form = document.createElement('form');
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.id = 'via-selector';
        form.appendChild(submit);
        document.body.appendChild(form);

        expect(findAddToTasksButton()).toBe(submit);
    });

    it('finds a submit button via form selector when XPath yields no node', () => {
        taskNextState.settings.buttonXPath = '//does/not/exist';
        const form = document.createElement('form');
        const submit = document.createElement('button');
        submit.type = 'submit';
        form.appendChild(submit);
        document.body.appendChild(form);
        expect(findAddToTasksButton()).toBe(submit);
    });

    it('finds a button via aria-label selector when form has none', () => {
        taskNextState.settings.buttonXPath = '//does/not/exist';
        const btn = document.createElement('button');
        btn.setAttribute('aria-label', 'Send message');
        document.body.appendChild(btn);
        expect(findAddToTasksButton()).toBe(btn);
    });

    it('returns null when neither XPath nor any selector matches', () => {
        taskNextState.settings.buttonXPath = '//nope';
        expect(findAddToTasksButton()).toBeNull();
    });

    it('does not throw on a malformed XPath (falls through to selectors)', () => {
        taskNextState.settings.buttonXPath = 'not a valid xpath [[[';
        const btn = document.createElement('button');
        btn.setAttribute('aria-label', 'send');
        document.body.appendChild(btn);
        expect(() => findAddToTasksButton()).not.toThrow();
        expect(findAddToTasksButton()).toBe(btn);
    });
});
