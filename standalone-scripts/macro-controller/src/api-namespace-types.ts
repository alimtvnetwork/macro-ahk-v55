/**
 * MacroController API namespace - shared type definitions.
 *
 * Split out from `api-namespace.ts` (Plan-17 step 13) to keep the runtime
 * module under the 500 LOC cap. Types only; no side effects, no imports
 * from `api-namespace.ts` (would recreate a cycle).
 */

import type { MacroController } from './core/MacroController';
import type { ControllerState } from './types/config-types';
import type { DiagnosticDump, LoopCreditState } from './types/credit-types';
import type { RenameHistoryEntry } from './types/workspace-types';
import type { AutoAttachGroupRuntime } from './types/ui-types';
import type { IntervalSnapshot } from './interval-registry';

/** Functions exposed on `api.loop` - loop lifecycle and diagnostics. */
export interface LoopApi {
  start: (direction?: string) => boolean;
  stop: () => boolean;
  check: () => void;
  state: () => ControllerState;
  setInterval: (ms: number) => void;
  diagnostics: () => DiagnosticDump;
}

/** Functions exposed on `api.credits` - credit fetch + state read. */
export interface CreditsApi {
  fetch: (isRetry?: boolean) => void;
  /**
   * Read the latest hydrated credit state. Returns null only when
   * the namespace has been built but no fetch has yet completed.
   */
  getState: () => LoopCreditState | null;
}

/** Functions exposed on `api.auth` - authentication token access. */
export interface AuthApi {
  getToken: () => string;
}

/** Functions exposed on `api.workspace` - workspace navigation and rename. */
export interface WorkspaceApi {
  moveTo: (wsId: string, wsName: string) => Promise<void>;
  forceSwitch: (direction: string) => void;
  bulkRename: (template: string, prefix: string, suffix: string, startNum?: number | Record<string, number>) => void;
  getRenameDelay: () => number;
  setRenameDelay: (ms: number) => void;
  cancelRename: () => void;
  undoRename: () => void;
  renameHistory: () => RenameHistoryEntry[];
}

/** Functions exposed on `api.ui` - UI lifecycle and refresh. */
export interface UiApi {
  refreshStatus: () => void;
  startStatusRefresh: () => void;
  stopStatusRefresh: () => void;
  destroy: () => void;
  toast: (message: string, level?: string) => void;
}

/** Functions exposed on `api.config` - runtime configuration setters. */
export interface ConfigApi {
  setProjectButtonXPath: (xpath: string) => void;
  setProgressXPath: (xpath: string) => void;
}

/** Functions exposed on `api.autoAttach` - auto-attach group runner. */
export interface AutoAttachApi {
  runGroup: (group: AutoAttachGroupRuntime) => void;
}

/** Functions exposed on `api.metrics` - runtime diagnostics counters. */
export interface MetricsApi {
  /** Snapshot of currently-active polling intervals (per label + total). */
  intervals: () => IntervalSnapshot;
}

/** The public console API surface of the MacroController namespace. */
export interface MacroControllerApi {
  loop: LoopApi;
  credits: CreditsApi;
  auth: AuthApi;
  workspace: WorkspaceApi;
  ui: UiApi;
  config: ConfigApi;
  autoAttach: AutoAttachApi;
  metrics: MetricsApi;
  mc: MacroController;
  [key: string]: unknown;
}

/** Internal callbacks NOT for external use. */
export interface MacroControllerInternal {
  resolvedToken?: string;
  destroyed?: boolean;
  exportBundle?: string;
  delegateComplete?: () => void;
  updateStartStopBtn?: (running: boolean) => void;
  updateAuthDiag?: () => void;
  createUIWrapper?: () => void;
  createUIManager?: () => object;
  createWorkspaceManager?: () => object;
  createAuthManager?: () => object;
  createCreditManager?: () => object;
  createLoopEngine?: () => object;
  [key: string]: unknown;
}

/** Full namespace shape on RiseupAsiaMacroExt.Projects.MacroController. */
export interface MacroControllerNamespace {
  meta: {
    version: string;
    displayName: string;
  };
  api: MacroControllerApi;
  _internal: MacroControllerInternal;
  [key: string]: unknown;
}

/**
 * NsPathMap enumerates every known namespace path and its concrete type.
 * Used by nsWrite / nsReadTyped / nsCallTyped for compile-time safety
 * instead of dynamic `split('.')` traversal.
 */
export interface NsPathMap {
  // _internal
  '_internal.resolvedToken': string;
  '_internal.destroyed': boolean;
  '_internal.exportBundle': string;
  '_internal.delegateComplete': () => void;
  '_internal.updateStartStopBtn': (running: boolean) => void;
  '_internal.updateAuthDiag': () => void;
  '_internal.createUIWrapper': () => void;
  '_internal.createUIManager': () => object;
  '_internal.createWorkspaceManager': () => object;
  '_internal.createAuthManager': () => object;
  '_internal.createCreditManager': () => object;
  '_internal.createLoopEngine': () => object;
  '_internal.summaryBar': import('./ui/summary-bar/component').SummaryBarHandle;
  // api (top-level)
  'api.mc': MacroController;
  // api.loop
  'api.loop.start': LoopApi['start'];
  'api.loop.stop': LoopApi['stop'];
  'api.loop.check': LoopApi['check'];
  'api.loop.state': LoopApi['state'];
  'api.loop.setInterval': LoopApi['setInterval'];
  'api.loop.diagnostics': LoopApi['diagnostics'];
  // api.credits
  'api.credits.fetch': CreditsApi['fetch'];
  'api.credits.getState': CreditsApi['getState'];
  // api.auth
  'api.auth.getToken': AuthApi['getToken'];
  // api.workspace
  'api.workspace.moveTo': WorkspaceApi['moveTo'];
  'api.workspace.forceSwitch': WorkspaceApi['forceSwitch'];
  'api.workspace.bulkRename': WorkspaceApi['bulkRename'];
  'api.workspace.getRenameDelay': WorkspaceApi['getRenameDelay'];
  'api.workspace.setRenameDelay': WorkspaceApi['setRenameDelay'];
  'api.workspace.cancelRename': WorkspaceApi['cancelRename'];
  'api.workspace.undoRename': WorkspaceApi['undoRename'];
  'api.workspace.renameHistory': WorkspaceApi['renameHistory'];
  // api.ui
  'api.ui.refreshStatus': UiApi['refreshStatus'];
  'api.ui.startStatusRefresh': UiApi['startStatusRefresh'];
  'api.ui.stopStatusRefresh': UiApi['stopStatusRefresh'];
  'api.ui.destroy': UiApi['destroy'];
  'api.ui.toast': UiApi['toast'];
  // api.config
  'api.config.setProjectButtonXPath': ConfigApi['setProjectButtonXPath'];
  'api.config.setProgressXPath': ConfigApi['setProgressXPath'];
  // api.autoAttach
  'api.autoAttach.runGroup': AutoAttachApi['runGroup'];
  // api.metrics
  'api.metrics.intervals': MetricsApi['intervals'];
}
