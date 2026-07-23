/**
 * v4.197.0: verifies the "Last import error" area in the History panel
 * shows the most recent suppressed error message + timestamp, and can
 * be dismissed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../db/prompt-revision-db', () => ({
  listPromptRevisions: vi.fn(),
  insertImportedRevisions: vi.fn(),
  getMaxRevisionId: vi.fn(async () => ({ ok: true, value: 100 })),
  deleteImportedRevisionsAfter: vi.fn(async () => ({ ok: true, value: 0 })),
}));
vi.mock('../../db/prompt-db', () => ({
  listPromptsByRole: vi.fn(),
  getDefaultPromptForRole: vi.fn(),
  upsertPrompt: vi.fn(),
  deletePromptById: vi.fn(),
}));
vi.mock('../../error-utils', () => ({
  logError: vi.fn(),
  logDiagnosticFromCode: vi.fn(),
  reportDiagnostic: vi.fn(() => ({ toast: { title: '', body: '', footerCode: '', severity: 'error' } })),
}));
vi.mock('../../toast', () => ({ showToast: vi.fn() }));

import {
  openPromptHistoryPanel,
  _resetImportFailureDedupeForTests,
  _resetLastImportErrorForTests,
  _getLastImportErrorForTests,
} from '../prompt-history-panel';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  _resetImportFailureDedupeForTests();
  _resetLastImportErrorForTests();
});

async function openEmptyPanel(): Promise<void> {
  const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
  await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions, toast: vi.fn() });
}

function makeFile(size: number, name = 'huge.json', type = 'application/json'): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe('Last import error area', () => {
  it('is hidden by default when no import has failed', async () => {
    await openEmptyPanel();
    const host = document.querySelector<HTMLElement>('[data-role="last-import-error"]');
    expect(host).not.toBeNull();
    expect(host!.style.display).toBe('none');
    expect(_getLastImportErrorForTests()).toBeNull();
  });

  it('renders the message and a timestamp after an oversized-file rejection', async () => {
    await openEmptyPanel();

    const input = document.querySelector<HTMLInputElement>('input[data-testid="history-import-input"]');
    expect(input).not.toBeNull();
    // Simulate a 6MB file (cap is 5MB).
    const oversized = makeFile(6 * 1024 * 1024);
    Object.defineProperty(input!, 'files', { value: [oversized], configurable: true });
    input!.dispatchEvent(new Event('change'));
    // handleImportFile is async; wait one microtask.
    await new Promise((r) => setTimeout(r, 0));

    const captured = _getLastImportErrorForTests();
    expect(captured).not.toBeNull();
    expect(captured!.key).toBe('oversized');
    expect(typeof captured!.at).toBe('number');

    const host = document.querySelector<HTMLElement>('[data-role="last-import-error"]')!;
    expect(host.style.display).toBe('flex');
    const messageNode = host.querySelector('[data-role="last-import-error-message"]');
    const when = host.querySelector('[data-role="last-import-error-when"]');
    expect(messageNode?.textContent).toContain('oversized');
    expect(messageNode?.textContent).toContain('rejected oversized file');
    expect(when?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('is dismissible via the clear button', async () => {
    await openEmptyPanel();
    const input = document.querySelector<HTMLInputElement>('input[data-testid="history-import-input"]')!;
    Object.defineProperty(input, 'files', { value: [makeFile(6 * 1024 * 1024)], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const clear = document.querySelector<HTMLButtonElement>('button[data-action="clear-last-import-error"]');
    expect(clear).not.toBeNull();
    clear!.click();

    expect(_getLastImportErrorForTests()).toBeNull();
    const host = document.querySelector<HTMLElement>('[data-role="last-import-error"]')!;
    expect(host.style.display).toBe('none');
  });

  it('overwrites with the freshest error even when telemetry is deduped', async () => {
    await openEmptyPanel();
    const input = document.querySelector<HTMLInputElement>('input[data-testid="history-import-input"]')!;

    // First failure: oversized.
    Object.defineProperty(input, 'files', { value: [makeFile(6 * 1024 * 1024)], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    const first = _getLastImportErrorForTests();
    expect(first?.key).toBe('oversized');

    // Second failure with a different key: wrong-type. Even if dedup
    // silences the second `oversized` line, a new distinct failure must
    // replace the UI slot.
    Object.defineProperty(input, 'files', { value: [makeFile(1024, 'bad.txt', 'text/plain')], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const second = _getLastImportErrorForTests();
    expect(second?.key).toBe('wrong-type');
    const messageNode = document.querySelector('[data-role="last-import-error-message"]');
    expect(messageNode?.textContent).toContain('wrong-type');
  });
});
