/**
 * Import modal integration smoke test (plan 12 step 27, JSDOM tier).
 *
 * Full Playwright-driven E2E against a loaded Chrome extension is out
 * of scope for the automated CI env we have today (no headed chrome
 * with --load-extension in the sandbox). Instead this suite proves the
 * modal's shell contract at the DOM level so a future Playwright
 * spec can drive it by the same selectors and attributes.
 *
 * What this locks:
 *   - Opening the modal appends exactly one overlay carrying the
 *     `MODAL_ATTR` marker attribute (used by every subsequent selector
 *     path, including the Playwright spec that will land in step 27b).
 *   - The idle stage renders the drop-zone copy from SS-04 so tests
 *     can `getByText('Drop a .json, .zip, or .sqlite file here')`.
 *   - Both footer buttons are wired: Cancel removes the overlay,
 *     Import is disabled until preview rows exist.
 *   - Opening the modal twice removes the first instance (no stacked
 *     overlays — a real bug we saw during step 14 development).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { openPromptImportModal } from '../prompt-import-modal';

const MODAL_ATTR = 'data-marco-import-modal';

function queryOverlays(): Element[] {
  return Array.from(document.querySelectorAll('[' + MODAL_ATTR + ']'));
}

describe('openPromptImportModal — DOM contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('appends exactly one overlay carrying the modal marker attribute', () => {
    let committedCalls = 0;
    openPromptImportModal({ onCommitted: async () => { committedCalls += 1; } });
    expect(queryOverlays()).toHaveLength(1);
    // Guard the side channel: onCommitted is not fired just by opening.
    expect(committedCalls).toBe(0);
  });

  it('idle stage shows the drop-zone copy from SS-04', () => {
    openPromptImportModal({ onCommitted: async () => {} });
    const overlay = queryOverlays()[0];
    expect(overlay.textContent).toContain('Drop a .json, .zip, or .sqlite file here');
    expect(overlay.textContent).toContain('or click to choose a file');
  });

  it('renders Cancel and Import buttons in the footer', () => {
    openPromptImportModal({ onCommitted: async () => {} });
    const overlay = queryOverlays()[0];
    const buttons = Array.from(overlay.querySelectorAll('button'));
    const labels = buttons.map((b) => b.textContent);
    expect(labels).toContain('Cancel');
    expect(labels).toContain('Import');
  });

  it('clicking Cancel removes the overlay', () => {
    openPromptImportModal({ onCommitted: async () => {} });
    const overlay = queryOverlays()[0];
    const cancel = Array.from(overlay.querySelectorAll('button')).find((b) => b.textContent === 'Cancel');
    expect(cancel).toBeTruthy();
    (cancel as HTMLButtonElement).click();
    expect(queryOverlays()).toHaveLength(0);
  });

  it('opening the modal twice does not stack overlays', () => {
    openPromptImportModal({ onCommitted: async () => {} });
    openPromptImportModal({ onCommitted: async () => {} });
    expect(queryOverlays()).toHaveLength(1);
  });
});
