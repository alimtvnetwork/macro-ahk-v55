import type { PromptRole } from '../types/prompt-role';
import type { PromptRow } from '../db/prompt-db';

export const MODAL_ID = 'macro-prompt-library-modal';
export const ROLES: PromptRole[] = ['plan', 'next', 'generic'];
export const ROLE_FILTERS: ReadonlyArray<PromptRole | 'all'> = ['all', 'plan', 'next', 'generic'];
export const SORT_MODES = ['default-first', 'name', 'length'] as const;
export type SortMode = typeof SORT_MODES[number];
export const PREVIEW_MAX_CHARS = 240;
export const LOG_SCOPE = 'PromptLibraryModal';
export const CSS_BORDER_RADIUS_6 = 'border-radius:6px';
export const IMPORT_FAILED_PREFIX = 'Import failed: ';
export const ATTR_ARIA_LABEL = 'aria-label';
export const ATTR_ARIA_VALUENOW = 'aria-valuenow';
export const ATTR_ARIA_VALUETEXT = 'aria-valuetext';
export const CSS_BORDER_COLOR_DEFAULT = '#2b3648';
export const CSS_BORDER_DEFAULT = 'border:1px solid ' + CSS_BORDER_COLOR_DEFAULT;
export const CSS_DISPLAY_NONE = 'display:none';
export const CSS_MARGIN_BOTTOM_10 = 'margin-bottom:10px';
export const CSS_PADDING_10_12 = 'padding:10px 12px';
export const CSS_FONT_SIZE_12 = 'font-size:12px';
export const CSS_BG_MUTED_1 = 'background:#182033';
export const CSS_CURSOR_POINTER = 'cursor:pointer';
export const TOAST_ERROR = 'error' as const;
export const PREVIEW_FAILED_PREFIX = 'Preview failed: ';

export const ROLE_TOOLTIPS: Readonly<Record<PromptRole, string>> = {
  plan: 'PlanTierType chip prompts. The {{n}} token is required and enforced by the drift guard on save.',
  next: 'Next chip prompts. The {{n}} token is required and enforced by the drift guard on save.',
  generic: 'Free-form user snippets. No required tokens — the drift guard does not apply. Add these for reusable text you paste anywhere.',
};

export interface ViewState {
  filterRole: PromptRole | 'all';
  sortMode: SortMode;
  expandedIds: Set<number>;
}

export interface ActiveEditor {
  row: PromptRow;
  save: () => void;
  cancel: () => void;
}

export interface ModalRefs {
  root: HTMLDivElement;
  body: HTMLDivElement;
  status: HTMLDivElement;
  errorBanner: HTMLDivElement;
  fileInfo: HTMLDivElement;
  view: ViewState;
  activeEditor: ActiveEditor | null;
  keyHandler?: (e: KeyboardEvent) => void;
  pagehideHandler?: () => void;
  lastImportFailed?: boolean;
  includeRevisionsCb?: HTMLInputElement;
  importRoleSelect?: HTMLSelectElement;
  importProgress?: {
      wrap: HTMLDivElement;
      label: HTMLSpanElement;
      bar: HTMLDivElement;
      counter: HTMLSpanElement;
  };
  previewPanel?: HTMLDivElement;
  previewFileInput?: HTMLInputElement;
  partialErrorsPanel?: HTMLDivElement;
}
