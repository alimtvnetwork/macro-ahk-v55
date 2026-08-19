import { logError } from './error-utils';
import { CreditSortModeType } from "./types/enums";
export type { CreditSortModeType };

class WsListViewState {
  private static instance: WsListViewState | null = null;
  private isFreeOnly = false;
  private isExpiredWithCredits = false;
  private isExpiring = false;
  private isRefillSoon = false;
  private isCompactMode: boolean;
  private isRefillPriority: boolean;
  private creditSortMode: CreditSortModeType;

  private constructor() {
    this.isCompactMode = this.loadBool('ml_compact_mode', true);
    this.isRefillPriority = this.loadBool('ml_refill_priority', false);
    this.creditSortMode = this.loadCreditSortMode();
  }

  static getInstance(): WsListViewState {
    if (!WsListViewState.instance) {
      WsListViewState.instance = new WsListViewState();
    }

    return WsListViewState.instance;
  }

  private loadBool(key: string, fallback: boolean): boolean {
    try {
      const stored: string | null = localStorage.getItem(key);

      return stored === null ? fallback : stored === 'true';
    } catch (e: unknown) {
      logError('viewState.load', 'Failed to read "' + key + '" from localStorage', e);

      return fallback;
    }
  }

  private loadCreditSortMode(): CreditSortModeType {
    try {
      const stored = localStorage.getItem('ml_credit_sort_mode');

      if (stored === 'high' || stored === 'low' || stored === 'pro-high' || stored === 'pro-low') {
        return stored;
      }
    } catch (e: unknown) {
      logError('viewState.loadCreditSortMode', 'Failed to read credit sort mode from localStorage', e);
    }

    return 'none';
  }

  getCompactMode(): boolean {
    return this.isCompactMode; 
  }
  setCompactMode(enabled: boolean): void {
    this.isCompactMode = enabled; 
  }

  getFreeOnly(): boolean {
    return this.isFreeOnly; 
  }
  setFreeOnly(enabled: boolean): void {
    this.isFreeOnly = enabled; 
  }

  getExpiredWithCredits(): boolean {
    return this.isExpiredWithCredits; 
  }
  setExpiredWithCredits(enabled: boolean): void {
    this.isExpiredWithCredits = enabled; 
  }

  getExpiring(): boolean {
    return this.isExpiring; 
  }
  setExpiring(enabled: boolean): void {
    this.isExpiring = enabled; 
  }

  getRefillSoon(): boolean {
    return this.isRefillSoon; 
  }
  setRefillSoon(enabled: boolean): void {
    this.isRefillSoon = enabled; 
  }

  getRefillPriority(): boolean {
    return this.isRefillPriority; 
  }
  setRefillPriority(enabled: boolean): void {
    this.isRefillPriority = enabled;
    try {
      localStorage.setItem('ml_refill_priority', enabled ? 'true' : 'false');
    } catch (e: unknown) {
      logError('viewState.setRefillPriority', 'Failed to persist refill priority flag', e);
    }
  }

  getCreditSortMode(): CreditSortModeType {
    return this.creditSortMode; 
  }
  setCreditSortMode(mode: CreditSortModeType): void {
    this.creditSortMode = mode;
    try {
      localStorage.setItem('ml_credit_sort_mode', mode);
    } catch (e: unknown) {
      logError('viewState.setCreditSortMode', 'Failed to persist credit sort mode', e);
    }
  }
}

export function viewState(): WsListViewState {
  return WsListViewState.getInstance();
}

export function getLoopWsCompactMode(): boolean {
  return viewState().getCompactMode(); 
}

export function setLoopWsCompactMode(enabled: boolean): void {
  viewState().setCompactMode(enabled); 
}

export function getLoopWsFreeOnly(): boolean {
  return viewState().getFreeOnly(); 
}

export function setLoopWsFreeOnly(enabled: boolean): void {
  viewState().setFreeOnly(enabled); 
}

export const EXPIRED_WITH_CREDITS_MIN = 5;

export function getLoopWsExpiredWithCredits(): boolean {
  return viewState().getExpiredWithCredits(); 
}

export function setLoopWsExpiredWithCredits(enabled: boolean): void {
  viewState().setExpiredWithCredits(enabled); 
}

export function getLoopWsExpiring(): boolean {
  return viewState().getExpiring(); 
}

export function setLoopWsExpiring(enabled: boolean): void {
  viewState().setExpiring(enabled); 
}

export function getLoopWsRefillSoon(): boolean {
  return viewState().getRefillSoon(); 
}

export function setLoopWsRefillSoon(enabled: boolean): void {
  viewState().setRefillSoon(enabled); 
}

export function getLoopWsRefillPriority(): boolean {
  return viewState().getRefillPriority(); 
}

export function setLoopWsRefillPriority(enabled: boolean): void {
  viewState().setRefillPriority(enabled); 
}

export function getLoopWsCreditSortMode(): CreditSortModeType {
  return viewState().getCreditSortMode(); 
}

export function setLoopWsCreditSortMode(mode: CreditSortModeType): void {
  viewState().setCreditSortMode(mode); 
}
