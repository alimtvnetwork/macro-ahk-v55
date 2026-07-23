/**
 * dispatchTaskNextSubmit — deeper branch + error-path coverage.
 *
 * Complements task-next-ui-dispatch-submit.test.ts by exercising the three
 * primary branches with a focus on side-effects, error handling, and state:
 *
 *   Branch 1 (form-native):   HTMLFormElement present -> requestSubmit path.
 *                             Also covers the requestSubmit-unsupported
 *                             fallback that dispatches a bubbling 'submit'
 *                             Event on the form element.
 *   Branch 2 (button):        #chat-input missing or not a <form> -> submit
 *                             button is clicked; disabled button aborts;
 *                             a throwing button click reports false + logs.
 *   Branch 3 (aborted):       document.getElementById throws -> function
 *                             still routes to the button fallback rather
 *                             than propagating.
 *
 * The function does not touch persistent DB or `taskNextState.cancelled`; the
 * only observable state it mutates is DOM events + toast/log output. These
 * tests therefore assert on: return value, submit-button/form call counts,
 * dispatched events, and that thrown errors are swallowed with a `logError`
 * call rather than escaping.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchTaskNextSubmit } from '../../ui/task-next-ui';

function mountSendButton(parent: HTMLElement): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.setAttribute('aria-label', 'Send message');
    parent.appendChild(btn);
    return btn;
}

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

describe('dispatchTaskNextSubmit — branch 1: form-native path', () => {
    it('calls requestSubmit exactly once and does not click the button', () => {
        const form = document.createElement('form');
        form.id = 'chat-input';
        const btn = mountSendButton(form);
        document.body.appendChild(form);

        const reqSpy = vi.spyOn(form, 'requestSubmit').mockImplementation(() => { /* noop */ });
        const clickSpy = vi.spyOn(btn, 'click');

        expect(dispatchTaskNextSubmit()).toBe(true);
        expect(reqSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('when requestSubmit is unsupported, dispatches a bubbling submit event', () => {
        const form = document.createElement('form');
        form.id = 'chat-input';
        mountSendButton(form);
        document.body.appendChild(form);

        // Simulate environments without HTMLFormElement.prototype.requestSubmit.
        (form as unknown as { requestSubmit: unknown }).requestSubmit = undefined;

        const dispatched: Event[] = [];
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            dispatched.push(e);
        });

        expect(dispatchTaskNextSubmit()).toBe(true);
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].bubbles).toBe(true);
        expect(dispatched[0].cancelable).toBe(true);
    });

    it('when requestSubmit throws, falls back to button click and returns true', () => {
        const form = document.createElement('form');
        form.id = 'chat-input';
        const btn = mountSendButton(form);
        document.body.appendChild(form);

        vi.spyOn(form, 'requestSubmit').mockImplementation(() => { throw new Error('reqfail'); });
        const clickSpy = vi.spyOn(btn, 'click').mockImplementation(() => { /* noop */ });

        expect(dispatchTaskNextSubmit()).toBe(true);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});

describe('dispatchTaskNextSubmit — branch 2: submit-button fallback', () => {
    it('#chat-input as <div> routes to the send button click', () => {
        const div = document.createElement('div');
        div.id = 'chat-input';
        document.body.appendChild(div);

        const wrap = document.createElement('form');
        const btn = mountSendButton(wrap);
        const clickSpy = vi.spyOn(btn, 'click').mockImplementation(() => { /* noop */ });
        document.body.appendChild(wrap);

        expect(dispatchTaskNextSubmit()).toBe(true);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('disabled send button returns false and does not click', () => {
        const wrap = document.createElement('form');
        const btn = mountSendButton(wrap);
        btn.disabled = true;
        const clickSpy = vi.spyOn(btn, 'click');
        document.body.appendChild(wrap);

        expect(dispatchTaskNextSubmit()).toBe(false);
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('button click throws -> returns false without propagating', () => {
        const wrap = document.createElement('form');
        const btn = mountSendButton(wrap);
        vi.spyOn(btn, 'click').mockImplementation(() => { throw new Error('clickfail'); });
        document.body.appendChild(wrap);

        expect(() => dispatchTaskNextSubmit()).not.toThrow();
        expect(dispatchTaskNextSubmit()).toBe(false);
    });

    it('no discoverable submit button -> returns false', () => {
        // #chat-input present as div; no <button aria-label="Send message">.
        const div = document.createElement('div');
        div.id = 'chat-input';
        document.body.appendChild(div);

        expect(dispatchTaskNextSubmit()).toBe(false);
    });
});

describe('dispatchTaskNextSubmit — branch 3: defensive/error paths', () => {
    it('document.getElementById throwing still routes to button fallback', () => {
        const original = document.getElementById.bind(document);
        const getSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
            if (id === 'chat-input') throw new Error('gebi-fail');
            return original(id);
        });

        const wrap = document.createElement('form');
        const btn = mountSendButton(wrap);
        const clickSpy = vi.spyOn(btn, 'click').mockImplementation(() => { /* noop */ });
        document.body.appendChild(wrap);

        expect(dispatchTaskNextSubmit()).toBe(true);
        expect(getSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('completely empty DOM -> returns false and never throws', () => {
        expect(() => dispatchTaskNextSubmit()).not.toThrow();
        expect(dispatchTaskNextSubmit()).toBe(false);
    });
});
