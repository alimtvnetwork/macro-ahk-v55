/**
 * editor-text unit tests.
 *
 * Regression guard for the Repeat function newline bug: contenteditable
 * paragraphs used to collapse to a single line because `Element.textContent`
 * discards block boundaries. `extractEditorPlainText` must emit `\n` between
 * `<p>`/`<div>` siblings and for `<br>`; `replaceEditorText` must re-insert
 * those newlines as paragraph breaks in a contenteditable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: vi.fn() };
});

import { extractEditorPlainText, replaceEditorText } from '../editor-text';

function makeContentEditable(html: string): HTMLElement {
  const element = document.createElement('div');
  element.contentEditable = 'true';
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

describe('extractEditorPlainText — newline preservation', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('separates <p> siblings with a single newline', () => {
    const element = makeContentEditable('<p>line 1</p><p>line 2</p><p>line 3</p>');
    expect(extractEditorPlainText(element)).toBe('line 1\nline 2\nline 3');
  });

  it('converts <br> to \\n inside a paragraph', () => {
    const element = makeContentEditable('<p>first<br>second<br>third</p>');
    expect(extractEditorPlainText(element)).toBe('first\nsecond\nthird');
  });

  it('handles nested <div> block wrappers (ProseMirror-style)', () => {
    const element = makeContentEditable('<div>alpha</div><div>beta</div><div><br></div><div>gamma</div>');
    const out = extractEditorPlainText(element);
    expect(out).toBe('alpha\nbeta\n\ngamma');
  });

  it('collapses 3+ consecutive newlines to 2', () => {
    const element = makeContentEditable('<p>a</p><p><br></p><p><br></p><p><br></p><p>b</p>');
    expect(extractEditorPlainText(element)).toBe('a\n\nb');
  });

  it('reads textarea value directly', () => {
    const ta = document.createElement('textarea');
    ta.value = 'row1\nrow2\nrow3';
    expect(extractEditorPlainText(ta)).toBe('row1\nrow2\nrow3');
  });

  it('regression: textContent alone would flatten this to one line', () => {
    const element = makeContentEditable('<p>one</p><p>two</p>');
    expect(element.textContent).toBe('onetwo'); // documenting the broken baseline
    expect(extractEditorPlainText(element)).toBe('one\ntwo'); // fixed
  });
});

describe('replaceEditorText — newline re-injection', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('writes text with newlines back into a textarea verbatim', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const isOk = replaceEditorText(ta, 'line 1\nline 2\nline 3');
    expect(isOk).toBe(true);
    expect(ta.value).toBe('line 1\nline 2\nline 3');
  });

  it('invokes execCommand insertParagraph between lines for contenteditable', () => {
    const element = makeContentEditable('<p>old</p>');
    const calls: Array<[string, string | undefined]> = [];
    const stub = (cmd: string, _ui?: boolean, value?: string): boolean => {
      calls.push([cmd, value]);
      return true;
    };
    const original = (document as unknown as { execCommand?: unknown }).execCommand;
    (document as unknown as { execCommand: unknown }).execCommand = stub;
    try {
      const isOk = replaceEditorText(element, 'a\nb\nc');
      expect(isOk).toBe(true);
      const paragraphCount = calls.filter(([c]) => c === 'insertParagraph').length;
      const insertTextValues = calls.filter(([c]) => c === 'insertText').map(([, v]) => v);
      expect(paragraphCount).toBe(2); // one break between each of the 3 lines
      expect(insertTextValues).toEqual(['a', 'b', 'c']);
    } finally {
      (document as unknown as { execCommand: unknown }).execCommand = original as unknown;
    }
  });
});
