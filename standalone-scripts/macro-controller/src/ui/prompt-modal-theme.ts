/**
 * prompt-modal-theme.ts — Plan-23 Step 1
 *
 * Root cause addressed: when the host OS/page reports
 * `prefers-color-scheme: light`, UA-native controls inside the injected
 * Prompt Library and Prompt Editor overlays (scrollbars, `<select>` popups,
 * `input[type=file]` button, dashed drop-zone, focus rings) render with
 * light UA defaults on top of our dark panel — producing the "broken light
 * mode" visual reported in Issue 07.
 *
 * Fix: pin `color-scheme: dark` on the two modal roots and lock the small
 * set of UA-native surfaces that leak host theme, so the overlays look
 * identical regardless of host preference. This preserves the project's
 * enforced dark-only overlay policy while removing the UA bleed-through.
 *
 * A single `<style id="macro-prompt-modal-theme">` element is appended to
 * `document.head` once per document lifetime. Idempotent, no listeners,
 * no teardown required.
 */
const STYLE_ID = 'macro-prompt-modal-theme';

const CSS = [
    '#macro-prompt-library-modal,',
    '#marco-prompt-modal{',
    '  color-scheme: dark;',
    '}',
    /* Lock native scrollbar (WebKit + Firefox) so light OS does not paint white bars over the dark panel. */
    '#macro-prompt-library-modal *,',
    '#marco-prompt-modal *{',
    '  scrollbar-color:#3a4863 #121826;',
    '}',
    '#macro-prompt-library-modal *::-webkit-scrollbar,',
    '#marco-prompt-modal *::-webkit-scrollbar{',
    '  width:10px;height:10px;background:#121826;',
    '}',
    '#macro-prompt-library-modal *::-webkit-scrollbar-thumb,',
    '#marco-prompt-modal *::-webkit-scrollbar-thumb{',
    '  background:#3a4863;border-radius:6px;',
    '}',
    /* File-picker button leaks host theme in Chromium on light OS. Force dark. */
    '#macro-prompt-library-modal input[type="file"]::-webkit-file-upload-button,',
    '#marco-prompt-modal input[type="file"]::-webkit-file-upload-button{',
    '  background:#243050;color:#e6edf7;border:1px solid #3a4863;',
    '  border-radius:6px;padding:4px 10px;cursor:pointer;',
    '}',
    /* Native <select> dropdown options render with host colors otherwise. */
    '#macro-prompt-library-modal select,',
    '#marco-prompt-modal select,',
    '#macro-prompt-library-modal option,',
    '#marco-prompt-modal option{',
    '  background:#0f1522;color:#e6edf7;',
    '}',
    /* Placeholder text: some UAs default to CanvasText, unreadable on dark panel in light OS. */
    '#macro-prompt-library-modal ::placeholder,',
    '#marco-prompt-modal ::placeholder{',
    '  color:#7a8699;opacity:1;',
    '}',
    /* Selection color: light OS uses very light default, wash-out on our dark bg. */
    '#macro-prompt-library-modal ::selection,',
    '#marco-prompt-modal ::selection{',
    '  background:#3a2f6b;color:#ffe08a;',
    '}',
    /* Under prefers-color-scheme:light some UAs still tint inputs. Re-assert. */
    '@media (prefers-color-scheme: light){',
    '  #macro-prompt-library-modal input,',
    '  #macro-prompt-library-modal textarea,',
    '  #macro-prompt-library-modal select,',
    '  #marco-prompt-modal input,',
    '  #marco-prompt-modal textarea,',
    '  #marco-prompt-modal select{',
    '    background:#0f1522 !important;color:#e6edf7 !important;',
    '    border-color:#2b3648 !important;',
    '  }',
    '}',
].join('\n');

/**
 * Append the theme <style> exactly once. Safe to call before or after the
 * modals mount. No-op if already injected or if document is unavailable
 * (unit-test environments without JSDOM window).
 */
export function ensurePromptModalTheme(): void {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}
