import type { WorkspaceCredit } from './types';
import { WsTierValueType } from './types/subscription-status';
import { isExpiredWs, expiredDays } from './credit-fetch';
import { resolveCreditSummary } from './credit-balance-update/credit-summary-resolver';
import {
  isRefillSoonWs,
  isExpiringWs,
  isProExpiringWs,
} from './ws-classifiers';
import {
  CreditSortModeType,
  EXPIRED_WITH_CREDITS_MIN,
  viewState,
} from './ws-view-state';

export interface WsFilterState {
  filter: string;
  freeOnly: boolean;
  rolloverOnly: boolean;
  billingOnly: boolean;
  minCredits: number;
  expiredWithCredits: boolean;
  expiring: boolean;
  refillSoon: boolean;
  creditSortMode: CreditSortModeType;
}

export function readFilterState(filter: string, dataAttrActive: string): WsFilterState {
  const rolloverEl = document.getElementById('loop-ws-rollover-filter');
  const billingEl = document.getElementById('loop-ws-billing-filter');
  const minEl = document.getElementById('loop-ws-min-credits');

  return {
    filter,
    freeOnly: viewState().getFreeOnly(),
    rolloverOnly: rolloverEl?.getAttribute(dataAttrActive) === 'true',
    billingOnly: billingEl?.getAttribute(dataAttrActive) === 'true',
    minCredits: minEl ? parseInt((minEl as HTMLInputElement).value, 10) || 0 : 0,
    expiredWithCredits: viewState().getExpiredWithCredits(),
    expiring: viewState().getExpiring(),
    refillSoon: viewState().getRefillSoon(),
    creditSortMode: viewState().getCreditSortMode(),
  };
}

export function isCurrentWorkspace(ws: WorkspaceCredit, currentName: string): boolean {
  if (!currentName) {
    return false;
  }

  if (ws.fullName === currentName || ws.name === currentName) {
    return true;
  }

  const lcn = currentName.toLowerCase();

  return (ws.fullName || '').toLowerCase().indexOf(lcn) !== -1 ||
         lcn.indexOf((ws.fullName || '').toLowerCase()) !== -1;
}

export function matchesTextFilter(ws: WorkspaceCredit, filter: string): boolean {
  if (!filter) {
    return true;
  }

  return ws.fullName.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
    ws.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
}

export function matchesExpiredWithCreditsFilter(ws: WorkspaceCredit): boolean {
  const tier = (ws.tier || WsTierValueType.FREE).toUpperCase().trim();

  if (tier === WsTierValueType.FREE) {
    return false;
  }

  const sub = (ws.subscriptionStatus || '').toLowerCase().trim();

  if (sub === 'canceled' || sub === 'cancelled') {
    return false;
  }

  if (!isExpiredWs(ws)) {
    return false;
  }

  if (resolveCreditSummary(ws).available <= EXPIRED_WITH_CREDITS_MIN) {
    return false;
  }

  return true;
}

export function isProOnlySortMode(mode: WsFilterState['creditSortMode']): boolean {
  return mode === 'pro-high' || mode === 'pro-low';
}

export function passesCreditFilters(ws: WorkspaceCredit, fs: WsFilterState): boolean {
  if (fs.minCredits > 0 && resolveCreditSummary(ws).available < fs.minCredits) {
    return false;
  }

  if (fs.expiredWithCredits && !matchesExpiredWithCreditsFilter(ws)) {
    return false;
  }

  if (fs.expiring && !isExpiringWs(ws)) {
    return false;
  }

  if (fs.refillSoon && !isRefillSoonWs(ws)) {
    return false;
  }

  if (isProOnlySortMode(fs.creditSortMode) && !isProExpiringWs(ws)) {
    return false;
  }

  return true;
}

export function passesFilters(ws: WorkspaceCredit, fs: WsFilterState): boolean {
  if (!matchesTextFilter(ws, fs.filter || '')) {
    return false;
  }

  if (fs.freeOnly && (ws.dailyFree || 0) <= 0) {
    return false;
  }

  if (fs.rolloverOnly && (ws.rollover || 0) <= 0) {
    return false;
  }

  if (fs.billingOnly && resolveCreditSummary(ws).billingAvailable <= 0) {
    return false;
  }

  return passesCreditFilters(ws, fs);
}

export function expiredRecoveryScore(ws: WorkspaceCredit): number {
  const credits = Math.max(resolveCreditSummary(ws).available, 0);
  const days = Math.max(expiredDays(ws) || 0, 0);

  return credits * days + credits;
}
