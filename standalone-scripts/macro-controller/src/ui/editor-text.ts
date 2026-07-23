/**
 * Editor Text Helpers
 *
 * Extract and re-inject plain text with newline preservation for
 * contenteditable editors (ProseMirror in Lovable chat and similar).
 *
 * Root cause fixed here: `Element.textContent` concatenates descendant
 * text nodes with no separator, so `<p>line 1</p><p>line 2</p>` becomes
 * `"line 1line 2"`. `execCommand('insertText', "...\n...")` also cannot
 * reintroduce paragraph breaks in ProseMirror. This module preserves
 * `\n` on read (block boundaries + `<br>`) and splits + `insertParagraph`
 * between lines on write.
 *
 * @see standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts
 */

import { logError } from '../error-utils';

const SCOPE = 'EditorText';
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'TR', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER',
]);

function isBlockElement(element: Element): boolean {
  return BLOCK_TAGS.has(element.tagName);
}

function walkNode(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.nodeValue || '');
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (element.tagName === 'BR') { out.push('\n'); return; }
  const isBlock = isBlockElement(element);
  if (isBlock && out.length > 0 && !out[out.length - 1].endsWith('\n')) out.push('\n');
  for (const child of Array.from(element.childNodes)) walkNode(child, out);
  if (isBlock && out.length > 0 && !out[out.length - 1].endsWith('\n')) out.push('\n');
}

/**
 * Extract plain text from a contenteditable element preserving newlines.
 * `<br>` becomes `\n`; block-level elements are separated by `\n`.
 * Also collapses runs of 3+ newlines to 2 so blank-line runs don't grow.
 */
export function extractEditorPlainText(target: Element): string {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return target.value || '';
  }
  const parts: string[] = [];
  walkNode(target, parts);
  const joined = parts.join('').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return joined.replace(/^\n+/, '').replace(/\n+$/, '');
}

function selectAllInside(editor: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertLineWithBreaks(line: string, isFirst: boolean): boolean {
  if (!isFirst) {
    const isParaOk = document.execCommand('insertParagraph', false);
    if (!isParaOk) document.execCommand('insertLineBreak', false);
  }
  if (!line) return true;
  return document.execCommand('insertText', false, line);
}

/**
 * Replace the contents of a contenteditable/input with `text`, preserving
 * `\n` as paragraph breaks. Returns true if the write succeeded.
 */
export function replaceEditorText(target: Element, text: string): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return writeTextInput(target, text);
  }
  return writeContentEditable(target as HTMLElement, text);
}

function writeTextInput(target: HTMLTextAreaElement | HTMLInputElement, text: string): boolean {
  try {
    const proto = target instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(target, text);
    else target.value = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    logError(SCOPE, 'writeTextInput failed', e);
    return false;
  }
}

function writeContentEditable(editor: HTMLElement, text: string): boolean {
  try {
    editor.focus();
    selectAllInside(editor);
    document.execCommand('delete', false);
    const lines = text.split('\n');
    let allOk = true;
    for (let i = 0; i < lines.length; i++) {
      const isFirst = i === 0;
      const isOk = insertLineWithBreaks(lines[i], isFirst);
      if (!isOk) allOk = false;
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return allOk;
  } catch (e) {
    logError(SCOPE, 'writeContentEditable failed', e);
    return false;
  }
}
