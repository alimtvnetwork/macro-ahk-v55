/**
 * controller-state.ts — Pure value + type module for the MacroController
 * singleton. Extracted from `core/MacroController.ts` per Plan-17 step 4
 * (SS-03) so that manager implementations and API-namespace consumers can
 * import sub-manager contracts without pulling in the whole
 * MacroController class file (which transitively imports shared-state,
 * logging, dom-cache, api-namespace, ws-selection-ui, ui-updaters,
 * error-utils, and creates the cycle cluster reported by madge).
 *
 * ⚠ No side-effect imports. No imports from `ui/**` or `db/**`.
 *   This file must remain a *leaf* in the import graph.
 *
 * The interfaces below are the *sole* contract each manager implementation
 * must satisfy. They are re-exported from `core/MacroController.ts` for
 * backward compatibility with existing consumers.
 */

import type { WorkspaceCredit, LoopCreditState, CreditBalanceResponse } from '../types';

export interface AuthManagerInterface {
  getToken(): string;
  refreshToken(callback: (token: string, source: string) => void): void;
  getLastSource(): string;
  verifySession(context: string): void;
}

export interface CreditManagerInterface {
  fetch(isRetry?: boolean): void;
  fetchAsync(isRetry?: boolean): Promise<void>;
  fetchBalance(workspaceId?: string): Promise<CreditBalanceResponse | null>;
  getState(): LoopCreditState;
  parse(data: Record<string, unknown>): boolean;
  sync(): void;
  calcTotal(
    granted: number,
    dailyLimit: number,
    billingLimit: number,
    topupLimit: number,
    rolloverLimit: number,
  ): number;
  calcAvailable(
    totalCredits: number,
    rolloverUsed: number,
    dailyUsed: number,
    billingUsed: number,
    freeUsed: number,
  ): number;
  calcFree(dailyLimit: number, dailyUsed: number): number;
}

export interface WorkspaceManagerInterface {
  detect(token: string): Promise<void>;
  moveTo(id: string, name: string): void;
  moveAdjacent(direction: string): void;
  moveAdjacentCached(direction: string): void;
  bulkRename(template: string, prefix: string, suffix: string, startNum?: number): void;
  getCurrentName(): string;
  startObserver(): void;
  detectViaDialog(
    callerFn?: string,
    perWs?: WorkspaceCredit[],
    keepDialogOpen?: boolean,
  ): Promise<Element | null>;
  fetchName(): void;
  fetchNameFromNav(): boolean;
  isKnown(name: string): boolean;
  extractProjectId(): string | null;
  addChangeEntry(fromName: string, toName: string): void;
  getHistory(): Array<Record<string, string>>;
  clearHistory(): void;
}

export interface LoopEngineInterface {
  start(direction?: string): void;
  stop(): void;
  check(): Promise<void> | undefined;
  setInterval(ms: number): boolean;
  isRunning(): boolean;
}

export interface UIManagerInterface {
  create(): void;
  destroy(): void;
  update(): void;
  updateLight(): void;
  populateDropdown(): void;
}
