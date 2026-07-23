/**
 * Macro Controller — Config & Theme Type Definitions
 *
 * Phase 5E: Extracted from types.ts.
 * Contains all configuration interfaces (MacroControllerConfig tree),
 * theme interfaces (MacroThemeRoot tree), and runtime config dictionaries.
 */

/* ================================================================== */
/*  Config Types (from 02-macro-controller-config.json)                */
/* ================================================================== */

export interface MacroControllerConfig {
  schemaVersion?: number | undefined;
  description?: string | undefined;
  comboSwitch?: ComboSwitchConfig | undefined;
  macroLoop?: MacroLoopConfig | undefined;
  creditStatus?: CreditStatusConfig | undefined;
  general?: GeneralConfig | undefined;
  autoAttach?: AutoAttachConfig | undefined;
  prompts?: PromptsConfig | undefined;
  authBridge?: AuthBridgeConfig | undefined;
}

/** Auth Bridge configuration — TTL-aware token management. */
export interface AuthBridgeConfig {
  /** Token freshness TTL in milliseconds (default: 120000 = 2 minutes). */
  tokenTtlMs?: number | undefined;
}

export interface PromptsConfig {
  entries?: Partial<PromptEntry>[] | undefined;
  prompts?: Partial<PromptEntry>[] | undefined;
  pasteTargetXPath?: string | undefined;
  pasteTargetSelector?: string | undefined;
  pasteTarget?: { xpath?: string; selector?: string };
}

export interface ComboSwitchConfig {
  xpaths?: Record<string, string> | undefined;
  fallbacks?: Record<string, ComboFallback> | undefined;
  timing?: ComboSwitchTiming | undefined;
  elementIds?: Record<string, string> | undefined;
  shortcuts?: ComboShortcuts | undefined;
}

export interface ComboFallback {
  textMatch?: string[] | undefined;
  tag?: string | undefined;
  ariaLabel?: string | undefined;
  headingSearch?: string | undefined;
  selector?: string | undefined;
  role?: string | undefined;
}

export interface ComboSwitchTiming {
  pollIntervalMs?: number | undefined;
  openMaxAttempts?: number | undefined;
  waitMaxAttempts?: number | undefined;
  retryCount?: number | undefined;
  retryDelayMs?: number | undefined;
  confirmDelayMs?: number | undefined;
}

export interface ComboShortcuts {
  focusTextboxKey?: string | undefined;
  comboUpKey?: string | undefined;
  comboDownKey?: string | undefined;
  shortcutModifier?: string | undefined;
}

export interface MacroLoopConfig {
  creditBarWidthPx?: number | undefined;
  retry?: RetryConfig | undefined;
  timing?: MacroLoopTiming | undefined;
  urls?: MacroLoopUrls | undefined;
  xpaths?: MacroLoopXPaths | undefined;
  elementIds?: MacroLoopElementIds | undefined;
}

export interface RetryConfig {
  maxRetries?: number | undefined;
  backoffMs?: number | undefined;
}

export interface MacroLoopTiming {
  loopIntervalMs?: number | undefined;
  countdownIntervalMs?: number | undefined;
  firstCycleDelayMs?: number | undefined;
  postComboDelayMs?: number | undefined;
  pageLoadDelayMs?: number | undefined;
  dialogWaitMs?: number | undefined;
  workspaceCheckIntervalMs?: number | undefined;
  redockPollIntervalMs?: number | undefined;
  redockMaxAttempts?: number | undefined;
}

export interface MacroLoopUrls {
  requiredDomain?: string | undefined;
  settingsTabPath?: string | undefined;
  defaultView?: string | undefined;
}

export interface MacroLoopXPaths {
  projectButton?: string | undefined;
  mainProgress?: string | undefined;
  progress?: string | undefined;
  workspace?: string | undefined;
  workspaceNav?: string | undefined;
  controls?: string | undefined;
  promptActive?: string | undefined;
  projectName?: string | undefined;
}

