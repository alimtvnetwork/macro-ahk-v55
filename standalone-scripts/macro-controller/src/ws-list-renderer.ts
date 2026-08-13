import type { WorkspaceCredit, HTMLElementWithHandlers } from './types';
import { DataAttrType, DomIdType } from './types';
import { loopCreditState, state, getLoopWsCheckedIds, cPrimaryLight } from './shared-state';
import { log } from './logger';
import { logError } from './error-utils';
import { publishVisibleWorkspaces } from './visible-workspaces-store';
import { fetchLoopCredits, getEffectiveStatus, getWorkspaceLifecycleConfig } from './credit-fetch';
import { moveToWorkspace } from './workspace-management';
import { attachWorkspaceHoverCard, hideWorkspaceHoverCard } from './ws-hover-card';
import { autoDetectLoopCurrentWorkspace } from './workspace-detection';
import { handleWsCheckboxClick, setLoopWsNavIndex } from './ws-checkbox-handler';
import { showWsContextMenu } from './ws-context-menu';
import { SEL_LOOP_WS_ITEM, REFILL_PRIORITY_WINDOW_DAYS } from './constants';
import { sortByRefillPriority } from './workspace-refill-priority';
import { resolveCreditSummary } from './credit-balance-update/credit-summary-resolver';
import { onCreditResolved } from './credit-balance-update/credit-fetch-controller';
import { wsRenderStats } from './ws-render-stats';
import {
  viewState,
  getLoopWsFreeOnly,
  getLoopWsExpiredWithCredits,
  getLoopWsExpiring,
  getLoopWsRefillSoon,
} from './ws-view-state';
import {
  readFilterState,
  passesFilters,
  expiredRecoveryScore,
  isCurrentWorkspace,
} from './ws-filter-logic';
import { buildWsRow } from './ws-row-builder';

// Re-export the state getters/setters from ws-view-state so we don't break consumers
export {
  getLoopWsCompactMode,
  setLoopWsCompactMode,
  getLoopWsFreeOnly,
  setLoopWsFreeOnly,
  getLoopWsExpiredWithCredits,
  setLoopWsExpiredWithCredits,
  getLoopWsExpiring,
  setLoopWsExpiring,
  getLoopWsRefillSoon,
  setLoopWsRefillSoon,
  getLoopWsRefillPriority,
  setLoopWsRefillPriority,
  getLoopWsCreditSortMode,
  setLoopWsCreditSortMode,
  EXPIRED_WITH_CREDITS_MIN,
} from './ws-view-state';
export type { CreditSortModeType } from './ws-view-state';

export { buildLoopTooltipText } from './ws-tooltip-builder';
export { buildStatusPillHtml, buildTierBadgeHtml } from './ws-status-badges';
export { buildCreditPlaceholderBarHtml } from './ws-row-builder';

export function fetchLoopCreditsWithDetect(isRetry?: boolean): void {
  fetchLoopCredits(isRetry, autoDetectLoopCurrentWorkspace);
}

function computeMaxTotalCredits(workspaces: WorkspaceCredit[]): number {
  let maxTotalCredits = 1;
  for (const ws of workspaces) {
    const mtc = Math.round(resolveCreditSummary(ws).total);
    if (mtc > maxTotalCredits) {
      maxTotalCredits = mtc;
    }
  }

  return maxTotalCredits;
}

export function filterAndSortWorkspaces(
  workspaces: WorkspaceCredit[],
  filter: string,
): Array<{ ws: WorkspaceCredit; wsIndex: number }> {
  const fs = readFilterState(filter, DataAttrType.Active);
  const survivors: Array<{ ws: WorkspaceCredit; wsIndex: number }> = [];
  for (const [wsIndex, ws] of workspaces.entries()) {
    const isFilteredOut = !passesFilters(ws, fs);
    if (isFilteredOut) {
      continue;
    }

    survivors.push({ ws, wsIndex });
  }

  if (fs.expiredWithCredits) {
    survivors.sort(function (a, b) {
      return expiredRecoveryScore(b.ws) - expiredRecoveryScore(a.ws);
    });
  } else if (fs.expiring) {
    survivors.sort(function (a, b) {
      const config = getWorkspaceLifecycleConfig();
      const statusA = getEffectiveStatus(a.ws, config);
      const statusB = getEffectiveStatus(b.ws, config);
      const daysA = statusA.daysSince || 0;
      const daysB = statusB.daysSince || 0;
      if (daysB !== daysA) {
        return daysB - daysA;
      }

      return resolveCreditSummary(b.ws).available - resolveCreditSummary(a.ws).available;
    });
  } else if (viewState().getRefillPriority() || fs.refillSoon) {
    const sorted = sortByRefillPriority(survivors, REFILL_PRIORITY_WINDOW_DAYS);
    survivors.length = 0;
    for (const r of sorted) {
      survivors.push(r);
    }
  }

  if (fs.creditSortMode !== 'none') {
    const desc = fs.creditSortMode === 'high' || fs.creditSortMode === 'pro-high';
    survivors.sort(function (a, b) {
      const av = resolveCreditSummary(a.ws).available;
      const bv = resolveCreditSummary(b.ws).available;

      return desc ? bv - av : av - bv;
    });
  }

  return survivors;
}

