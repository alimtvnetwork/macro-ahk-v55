/**
 * MacroLoop Controller — Database Data Table Rendering
 *
 * Builds the HTML table (header + body + cells), pagination controls,
 * and shared helpers (escapeHtml, truncate) for the Data tab.
 *
 * @see spec/04-macro-controller/ts-migration-v2/05-module-splitting.md
 */

import { logError } from '../error-utils';

// Plan-17 step 22: dynamic import breaks the database-modal-data ↔ database-data-table cycle.
// loadTableData is only called inside pagination click handlers, so runtime-lazy loading is safe.
function loadTableData(
  tableName: string,
  page: number,
  content: HTMLElement,
  statusBar: HTMLElement,
): void {
  import('./database-modal-data')
    .then((m) => m.loadTableData(tableName, page, content, statusBar))
    .catch((e: unknown) => {
      logError('databaseDataTable.loadTableData', 'dynamic import failed', e);
    });
}
import { DB_PAGE_SIZE as PAGE_SIZE } from '../constants';
// Plan-17 step 16: escapeHtml re-exported from leaf so consumers that only
// need escaping (e.g. database-data-filter) do NOT import data-table and
// re-close the modal-data ↔ filter ↔ data-table cycle.
export { escapeHtml } from './database-html-escape';
// ── Helpers ──

export function truncate(text: string, maxLength: number): string {
  const isWithinLimit = text.length <= maxLength;
  return isWithinLimit ? text : text.substring(0, maxLength) + '…';
}

// ── Pagination ──

export function buildPagination(
  tableName: string,
  page: number,
  totalCount: number,
  content: HTMLElement,
  statusBar: HTMLElement,
): HTMLElement {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const container = document.createElement('div');
  container.className = 'marco-db-pagination';

  const info = document.createElement('span');
  const startRow = page * PAGE_SIZE + 1;
  const endRow = Math.min((page + 1) * PAGE_SIZE, totalCount);
  info.textContent = 'Showing ' + startRow + '–' + endRow + ' of ' + totalCount + ' rows';

  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display:flex;gap:4px;';

  const prevButton = document.createElement('button');
  prevButton.className = 'marco-db-page-btn';
  prevButton.textContent = '◀ Prev';
  prevButton.disabled = page === 0;
  prevButton.onclick = () => loadTableData(tableName, page - 1, content, statusBar);

  const nextButton = document.createElement('button');
  nextButton.className = 'marco-db-page-btn';
  nextButton.textContent = 'Next ▶';
  nextButton.disabled = page >= totalPages - 1;
  nextButton.onclick = () => loadTableData(tableName, page + 1, content, statusBar);

  buttonGroup.appendChild(prevButton);
  buttonGroup.appendChild(nextButton);
  container.appendChild(info);
  container.appendChild(buttonGroup);

  return container;
}

// ── Data Table Element ──

export function buildDataTableElement(
  columns: string[],
  rows: Record<string, unknown>[],
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'marco-db-table-wrapper';

  const table = document.createElement('table');
  table.className = 'marco-db-data-table';

  table.appendChild(buildTableHeader(columns));
  table.appendChild(buildTableBody(columns, rows));

  wrapper.appendChild(table);
  return wrapper;
}

function buildTableHeader(columns: string[]): HTMLElement {
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  for (const column of columns) {
    const headerCell = document.createElement('th');
    headerCell.textContent = column;
    headerRow.appendChild(headerCell);
  }

  thead.appendChild(headerRow);
  return thead;
}

function buildTableBody(
  columns: string[],
  rows: Record<string, unknown>[],
): HTMLElement {
  const tbody = document.createElement('tbody');

  for (const row of rows) {
    const tableRow = document.createElement('tr');

    for (const column of columns) {
      const cell = buildTableCell(row[column]);
      tableRow.appendChild(cell);
    }

    tbody.appendChild(tableRow);
  }

  return tbody;
}

function buildTableCell(value: unknown): HTMLTableCellElement {
  const cell = document.createElement('td');
  const isNullish = value === null || value === undefined;

  if (isNullish) {
    cell.textContent = truncate('NULL', 100);
    cell.title = 'NULL';
    cell.style.color = '#64748b';
    cell.style.fontStyle = 'italic';
    return cell;
  }

  const isObject = typeof value === 'object';
  const displayText = isObject ? JSON.stringify(value) : String(value);

  cell.textContent = truncate(displayText, 100);
  cell.title = displayText;

  return cell;
}