export interface MacroLoopElementIds {
  scriptMarker?: string | undefined;
  container?: string | undefined;
  status?: string | undefined;
  startBtn?: string | undefined;
  stopBtn?: string | undefined;
  upBtn?: string | undefined;
  downBtn?: string | undefined;
  recordIndicator?: string | undefined;
  jsExecutor?: string | undefined;
  jsExecuteBtn?: string | undefined;
}

export interface CreditStatusConfig {
  apiBase?: string | undefined;
  endpoints?: Record<string, string> | undefined;
  refreshIntervalMs?: number | undefined;
  balance?: CreditBalanceConfigInput | undefined;
  /** Workspace lifecycle thresholds — drives status pill, expiry, refill labels. */
  lifecycle?: WorkspaceLifecycleConfigInput | undefined;
}

export interface CreditBalanceConfigInput {
  checkIntervalSeconds?: number | undefined;
  minDailyCredit?: number | undefined;
  enableApiDetection?: boolean | undefined;
  fallbackToXPath?: boolean | undefined;
}

/**
 * Workspace lifecycle / status-pill configuration.
 * Used by ws-list-renderer + credit-parser status helpers (spec/22-app-issues/workspace-status-tooltip).
 */
export interface WorkspaceLifecycleConfigInput {
  /** Days after subscription_status_changed_at before Expired escalates to Fully Expired. Default 30. */
  expiryGracePeriodDays?: number | undefined;
  /** Days before refill date to start showing About To Refill. Default 7. */
  refillWarningThresholdDays?: number | undefined;
  /** Master toggle for the inline status pill beside workspace name. Default true. */
  enableWorkspaceStatusLabels?: boolean | undefined;
  /** Master toggle for the rich hover card. Default true. */
  enableWorkspaceHoverDetails?: boolean | undefined;
  /** Delay before the workspace hover card disappears after mouseleave (ms). Default 220. */
  hoverCardHideGracePeriodMs?: number | undefined;
}

export interface GeneralConfig {
  logLevel?: string | undefined;
  maxRetries?: number | undefined;
}

export interface AutoAttachConfig {
  timing?: AutoAttachTiming | undefined;
  groups?: AutoAttachGroup[] | undefined;
}

export interface AutoAttachTiming {
  checkIntervalMs?: number | undefined;
  maxAttachAttempts?: number | undefined;
}

export interface AutoAttachGroup {
  name?: string | undefined;
  urlPattern?: string | undefined;
  scripts?: string[] | undefined;
}

/* ================================================================== */
/*  Theme Types (from 04-macro-theme.json, schema v2)                  */
/* ================================================================== */

export interface MacroThemeRoot {
  schemaVersion?: number | undefined;
  description?: string | undefined;
  activePreset?: "dark" | "light" | undefined;
  presets?: Record<string, ThemePreset> | undefined;
  /** Schema v1 fallback: colors at root level */
  colors?: ThemeColors | undefined;
}

export interface ThemePreset {
  label?: string | undefined;
  colors?: ThemeColors | undefined;
  animations?: ThemeAnimations | undefined;
  transitions?: ThemeTransitions | undefined;
  layout?: ThemeLayout | undefined;
  typography?: ThemeTypography | undefined;
}

export interface ThemeColors {
  panel?: PanelColors | undefined;
  primary?: PrimaryColors | undefined;
  accent?: AccentColors | undefined;
  status?: StatusColors | undefined;
  neutral?: Record<string, string> | undefined;
  creditBar?: CreditBarColors | undefined;
  workspace?: Record<string, string> | undefined;
  log?: LogColors | undefined;
  countdownBar?: Record<string, string> | undefined;
  button?: ButtonColors | undefined;
  input?: InputColors | undefined;
  modal?: ModalColors | undefined;
  section?: SectionColors | undefined;
  separator?: string | undefined;
  orange?: string | undefined;
  cyan?: string | undefined;
  cyanLight?: string | undefined;
  skyLight?: string | undefined;
  greenBright?: string | undefined;
}