function updateWsCountLabel(count: number, total: number, filter: string): void {
  const countLabel = document.getElementById('loop-ws-count-label');
  if (!countLabel) {
    return;
  }

  const anyFilterActive = filter || getLoopWsFreeOnly() || getLoopWsExpiredWithCredits()
    || getLoopWsExpiring() || getLoopWsRefillSoon()
    || viewState().getCreditSortMode() !== 'none' || count !== total;
  countLabel.textContent = anyFilterActive
    ? 'Workspaces (' + count + '/' + total + ')'
    : 'Workspaces (' + total + ')';
}

export function renderLoopWorkspaceList(
  workspaces: WorkspaceCredit[],
  currentName: string,
  filter: string,
): void {
  const listEl = document.getElementById('loop-ws-list');
  if (!listEl) {
    return;
  }

  const maxTotalCredits = computeMaxTotalCredits(workspaces);
  const survivors = filterAndSortWorkspaces(workspaces, filter);
  publishVisibleWorkspaces(workspaces);

  const selEl = document.getElementById(DomIdType.LoopWsSelected);
  const selIdValue = selEl ? selEl.getAttribute(DataAttrType.SelectedId) || false : false;

  const { frag, count, currentIdx } = buildWorkspaceNodes(survivors, currentName, maxTotalCredits, selIdValue);

  listEl.innerHTML = '';
  listEl.appendChild(frag);

  updateWsCountLabel(count, workspaces.length, filter);
  attachWsListEventDelegation(listEl, currentIdx, filter);
  attachHoverCardForList(listEl);
}

function buildWorkspaceNodes(
  survivors: Array<{ ws: WorkspaceCredit; wsIndex: number }>,
  currentName: string,
  maxTotalCredits: number,
  selIdValue: string | false
): { frag: DocumentFragment, count: number, currentIdx: number } {
  let count = 0;
  let currentIdx = -1;
  const frag = document.createDocumentFragment();

  for (const { ws, wsIndex } of survivors) {
    const isCurrent = isCurrentWorkspace(ws, currentName);
    if (isCurrent) {
      currentIdx = count;
    }

    frag.appendChild(buildWsRow(ws, wsIndex, isCurrent, count, maxTotalCredits, selIdValue, DataAttrType.WsId, DataAttrType.WsName, DataAttrType.WsCurrent));
    count++;
  }

  const isEmpty = count === 0;
  if (isEmpty) {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'padding:8px;color:' + cPrimaryLight + ';font-size:10px;text-align:center;';
    emptyEl.textContent = '🔍 No matches';
    frag.appendChild(emptyEl);
  }

  return { frag, count, currentIdx };
}

function attachHoverCardForList(listEl: HTMLElement): void {
  attachWorkspaceHoverCard(listEl, function (id: string) {
    const list = loopCreditState.perWorkspace || [];
    for (const w of list) {
      const wid = String(w.id || (w.raw && w.raw.id) || '');
      if (wid === id) {
        return w;
      }
    }

    return null;
  });
  hideWorkspaceHoverCard();
}

function attachWsListEventDelegation(
  listEl: HTMLElement,
  currentIdx: number,
  filter: string,
): void {
  const elWithHandlers = listEl as HTMLElementWithHandlers;
  removeExistingDelegation(listEl, elWithHandlers);
  attachNewDelegation(listEl, elWithHandlers);
  scrollToCurrentIfNeeded(listEl, currentIdx, filter);
}

function removeExistingDelegation(listEl: HTMLElement, elWithHandlers: HTMLElementWithHandlers): void {
  const hasExistingHandler = !!elWithHandlers._wsDelegateHandler;
  if (hasExistingHandler) {
    listEl.removeEventListener('click', elWithHandlers._wsDelegateHandler!);
    listEl.removeEventListener('dblclick', elWithHandlers._wsDblHandler!);
    listEl.removeEventListener('contextmenu', elWithHandlers._wsCtxHandler!);
    listEl.removeEventListener('mouseover', elWithHandlers._wsHoverHandler!);
    listEl.removeEventListener('mouseout', elWithHandlers._wsOutHandler!);
  }
}

