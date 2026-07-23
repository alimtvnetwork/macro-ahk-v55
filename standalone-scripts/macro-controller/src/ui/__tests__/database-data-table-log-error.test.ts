/**
 * Regression: database-data-table `loadTableData` must route dynamic-import
 * failures through the shared `logError` helper (no bare `console.error`).
 *
 * Guards against a re-introduction of the ESLint `no-restricted-syntax`
 * violation flagged in CI and confirms the error is namespaced correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logErrorSpy = vi.fn();

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: logErrorSpy };
});

// Force the dynamic `import('./database-modal-data')` inside the module to reject.
vi.mock('../database-modal-data', () => {
  throw new Error('simulated module-load failure');
});

describe('database-data-table.loadTableData — error routing', () => {
  beforeEach(() => { logErrorSpy.mockClear(); });
  afterEach(() => { vi.resetModules(); });

  it('calls logError with the databaseDataTable scope when the dynamic import rejects', async () => {
    const mod = await import('../database-data-table');
    // `loadTableData` is module-private; re-render pagination to exercise it indirectly.
    // Fallback: reach into the file's export surface via the built pagination handler.
    const content = document.createElement('div');
    const statusBar = document.createElement('div');
    // Call the internal function via the exported pagination builder which wires it up.
    // page=1 with totalCount=100 → Prev is enabled and wires loadTableData.
    const pager = mod.buildPagination('tbl', 1, 100, content, statusBar);
    const prev = pager.querySelector('button');
    expect(prev).not.toBeNull();
    (prev as HTMLButtonElement).click();

    // Allow the microtask queue to drain the rejected dynamic import.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(logErrorSpy).toHaveBeenCalled();
    const [scope, message] = logErrorSpy.mock.calls[0];
    expect(scope).toBe('databaseDataTable.loadTableData');
    expect(String(message)).toMatch(/dynamic import failed/i);
  });
});