export interface PanelColors {
  background?: string | undefined;
  backgroundAlt?: string | undefined;
  border?: string | undefined;
  foreground?: string | undefined;
  foregroundMuted?: string | undefined;
  foregroundDim?: string | undefined;
  textBody?: string | undefined;
}

export interface PrimaryColors {
  base?: string | undefined;
  light?: string | undefined;
  lighter?: string | undefined;
  lightest?: string | undefined;
  dark?: string | undefined;
  glow?: string | undefined;
  glowStrong?: string | undefined;
  glowSubtle?: string | undefined;
  borderAlpha?: string | undefined;
  bgAlpha?: string | undefined;
  bgAlphaLight?: string | undefined;
  bgAlphaSubtle?: string | undefined;
  highlight?: string | undefined;
}

export interface AccentColors {
  purple?: string | undefined;
  purpleLight?: string | undefined;
  pink?: string | undefined;
}

export interface StatusColors {
  success?: string | undefined;
  successLight?: string | undefined;
  successMuted?: string | undefined;
  successDark?: string | undefined;
  successDarkest?: string | undefined;
  successBg?: string | undefined;
  warning?: string | undefined;
  warningLight?: string | undefined;
  warningPale?: string | undefined;
  warningDark?: string | undefined;
  warningDarkest?: string | undefined;
  warningBg?: string | undefined;
  error?: string | undefined;
  errorLight?: string | undefined;
  errorPale?: string | undefined;
  errorDark?: string | undefined;
  errorDarkest?: string | undefined;
  errorBg?: string | undefined;
  info?: string | undefined;
  infoLight?: string | undefined;
  infoPale?: string | undefined;
  infoDark?: string | undefined;
}

export interface CreditBarColors {
  bonus?: [string, string] | undefined;
  billing?: [string, string] | undefined;
  rollover?: [string, string] | undefined;
  daily?: [string, string] | undefined;
  available?: string | undefined;
  emptyTrack?: string | undefined;
}

export interface LogColors {
  default?: string | undefined;
  error?: string | undefined;
  info?: string | undefined;
  success?: string | undefined;
  debug?: string | undefined;
  warn?: string | undefined;
  delegate?: string | undefined;
  check?: string | undefined;
  skip?: string | undefined;
  timestamp?: string | undefined;
}

export interface ButtonColors {
  check?: { bg?: string; fg?: string; gradient?: string; glow?: string };
  credits?: { bg?: string; fg?: string; gradient?: string; glow?: string };
  prompts?: { bg?: string; fg?: string; gradient?: string; glow?: string };
  startStop?: { gradient?: string; glow?: string; stopGradient?: string; stopGlow?: string };
  menu?: { bg?: string; fg?: string };
  menuHover?: string | undefined;
  utilityBg?: string | undefined;
  utilityBorder?: string | undefined;
}

export interface InputColors {
  bg?: string | undefined;
  border?: string | undefined;
  fg?: string | undefined;
}

export interface ModalColors {
  bg?: string | undefined;
  border?: string | undefined;
}

export interface SectionColors {
  bg?: string | undefined;
  headerColor?: string | undefined;
  toggleColor?: string | undefined;
}

export interface ThemeAnimations {
  pulseGlow?: boolean | undefined;
  fadeIn?: boolean | undefined;
  slideDown?: boolean | undefined;
}

export interface ThemeTransitions {
  fast?: string | undefined;
  normal?: string | undefined;
  slow?: string | undefined;
}

export interface ThemeLayout {
  panelBorderRadius?: string | undefined;
  panelPadding?: string | undefined;
  panelMinWidth?: string | undefined;
  panelFloatingWidth?: string | undefined;
  panelShadow?: string | undefined;
  panelFloatShadow?: string | undefined;
  dropdownBorderRadius?: string | undefined;
  dropdownShadow?: string | undefined;
  modalBorderRadius?: string | undefined;
  modalShadow?: string | undefined;
  aboutGradient?: string | undefined;
}