function attachNewDelegation(listEl: HTMLElement, elWithHandlers: HTMLElementWithHandlers): void {
  elWithHandlers._wsDelegateHandler = _createClickHandler();
  elWithHandlers._wsDblHandler = _createDblClickHandler();
  elWithHandlers._wsCtxHandler = _createCtxHandler();
  elWithHandlers._wsHoverHandler = _createHoverHandler();
  elWithHandlers._wsOutHandler = _createOutHandler();

  listEl.addEventListener('click', elWithHandlers._wsDelegateHandler);
  listEl.addEventListener('dblclick', elWithHandlers._wsDblHandler);
  listEl.addEventListener('contextmenu', elWithHandlers._wsCtxHandler);
  listEl.addEventListener('mouseover', elWithHandlers._wsHoverHandler);
  listEl.addEventListener('mouseout', elWithHandlers._wsOutHandler);
}

function scrollToCurrentIfNeeded(listEl: HTMLElement, currentIdx: number, filter: string): void {
  const hasNoFilter = !filter;
  const isEligible = currentIdx >= 0 && hasNoFilter;
  if (isEligible) {
    setTimeout(function () {
      const currentItem = listEl.querySelector('.loop-ws-item[data-ws-current="true"]');
      const hasCurrentItem = !!currentItem;
      if (hasCurrentItem) {
        currentItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 50);
  }
}

function _createClickHandler(): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    const item = (e.target as HTMLElement).closest(SEL_LOOP_WS_ITEM) as HTMLElement | null;
    if (!item) {
      return;
    }

    if ((e.target as HTMLElement).classList && (e.target as HTMLElement).classList.contains('loop-ws-checkbox')) {
      e.preventDefault();
      e.stopPropagation();
      handleWsCheckboxClick(
        item.getAttribute(DataAttrType.WsId) || '',
        parseInt(item.getAttribute('data-ws-idx') || '0', 10),
        e.shiftKey,
      );

      return;
    }

    setLoopWsNavIndex(parseInt(item.getAttribute('data-ws-idx') || '0', 10));
    log('Selected workspace: ' + item.getAttribute(DataAttrType.WsName), 'success');
  };
}

function _createDblClickHandler(): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    const item = (e.target as HTMLElement).closest(SEL_LOOP_WS_ITEM) as HTMLElement | null;
    if (!item) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (item.getAttribute(DataAttrType.WsCurrent) === 'true') {
      log('Double-click on current workspace "' + item.getAttribute(DataAttrType.WsName) + '" — no move needed', 'warn');

      return;
    }

    log('Double-click move -> ' + item.getAttribute(DataAttrType.WsName) + ' (id=' + item.getAttribute(DataAttrType.WsId) + ')', 'delegate');
    moveToWorkspace(item.getAttribute(DataAttrType.WsId) || '', item.getAttribute(DataAttrType.WsName) || '');
  };
}

function _createCtxHandler(): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    const item = (e.target as HTMLElement).closest(SEL_LOOP_WS_ITEM) as HTMLElement | null;
    if (!item) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    showWsContextMenu(
      item.getAttribute(DataAttrType.WsId) || '',
      item.getAttribute(DataAttrType.WsName) || '',
      e.clientX, e.clientY,
    );
  };
}

function _createHoverHandler(): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    const item = (e.target as HTMLElement).closest(SEL_LOOP_WS_ITEM) as HTMLElement | null;
    if (!item) {
      return;
    }

    const isCurrent = item.getAttribute(DataAttrType.WsCurrent) === 'true';
    if (isCurrent) {
      return;
    }

    const selEl = document.getElementById(DomIdType.LoopWsSelected);
    const selId = selEl ? selEl.getAttribute(DataAttrType.SelectedId) : '';
    const itemId = item.getAttribute(DataAttrType.WsId);
    if (selId && selId === itemId) {
      return;
    }

    item.style.background = 'rgba(59,130,246,0.15)';
  };
}

function _createOutHandler(): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    const item = (e.target as HTMLElement).closest(SEL_LOOP_WS_ITEM) as HTMLElement | null;
    if (!item) {
      return;
    }

    const isCurrent = item.getAttribute(DataAttrType.WsCurrent) === 'true';
    if (isCurrent) {
      return;
    }

    const selEl = document.getElementById(DomIdType.LoopWsSelected);
    const selId = selEl ? selEl.getAttribute(DataAttrType.SelectedId) : '';
    const itemId = item.getAttribute(DataAttrType.WsId);
    if (selId && selId === itemId) {
      return;
    }

    item.style.background = 'transparent';
  };
}

