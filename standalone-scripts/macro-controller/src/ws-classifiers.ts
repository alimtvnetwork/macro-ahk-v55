import type { WorkspaceCredit } from './types';
import { logError } from './error-utils';
import { WsTierValueType } from './types/subscription-status';
import { getEffectiveStatus, getWorkspaceLifecycleConfig } from './credit-fetch';
import { classifyFromStatus } from './workspace-display-status';

export function isRefillSoonWs(ws: WorkspaceCredit): boolean {
  try {
    const config = getWorkspaceLifecycleConfig();
    const source = getEffectiveStatus(ws, config);
    const display = classifyFromStatus(source, ws);
    return display.kind === 'refill-soon';
  } catch (e: unknown) {
    logError('passesFilters.refillSoon', 'Failed to classify workspace for refill-soon filter', e);
    return false;
  }
}

export function isExpiringWs(ws: WorkspaceCredit): boolean {
  try {
    const config = getWorkspaceLifecycleConfig();
    const source = getEffectiveStatus(ws, config);
    const display = classifyFromStatus(source, ws);
    return display.kind === 'past-due-expiring';
  } catch (e: unknown) {
    logError('passesFilters.expiring', 'Failed to classify workspace for expiring filter', e);
    return false;
  }
}

export function isProExpiringWs(ws: WorkspaceCredit): boolean {
  try {
    const tier = (ws.tier || WsTierValueType.FREE).toUpperCase().trim();
    if (tier === WsTierValueType.FREE) return false;
    const config = getWorkspaceLifecycleConfig();
    const source = getEffectiveStatus(ws, config);
    const display = classifyFromStatus(source, ws);
    
    if (display.kind === 'past-due-expiring'
      || display.kind === 'expired-hard'
      || display.kind === 'expire-soon') return true;
      
    if (display.kind === 'canceled') {
      const sub = (ws.subscriptionStatus || '').toLowerCase().trim();
      return sub !== 'canceled' && sub !== 'cancelled';
    }
    return false;
  } catch (e: unknown) {
    logError('passesFilters.proExpiring',
      'Failed to classify workspace for pro credit-sort filter', e);
    return false;
  }
}
