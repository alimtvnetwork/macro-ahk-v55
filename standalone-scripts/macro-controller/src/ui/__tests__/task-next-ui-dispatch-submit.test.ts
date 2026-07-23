/**
 * G5: dispatchTaskNextSubmit three-branch coverage for task-next-ui.
 *
 * Locks the fallthrough contract in `dispatchTaskNextSubmit`:
 *   A. #chat-input IS an HTMLFormElement -> form.requestSubmit() called, returns true.
 *   B. #chat-input exists but is NOT a form -> falls through to submit button click.
 *   C. No #chat-input AND no discoverable submit button -> returns false (no throw).
 *
 * Also verifies the form-throws fallback: if requestSubmit throws, the button path runs.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchTaskNextSubmit } from '../../ui/task-next-ui';

beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'warn').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'error').mockImplementation(() => { /* silent */ });
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

function mountForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.id = 'chat-input';
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.setAttribute('aria-label', 'Send message');
    form.appendChild(btn);
    document.body.appendChild(form);
    return form;
}

describe('dispatchTaskNextSubmit — three-branch coverage', () => {
    it('A: form#chat-input triggers requestSubmit and returns true', () => {
        const form = mountForm();
        const spy = vi.spyOn(form, 'requestSubmit').mockImplementation(() => { /* noop */ });
        const result = dispatchTaskNextSubmit();
        expect(result).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('B: #chat-input as <div> falls through to submit button click', () => {
        const div = document.createElement('div');
        div.id = 'chat-input';
        document.body.appendChild(div);
        // Provide a button reachable via findAddToTasksButton selectors.
        const wrapForm = document.createElement('form');
        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.setAttribute('aria-label', 'Send message');
        const clickSpy = vi.spyOn(btn, 'click');
        wrapForm.appendChild(btn);
        document.body.appendChild(wrapForm);

        const result = dispatchTaskNextSubmit();
        expect(result).toBe(true);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('C: no #chat-input and no button -> returns false without throwing', () => {
        // Empty DOM.
        const result = dispatchTaskNextSubmit();
        expect(result).toBe(false);
    });

    it('form.requestSubmit throws -> falls back to submit button and returns true', () => {
        const form = mountForm();
        vi.spyOn(form, 'requestSubmit').mockImplementation(() => { throw new Error('boom'); });
        const btn = form.querySelector('button') as HTMLButtonElement;
        const clickSpy = vi.spyOn(btn, 'click');
        const result = dispatchTaskNextSubmit();
        expect(result).toBe(true);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('button is disabled -> returns false (no click)', () => {
        const div = document.createElement('div');
        div.id = 'chat-input';
        document.body.appendChild(div);
        const wrapForm = document.createElement('form');
        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.disabled = true;
        const clickSpy = vi.spyOn(btn, 'click');
        wrapForm.appendChild(btn);
        document.body.appendChild(wrapForm);

        const result = dispatchTaskNextSubmit();
        expect(result).toBe(false);
        expect(clickSpy).not.toHaveBeenCalled();
    });
});