class WsDropdownState {
  private static instance: WsDropdownState | null = null;
  private hash = '';

  static getInstance(): WsDropdownState {
    const isDropdownStateUninitialized = !WsDropdownState.instance;
    if (isDropdownStateUninitialized) {
      WsDropdownState.instance = new WsDropdownState();
    }

    return WsDropdownState.instance!;
  }

  getHash(): string {
    return this.hash; 
  }
  setHash(nextHash: string): void {
    this.hash = nextHash; 
  }
  invalidate(): void {
    this.hash = ''; 
  }
  recordSkip(): void {
    wsRenderStats.skipped++; 
  }
  recordExecution(): void {
    wsRenderStats.executed++; 
  }
}

function dropdownState(): WsDropdownState {
  return WsDropdownState.getInstance();
}

export function populateLoopWorkspaceDropdown(): void {
  const listEl = document.getElementById('loop-ws-list');
  if (!listEl) {
    return;
  }

  const workspaces = loopCreditState.perWorkspace || [];
  if (workspaces.length === 0) {
    if (dropdownState().getHash() === '_empty') {
      dropdownState().recordSkip();

      return; 
    }

    dropdownState().setHash('_empty');
    dropdownState().recordExecution();
    listEl.innerHTML = '<div style="padding:6px;color:' + cPrimaryLight + ';font-size:10px;">📭 No workspaces loaded — click 💰 Credits to retry</div>';

    return;
  }

  const currentName = state.workspaceName || '';
  const searchEl = document.getElementById('loop-ws-search');
  const filter = searchEl ? (searchEl as HTMLInputElement).value.trim() : '';

  const rolloverEl = document.getElementById('loop-ws-rollover-filter');
  const billingEl = document.getElementById('loop-ws-billing-filter');
  const minCreditsEl = document.getElementById('loop-ws-min-credits');
  const checkedCount = Object.keys(getLoopWsCheckedIds()).length;

  const hash = [
    workspaces.length,
    currentName,
    filter,
    loopCreditState.lastCheckedAt || 0,
    viewState().getFreeOnly() ? 1 : 0,
    viewState().getCompactMode() ? 1 : 0,
    rolloverEl ? rolloverEl.getAttribute(DataAttrType.Active) : '',
    billingEl ? billingEl.getAttribute(DataAttrType.Active) : '',
    minCreditsEl ? (minCreditsEl as HTMLInputElement).value : '',
    viewState().getExpiredWithCredits() ? 1 : 0,
    viewState().getExpiring() ? 1 : 0,
    viewState().getRefillPriority() ? 1 : 0,
    viewState().getRefillSoon() ? 1 : 0,
    viewState().getCreditSortMode(),
    checkedCount,
  ].join('|');

  if (hash === dropdownState().getHash()) {
    dropdownState().recordSkip();

    return; 
  }

  dropdownState().setHash(hash);
  dropdownState().recordExecution();
  renderLoopWorkspaceList(workspaces, currentName, filter);
  log(
    'Workspace dropdown populated: ' + workspaces.length +
    ' workspaces (rendered:' + wsRenderStats.executed +
    ' skipped:' + wsRenderStats.skipped + ')',
    'success',
  );
}

export function invalidateWsDropdownHash(): void {
  dropdownState().invalidate();
}

class CreditResolvedRepaintScheduler {
  private static instance: CreditResolvedRepaintScheduler | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 120;

  static get(): CreditResolvedRepaintScheduler {
    const isRepaintSchedulerUninitialized = !CreditResolvedRepaintScheduler.instance;
    if (isRepaintSchedulerUninitialized) {
      CreditResolvedRepaintScheduler.instance = new CreditResolvedRepaintScheduler();
    }

    return CreditResolvedRepaintScheduler.instance!;
  }

  schedule(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        invalidateWsDropdownHash();
        populateLoopWorkspaceDropdown();
      } catch (caught: unknown) {
        logError(
          'CreditBalanceUpdate.repaint',
          'Path: standalone-scripts/macro-controller/src/ws-list-renderer.ts. Missing item: workspace dropdown repaint after CreditResolved. Reason: populateLoopWorkspaceDropdown threw during debounced re-render.',
          caught,
        );
      }
    }, this.debounceMs);
  }
}

onCreditResolved(function (_workspaceId: string): void {
  CreditResolvedRepaintScheduler.get().schedule();
});