export interface ThemeTypography {
  fontFamily?: string | undefined;
  fontFamilySystem?: string | undefined;
  fontSize?: string | undefined;
  fontSizeSmall?: string | undefined;
  fontSizeTiny?: string | undefined;
  fontSizeMicro?: string | undefined;
}

/* ================================================================== */
/*  Enums                                                              */
/* ================================================================== */

/** Loop scroll direction. */
export enum LoopDirection {
  Up = 'up',
  Down = 'down',
}

/* ================================================================== */
/*  Config Dictionaries (from shared-state.ts)                         */
/* ================================================================== */

export interface TimingConfig {
  [key: string]: number;
  LOOP_INTERVAL: number;
  COUNTDOWN_INTERVAL: number;
  FIRST_CYCLE_DELAY: number;
  POST_COMBO_DELAY: number;
  PAGE_LOAD_DELAY: number;
  DIALOG_WAIT: number;
  WS_CHECK_INTERVAL: number;
  REDOCK_POLL_INTERVAL: number;
  REDOCK_MAX_ATTEMPTS: number;
}

export interface XPathConfig {
  [key: string]: string;
  PROJECT_BUTTON_XPATH: string;
  MAIN_PROGRESS_XPATH: string;
  PROGRESS_XPATH: string;
  WORKSPACE_XPATH: string;
  WORKSPACE_NAV_XPATH: string;
  CONTROLS_XPATH: string;
  PROMPT_ACTIVE_XPATH: string;
  PROJECT_NAME_XPATH: string;
  REQUIRED_DOMAIN: string;
  SETTINGS_PATH: string;
  DEFAULT_VIEW: string;
}

export interface ElementIds {
  SCRIPT_MARKER: string;
  CONTAINER: string;
  STATUS: string;
  START_BTN: string;
  STOP_BTN: string;
  UP_BTN: string;
  DOWN_BTN: string;
  RECORD_INDICATOR: string;
  JS_EXECUTOR: string;
  JS_EXECUTE_BTN: string;
}

/* ================================================================== */
/*  Controller State (actual runtime shape used by shared-state.ts)    */
/* ================================================================== */

export interface ControllerState {
  running: boolean;
  direction: LoopDirection;
  cycleCount: number;
  countdown: number;
  isIdle: boolean;
  isDelegating: boolean;
  forceDirection: LoopDirection | null;
  delegateStartTime: number;
  loopIntervalId: ReturnType<typeof setInterval> | null;
  countdownIntervalId: ReturnType<typeof setInterval> | null;
  workspaceName: string;
  /** Project name resolved from API (mark-viewed response). */
  projectNameFromApi: string;
  /** Project name resolved from DOM XPath on page load. */
  projectNameFromDom: string;
  /** Custom display name set by user in settings — highest priority for title bar. */
  customDisplayName: string;
  hasFreeCredit: boolean;
  lastStatusCheck: number;
  statusRefreshId: ReturnType<typeof setTimeout> | null;
  /** Period (ms) of the currently-installed statusRefresh interval, or null when no timer is active. */
  statusRefreshPeriodMs: number | null;
  workspaceJustChanged: boolean;
  workspaceChangedTimer: ReturnType<typeof setTimeout> | null;
  workspaceObserverActive: boolean;
  workspaceFromApi: boolean;
  workspaceFromCache: boolean;
  isManualCheck: boolean;
  retryCount: number;
  maxRetries: number;
  retryBackoffMs: number;
  lastRetryError: string | null;
  /** Internal: true while a loop cycle fetch is in-flight. */
  __cycleInFlight: boolean;
  /** Internal: true while a retry is scheduled. */
  __cycleRetryPending: boolean;
  /** Internal: true once getDisplayProjectName() has logged its fallback diagnostic (v3.93.1). */
  _projectNameFallbackLogged: boolean;
}

// Forward import for PromptsConfig → PromptEntry dependency
import type { PromptEntry } from './ui-types';
export type { PromptEntry };
