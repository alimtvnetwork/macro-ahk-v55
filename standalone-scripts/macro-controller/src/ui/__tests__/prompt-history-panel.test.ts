/**
 * openPromptHistoryPanel:
 * - Resolves the slug via getDefaultPromptForRole when not supplied.
 * - Renders one revision row per PromptRevision returned by listPromptRevisions.
 * - Restore path calls upsertPrompt with the revision body + ReplaceKey +
 *   parsed ReplaceValues, uses the live row Id when available, and toasts
 *   success on ok. Errors surface as toast('error') and never throw.
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
vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../toast', () => ({ showToast: vi.fn() }));

import { openPromptHistoryPanel, buildRevisionExportPayload, parseRevisionImportPayload, _resetImportFailureDedupeForTests } from '../prompt-history-panel';

const makeRev = (over: Partial<Record<string, unknown>> = {}) => ({
  Id: 10,
  PromptId: 1,
  Slug: 'plan-default',
  Name: 'Plan default',
  Body: 'old body {{n}}',
  Role: 'plan',
  ReplaceKey: 'n',
  ReplaceValues: '["3","5"]',
  CreatedAt: 1_700_000_000_000,
  Reason: 'upsert',
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  _resetImportFailureDedupeForTests();
});

describe('openPromptHistoryPanel', () => {
  it('renders one row per revision with restore button and preview', async () => {
    const toast = vi.fn();
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev(), makeRev({ Id: 11, Body: 'older body {{n}}' })] });
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, toast },
    );
    const rows = document.querySelectorAll('[data-role="revision-row"]');
    expect(rows.length).toBe(2);
    expect(document.querySelectorAll('[data-action="restore-revision"]').length).toBe(2);
    expect(document.body.textContent).toContain('old body');
  });

  it('shows empty-state copy when there are zero revisions', async () => {
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions });
    expect(document.body.textContent).toContain('No revisions yet');
  });

  it('resolves slug from getDefaultPromptForRole when input.slug omitted', async () => {
    const getDefault = vi.fn().mockResolvedValue({ ok: true, value: { Slug: 'next-default' } });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'next' }, { getDefault, listRevisions });
    expect(getDefault).toHaveBeenCalledWith('next');
    expect(listRevisions).toHaveBeenCalledWith('next-default');
  });

  it('toasts error and renders nothing when listRevisions fails', async () => {
    const toast = vi.fn();
    const listRevisions = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });
    await openPromptHistoryPanel({ role: 'plan', slug: 's' }, { listRevisions, toast });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error');
    expect(document.getElementById('marco-prompt-history-panel')).toBeNull();
  });

  it('restore calls upsertPrompt with parsed ReplaceValues and current row Id', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const listByRole = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ Id: 42, Slug: 'plan-default', Body: 'live body', Role: 'plan', ReplaceKey: 'n' }],
    });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const toast = vi.fn();
    const undoToast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, toast, undoToast, confirmFn: () => true },
    );
    const btn = document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.id).toBe(42);
    expect(arg.body).toBe('old body {{n}}');
    expect(arg.replaceKey).toBe('n');
    expect(arg.replaceValues).toEqual(['3', '5']);
    expect(arg.previousBody).toBe('live body');
    // v4.185.0: success now surfaces via undoToast (with an Undo button),
    // not a plain toast, when a pre-restore row exists.
    expect(undoToast).toHaveBeenCalledWith(expect.stringContaining('Restored'), expect.any(Function), expect.any(Object));
  });

  it('restore aborts when user cancels the confirm', async () => {
    const upsert = vi.fn();
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, upsert, confirmFn: () => false },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(upsert).not.toHaveBeenCalled();
  });

  it('restore surfaces upsert failures as error toast', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: false, error: 'drift guard' });
    const listByRole = vi.fn().mockResolvedValue({ ok: true, value: [] });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const toast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, toast, confirmFn: () => true },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('drift guard'), 'error');
  });

  it('close button removes the panel', async () => {
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'plan', slug: 's' }, { listRevisions });
    const panel = document.getElementById('marco-prompt-history-panel');
    expect(panel).not.toBeNull();
    (panel!.querySelector('button[aria-label="Close history panel"]') as HTMLButtonElement).click();
    expect(document.getElementById('marco-prompt-history-panel')).toBeNull();
  });

  it('renders an Export JSON button that triggers a download anchor click', async () => {
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    // Stub URL.createObjectURL / revokeObjectURL (not implemented in jsdom).
    const created: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => { const u = 'blob:mock-' + created.length; created.push(u); return u; });
    URL.revokeObjectURL = vi.fn();
    const clicked: string[] = [];
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicked.push(this.getAttribute('download') ?? ''); };
    try {
      await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions });
      const exportBtn = document.querySelector('[data-action="export-history"]') as HTMLButtonElement;
      expect(exportBtn).not.toBeNull();
      exportBtn.click();
      expect(created.length).toBe(1);
      expect(clicked.length).toBe(1);
      expect(clicked[0]).toContain('prompt-history-plan-default-');
      expect(clicked[0]).toMatch(/\.json$/);
    } finally {
      HTMLAnchorElement.prototype.click = originalAnchorClick;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('buildRevisionExportPayload produces a stable schema-versioned payload', () => {
    const payload = buildRevisionExportPayload('plan-default', 'plan', [makeRev()], 1_700_000_000_000);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.slug).toBe('plan-default');
    expect(payload.role).toBe('plan');
    expect(payload.exportedAt).toBe(1_700_000_000_000);
    expect(payload.revisionCount).toBe(1);
    expect(payload.revisions).toHaveLength(1);
  });

  it('parseRevisionImportPayload accepts a matching schema-v1 payload (v4.183.0)', () => {
    const payload = buildRevisionExportPayload('plan-default', 'plan', [makeRev()], 1_700_000_000_000);
    const parsed = parseRevisionImportPayload(JSON.stringify(payload), 'plan-default', 'plan');
    expect(parsed.ok).toBe(true);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows?.[0].Body).toBe('old body {{n}}');
    expect(parsed.rows?.[0].CreatedAt).toBe(1_700_000_000_000);
  });

  it('parseRevisionImportPayload rejects slug/role/schema mismatches (v4.183.0)', () => {
    const good = buildRevisionExportPayload('plan-default', 'plan', [makeRev()]);
    expect(parseRevisionImportPayload(JSON.stringify(good), 'other-slug', 'plan').ok).toBe(false);
    expect(parseRevisionImportPayload(JSON.stringify(good), 'plan-default', 'next').ok).toBe(false);
    expect(parseRevisionImportPayload('not json{', 'plan-default', 'plan').ok).toBe(false);
    const bad = { ...good, schemaVersion: 99 };
    expect(parseRevisionImportPayload(JSON.stringify(bad), 'plan-default', 'plan').ok).toBe(false);
  });

  // ── v4.185.0: undo-toast on restore ─────────────────────────────────
  it('restore invokes undoToast with the success message when a current row exists', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const listByRole = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ Id: 42, Slug: 'plan-default', Body: 'live body', Role: 'plan', ReplaceKey: 'n', ReplaceValues: '["7"]' }],
    });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const toast = vi.fn();
    const undoToast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, toast, undoToast, confirmFn: () => true },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(undoToast).toHaveBeenCalledTimes(1);
    expect(undoToast.mock.calls[0][0]).toMatch(/Restored/);
    expect(typeof undoToast.mock.calls[0][1]).toBe('function');
    // Plain success toast is NOT emitted when the undo path is taken.
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('Restored'), 'success');
  });

  it('undoToast onUndo callback re-upserts the pre-restore body', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const listByRole = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ Id: 42, Slug: 'plan-default', Body: 'live body', Role: 'plan', ReplaceKey: 'n', ReplaceValues: '["7"]' }],
    });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const undoToast = vi.fn();
    const toast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, toast, undoToast, confirmFn: () => true },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // First upsert = the restore itself.
    expect(upsert).toHaveBeenCalledTimes(1);
    // Trigger the undo callback captured by showUndoToast.
    const onUndo = undoToast.mock.calls[0][1] as () => Promise<void>;
    await onUndo();
    expect(upsert).toHaveBeenCalledTimes(2);
    const revertArgs = upsert.mock.calls[1][0];
    expect(revertArgs.id).toBe(42);
    expect(revertArgs.body).toBe('live body');
    expect(revertArgs.replaceValues).toEqual(['7']);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Reverted'), 'success');
  });

  it('restore wraps insert-path success in undoToast; onUndo deletes the just-inserted row', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true, value: 99 });
    const listByRole = vi.fn().mockResolvedValue({ ok: true, value: [] });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const deletePrompt = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const undoToast = vi.fn();
    const toast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, deletePrompt, toast, undoToast, confirmFn: () => true },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // Insert path now also surfaces via undoToast, never a bare success toast.
    expect(undoToast).toHaveBeenCalledTimes(1);
    expect(undoToast.mock.calls[0][0]).toMatch(/Restored/);
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('Restored'), 'success');
    // Invoke the undo callback and assert it deletes the freshly-inserted id.
    const onUndo = undoToast.mock.calls[0][1] as () => Promise<void>;
    await onUndo();
    expect(deletePrompt).toHaveBeenCalledWith(99);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Removed restored row'), 'success');
  });

  it('restore insert-path undo surfaces a toast when deletePromptById fails (last-row guard)', async () => {
    const upsert = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const listByRole = vi.fn().mockResolvedValue({ ok: true, value: [] });
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [makeRev()] });
    const deletePrompt = vi.fn().mockResolvedValue({ ok: false, error: 'refuse to delete last row for role plan' });
    const undoToast = vi.fn();
    const toast = vi.fn();
    await openPromptHistoryPanel(
      { role: 'plan', slug: 'plan-default' },
      { listRevisions, listByRole, upsert, deletePrompt, toast, undoToast, confirmFn: () => true },
    );
    (document.querySelector('[data-action="restore-revision"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const onUndo = undoToast.mock.calls[0][1] as () => Promise<void>;
    await onUndo();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Undo failed'), 'error');
  });

  // ── v4.185.0: diagnostic dedupe on import failures ─────────────────
  it('handleImportFile dedupes identical rejection logs within the window', async () => {
    const errMod = await import('../../error-utils');
    const logDiag = vi.mocked(errMod.logDiagnosticFromCode);
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions });
    const input = document.querySelector('[data-testid="history-import-input"]') as HTMLInputElement;
    for (let i = 0; i < 3; i += 1) {
      const bigFile = new File(['x'.repeat(10)], 'big.json', { type: 'application/json' });
      Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
      Object.defineProperty(input, 'files', { configurable: true, value: [bigFile] });
      input.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 0));
    }
    const oversizedCalls = logDiag.mock.calls.filter((c: unknown[]) =>
      c[0] === 'HISTORY_IMPORT_E001'
      && typeof c[1] === 'object' && c[1] !== null
      && (c[1] as Record<string, unknown>).stage === 'oversized',
    );
    expect(oversizedCalls.length).toBe(1);
  });

  // ── v4.197.0: hourly rate cap survives dedupe-window rollover ─────────
  it('handleImportFile caps oversized emissions at 5/hour even across dedupe windows', async () => {
    const errMod = await import('../../error-utils');
    const logDiag = vi.mocked(errMod.logDiagnosticFromCode);
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions });
    const input = document.querySelector('[data-testid="history-import-input"]') as HTMLInputElement;

    let clock = 1_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      for (let i = 0; i < 12; i += 1) {
        const bigFile = new File(['x'], 'big.json', { type: 'application/json' });
        Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
        Object.defineProperty(input, 'files', { configurable: true, value: [bigFile] });
        input.dispatchEvent(new Event('change'));
        await new Promise((r) => setTimeout(r, 0));
        clock += 90_000;
      }
    } finally {
      spy.mockRestore();
    }
    const oversizedCalls = logDiag.mock.calls.filter((c: unknown[]) =>
      c[0] === 'HISTORY_IMPORT_E001'
      && typeof c[1] === 'object' && c[1] !== null
      && (c[1] as Record<string, unknown>).stage === 'oversized',
    );
    expect(oversizedCalls.length).toBe(5);
  });

  it('diagnostic dedupe is keyed per code: distinct stages still emit within window', async () => {
    const errMod = await import('../../error-utils');
    const logDiag = vi.mocked(errMod.logDiagnosticFromCode);
    const listRevisions = vi.fn().mockResolvedValue({ ok: true, value: [] });
    await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, { listRevisions });
    const input = document.querySelector('[data-testid="history-import-input"]') as HTMLInputElement;

    const big = new File(['x'], 'big.json', { type: 'application/json' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { configurable: true, value: [big] });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const wrong = new File(['{}'], 'nope.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [wrong] });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const stages = logDiag.mock.calls
      .filter((c: unknown[]) => c[0] === 'HISTORY_IMPORT_E001')
      .map((c: unknown[]) => (c[1] as Record<string, unknown>).stage);
    expect(stages).toContain('oversized');
    expect(stages).toContain('wrong-type');
  });



  // ── v4.186.0: Import Undo path ───────────────────────────────────────
  it('handleImportFile wraps success in undoToast; onUndo deletes only rows Id>sinceId', async () => {
    const revDbMod = await import('../../db/prompt-revision-db');
    const revDb = {
      listPromptRevisions: vi.mocked(revDbMod.listPromptRevisions),
      insertImportedRevisions: vi.mocked(revDbMod.insertImportedRevisions),
      getMaxRevisionId: vi.mocked(revDbMod.getMaxRevisionId),
      deleteImportedRevisionsAfter: vi.mocked(revDbMod.deleteImportedRevisionsAfter),
    };
    revDb.listPromptRevisions.mockResolvedValue({ ok: true, value: [] });
    revDb.getMaxRevisionId.mockResolvedValue({ ok: true, value: 42 });
    revDb.insertImportedRevisions.mockResolvedValue({ ok: true, value: 3 });
    revDb.deleteImportedRevisionsAfter.mockResolvedValue({ ok: true, value: 0 });
    const undoToast = vi.fn();
    const toast = vi.fn();
    await openPromptHistoryPanel({ role: 'plan', slug: 'plan-default' }, {
      listRevisions: revDb.listPromptRevisions,
      undoToast,
      toast,
    });
    const input = document.querySelector('[data-testid="history-import-input"]') as HTMLInputElement;
    const payload = JSON.stringify({
      schemaVersion: 1,
      slug: 'plan-default',
      role: 'plan',
      revisions: [
        { Slug: 'plan-default', Name: 'x', Body: 'b', Role: 'plan', ReplaceKey: 'n', ReplaceValues: '[]', CreatedAt: 1, Reason: 'import' },
      ],
    });
    const file = new File([payload], 'ok.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // Success surfaced via undoToast, not plain toast.
    expect(undoToast).toHaveBeenCalledTimes(1);
    expect(undoToast.mock.calls[0][0]).toMatch(/Imported 3 revision/);
    // Invoke the captured onUndo — it must call deleteImportedRevisionsAfter
    // with the snapshot Id (42), NOT some other value.
    const onUndo = undoToast.mock.calls[0][1] as () => Promise<void>;
    await onUndo();
    expect(revDb.deleteImportedRevisionsAfter).toHaveBeenCalledWith('plan-default', 42);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Reverted import'), 'success');
  });
});
