/**
 * MacroLoop Controller — Workspace Rename (barrel)
 *
 * Phase 5: Split into focused sub-modules:
 *   - rename-forbidden-cache.ts  (forbidden workspace cache)
 *   - rename-template.ts         (numbering template engine)
 *   - rename-api.ts              (single rename PUT call)
 *   - rename-bulk.ts             (bulk rename, undo, history, delay)
 *   - rename-preset-store.ts     (IndexedDB-backed preset CRUD)
 *
 * This barrel preserves backward compatibility for existing imports.
 */

// Plan-17 Step 27: forbidden-cache symbols are consumed only inside
// rename-api.ts (see hasForbidden/addForbidden/removeForbidden imports
// there). No external barrel consumer exists — re-exports removed.



export { applyRenameTemplate } from './rename-template';

export { renameWorkspace } from './rename-api';

export {
  getRenameDelayMs,
  setRenameDelayMs,
  cancelRename,
  isRenameCancelled,
  getRenameAvgOpMs,
  getRenameHistory,
  updateUndoBtnVisibility,
  bulkRenameWorkspaces,
  undoLastRename,
} from './rename-bulk';

export {
  type RenamePreset,
  type RenamePresetStore,
  getRenamePresetStore,
  createDefaultPreset,
} from './rename-preset-store';
