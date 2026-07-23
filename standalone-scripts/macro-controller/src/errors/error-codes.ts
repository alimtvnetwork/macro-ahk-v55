/**
 * Central error-code registry for the macro-controller extension.
 *
 * Plan 26 / step 3. Every diagnostic error thrown from
 * `standalone-scripts/macro-controller/src` MUST reference a code defined here.
 *
 * Rules (enforced by scripts/check-error-codes-unique.mjs and Vitest):
 *  1. Codes are frozen once shipped. Deprecate, never renumber.
 *  2. `humanTemplate` MUST state attempt, cause, and next fix (or use `nextFixHint`).
 *  3. Every `{placeholder}` in `humanTemplate` MUST appear in `requiredContextKeys`.
 *  4. No profanity, no "oops", no bare "Failed".
 *
 * See:
 *  - .lovable/plans/subtasks/26-professional-diagnostic-errors-20-step/SS-02-taxonomy.md
 *  - .lovable/spec/commands/04-professional-diagnostic-error-messages.md
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warn' | 'info';

export type ErrorArea =
  | 'PROMPT'
  | 'PROMPT_IO'
  | 'SEED'
  | 'HEALTH'
  | 'REPAIR'
  | 'HISTORY'
  | 'DB'
  | 'HTTP'
  | 'SDK'
  | 'WS_MEMBERS'
  | 'WS_MOVE'
  | 'WS_CONTEXT'
  | 'REMIX'
  | 'RENAME'
  | 'GITSYNC'
  | 'CREDIT'
  | 'PROZERO'
  | 'SETTINGS'
  | 'SPLITTER'
  | 'TELEMETRY'
  | 'UI'
  | 'ASYNC'
  | 'LOOP'
  | 'QUEUE'
  | 'TYPE';


export interface ErrorCodeEntry {
  readonly code: string;
  readonly area: ErrorArea;
  readonly action: string;
  readonly severity: ErrorSeverity;
  readonly humanTemplate: string;
  readonly requiredContextKeys: readonly string[];
  readonly nextFixHint?: string;
  readonly deprecated?: boolean;
  readonly replacedBy?: string;
}

/**
 * ERROR_CODES: the single source of truth. Frozen at module load.
 *
 * Steps 8-13 will populate this record as each area is migrated. The initial
 * scaffold below seeds one representative code per area so the registry, the
 * DiagnosticError class (step 4), and the CI checker (step 14) can be wired
 * and unit-tested end-to-end without waiting for every migration to land.
 */
export const ERROR_CODES: Readonly<Record<string, ErrorCodeEntry>> = Object.freeze({
  PROMPT_VALIDATE_E001: {
    code: 'PROMPT_VALIDATE_E001',
    area: 'PROMPT',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate:
      'Cannot save {role} prompt "{slug}": expected {expected} {{n}} token(s), found {actual}.',
    requiredContextKeys: ['role', 'slug', 'expected', 'actual', 'ruleId'],
    nextFixHint: 'Add the missing {{n}} token(s) in the editor and save again.',
  },
  PROMPT_EDIT_E001: {
    code: 'PROMPT_EDIT_E001',
    area: 'PROMPT',
    action: 'EDIT',
    severity: 'error',
    humanTemplate:
      'Cannot open the {role} prompt editor for "{slug}": {reason}.',
    requiredContextKeys: ['role', 'slug', 'reason', 'action'],
    nextFixHint: 'Try Repair prompts from the gear menu, then reopen the editor.',
  },
  HTTP_REQUEST_E001: {
    code: 'HTTP_REQUEST_E001',
    area: 'HTTP',
    action: 'REQUEST',
    severity: 'error',
    humanTemplate:
      'Request failed for {op}: HTTP {status} at {url}.',
    requiredContextKeys: ['op', 'status', 'url', 'method'],
    nextFixHint: 'Check network + auth token; retry the action.',
  },
  SDK_NOT_READY_E001: {
    code: 'SDK_NOT_READY_E001',
    area: 'SDK',
    action: 'NOT_READY',
    severity: 'error',
    humanTemplate:
      'Marco SDK is not ready yet for {op}: {missingApi} is undefined (readiness stage: {readinessStage}).',
    requiredContextKeys: ['op', 'missingApi', 'readinessStage', 'elapsedMs'],
    nextFixHint: 'Reload the tab; if the error persists, reinstall the extension.',
  },
  SEED_INSERT_E001: {
    code: 'SEED_INSERT_E001',
    area: 'SEED',
    action: 'INSERT',
    severity: 'error',
    humanTemplate:
      'Default prompt seeding failed for {role}: {reason}.',
    requiredContextKeys: ['role', 'reason', 'boot', 'dbVersion'],
    nextFixHint: 'Run Repair prompts from the gear menu.',
  },
  HEALTH_CHECK_E001: {
    code: 'HEALTH_CHECK_E001',
    area: 'HEALTH',
    action: 'CHECK',
    severity: 'warn',
    humanTemplate:
      'Prompt health check found issues for {role}: {issueCount} issue(s) — {issueSummary}.',
    requiredContextKeys: ['role', 'issueCount', 'issueSummary'],
    nextFixHint: 'Run Repair prompts to auto-fix, or edit the row manually.',
  },
  REPAIR_RUN_E001: {
    code: 'REPAIR_RUN_E001',
    area: 'REPAIR',
    action: 'RUN',
    severity: 'error',
    humanTemplate:
      'Repair prompts could not fully restore {role}: {fixed} fixed, {stillBroken} still broken.',
    requiredContextKeys: ['role', 'fixed', 'stillBroken', 'newlyFlagged', 'durationMs'],
    nextFixHint: 'Open the editor via the gear menu and inspect the flagged rows.',
  },
  HISTORY_RESOLVE_E001: {
    code: 'HISTORY_RESOLVE_E001',
    area: 'HISTORY',
    action: 'RESOLVE',
    severity: 'error',
    humanTemplate:
      'Could not resolve prompt slug "{requestedSlug}" for history (role={role}); tried: {fallbackChain}.',
    requiredContextKeys: ['requestedSlug', 'role', 'fallbackChain'],
    nextFixHint: 'Reopen the prompt from the gear menu so the slug can be re-bound.',
  },
  DB_WRITE_E001: {
    code: 'DB_WRITE_E001',
    area: 'DB',
    action: 'WRITE',
    severity: 'error',
    humanTemplate:
      'Database write failed on {table}.{op} (pkey={pkey}): {sqliteCode}.',
    requiredContextKeys: ['table', 'op', 'pkey', 'sqliteCode'],
    nextFixHint: 'Reload the extension; if it persists, export diagnostics and report.',
  },
  // ---- Plan 26 step 8: prompt-editor migration codes ----
  PROMPT_EDIT_E002: {
    code: 'PROMPT_EDIT_E002',
    area: 'PROMPT',
    action: 'OPEN',
    severity: 'error',
    humanTemplate:
      'Cannot open prompt editor for role={role}: dropdown context is not registered yet.',
    requiredContextKeys: ['role', 'action'],
    nextFixHint: 'Open the Prompts dropdown once, then retry the edit.',
  },
  PROMPT_EDIT_E003: {
    code: 'PROMPT_EDIT_E003',
    area: 'PROMPT',
    action: 'OPEN',
    severity: 'error',
    humanTemplate:
      'Prompt editor failed to open for role={role} (action={action}): {reason}.',
    requiredContextKeys: ['role', 'action', 'reason'],
    nextFixHint: 'Reload the tab; if it persists, run Repair prompts from the gear menu.',
  },
  PROMPT_EDIT_E004: {
    code: 'PROMPT_EDIT_E004',
    area: 'PROMPT',
    action: 'DRIFT_CHECK',
    severity: 'warn',
    humanTemplate:
      'Editor state drift detected for role={role} slug={slug} (id={promptId}): bodyMatches={bodyMatches}, nameMatches={nameMatches}.',
    requiredContextKeys: ['role', 'slug', 'promptId', 'bodyMatches', 'nameMatches'],
    nextFixHint: 'Save the row again to re-align the editable projection with the DB.',
  },
  PROMPT_EDIT_E005: {
    code: 'PROMPT_EDIT_E005',
    area: 'PROMPT',
    action: 'OPEN_DEFAULT',
    severity: 'error',
    humanTemplate:
      'Default prompt lookup failed for role={role}: {reason}.',
    requiredContextKeys: ['role', 'reason'],
    nextFixHint: 'Run More > Re-seed defaults, then reopen the editor.',
  },
  PROMPT_EDIT_E006: {
    code: 'PROMPT_EDIT_E006',
    area: 'PROMPT',
    action: 'OPEN_DEFAULT',
    severity: 'error',
    humanTemplate:
      'No default prompt row exists for role={role} and no seed row is registered.',
    requiredContextKeys: ['role'],
    nextFixHint: 'Add a Plan/Next prompt via the "+ New" gear item; it will be promoted to default.',
  },
  PROMPT_EDIT_E007: {
    code: 'PROMPT_EDIT_E007',
    area: 'PROMPT',
    action: 'LOAD',
    severity: 'error',
    humanTemplate:
      'Prompt id={promptId} not found in role={role}.',
    requiredContextKeys: ['role', 'promptId'],
    nextFixHint: 'The row was deleted or renamed; reopen the list and pick another row.',
  },
  SEED_INSERT_E002: {
    code: 'SEED_INSERT_E002',
    area: 'SEED',
    action: 'PREFLIGHT',
    severity: 'warn',
    humanTemplate:
      'Preflight seeding failed for role={role}: {reason}.',
    requiredContextKeys: ['role', 'reason'],
    nextFixHint: 'Editor will fall back to static template; run Repair prompts to persist.',
  },
  SEED_ORPHAN_REPAIR_E001: {
    code: 'SEED_ORPHAN_REPAIR_E001',
    area: 'SEED',
    action: 'REPAIR_ORPHAN_ROLE',
    severity: 'warn',
    humanTemplate:
      'Orphan role repair failed for slug="{slug}" (fromRole={fromRole} -> toRole={toRole}) at stage={stage}: {reason}.',
    requiredContextKeys: ['slug', 'fromRole', 'toRole', 'stage', 'reason'],
    nextFixHint: 'Open More > Repair prompts to retry; if it persists, export diagnostics.',
  },
  DB_WRITE_E002: {
    code: 'DB_WRITE_E002',
    area: 'DB',
    action: 'UPSERT',
    severity: 'error',
    humanTemplate:
      'Prompt upsert failed for role={role} slug={slug}: {reason}.',
    requiredContextKeys: ['role', 'slug', 'reason'],
    nextFixHint: 'Retry the save; if it persists, export diagnostics and report.',
  },
  DB_WRITE_E003: {
    code: 'DB_WRITE_E003',
    area: 'DB',
    action: 'SET_DEFAULT',
    severity: 'error',
    humanTemplate:
      'Could not flag prompt id={promptId} as default for role={role}: {reason}.',
    requiredContextKeys: ['role', 'promptId', 'reason'],
    nextFixHint: 'Reopen the row and click "Set as default" from the gear menu.',
  },
  DB_READ_E001: {
    code: 'DB_READ_E001',
    area: 'DB',
    action: 'LIST',
    severity: 'error',
    humanTemplate:
      'listPromptsByRole failed for role={role}: {reason}.',
    requiredContextKeys: ['role', 'reason'],
    nextFixHint: 'Reload the extension; if it persists, export diagnostics.',
  },
  PROMPT_LOAD_E001: {
    code: 'PROMPT_LOAD_E001',
    area: 'PROMPT',
    action: 'LOAD_BY_ROLE',
    severity: 'error',
    humanTemplate:
      'Could not load {roleLabel} prompts at stage={stage} (role={role}, seedAttempted={seedAttempted}): {reason}.',
    requiredContextKeys: ['role', 'roleLabel', 'stage', 'seedAttempted', 'reason'],
    nextFixHint: 'Open More > Repair prompts, then retry; if it persists, export diagnostics.',
  },
  // ---- Plan 26 step 9: chip-gear-menu migration codes ----
  UI_ACTION_E001: {
    code: 'UI_ACTION_E001',
    area: 'UI',
    action: 'GEAR_MENU_ACTION',
    severity: 'error',
    humanTemplate:
      'Chip gear action "{actionName}" failed for role={role}: {reason}.',
    requiredContextKeys: ['actionName', 'role', 'reason', 'rejectionType'],
    nextFixHint: 'Retry the action; if it persists, reload the tab.',
  },
  PROMPT_IO_E001: {
    code: 'PROMPT_IO_E001',
    area: 'PROMPT_IO',
    action: 'OPEN_LIBRARY',
    severity: 'error',
    humanTemplate:
      'Prompt Library modal could not open: {reason} (op={op}).',
    requiredContextKeys: ['op', 'reason'],
    // eslint-disable-next-line sonarjs/no-duplicate-string -- shared user-facing hint reused across recovery codes
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  SEED_RESEED_E001: {
    code: 'SEED_RESEED_E001',
    area: 'SEED',
    action: 'RESEED_ON_DEMAND',
    severity: 'error',
    humanTemplate:
      'Re-seed defaults failed (force={force}): {reason}.',
    requiredContextKeys: ['force', 'reason'],
    nextFixHint: 'Retry from the gear menu; if it persists, run Repair prompts.',
  },
  DB_WRITE_E004: {
    code: 'DB_WRITE_E004',
    area: 'DB',
    action: 'DELETE',
    severity: 'error',
    humanTemplate:
      'Delete failed for prompt id={promptId} name="{name}": {reason}.',
    requiredContextKeys: ['promptId', 'name', 'reason'],
    nextFixHint: 'Reopen the row and retry, or use History to restore.',
  },
  // ---- Plan 26 step 10: prompt-history-panel migration codes ----
  HISTORY_LIST_E001: {
    code: 'HISTORY_LIST_E001',
    area: 'HISTORY',
    action: 'LIST',
    severity: 'error',
    humanTemplate:
      'Could not load revision history for slug="{slug}" role={role}: {reason}.',
    requiredContextKeys: ['slug', 'role', 'reason'],
    nextFixHint: 'Reload the tab and reopen History; if it persists, export diagnostics.',
  },
  HISTORY_RESTORE_E001: {
    code: 'HISTORY_RESTORE_E001',
    area: 'HISTORY',
    action: 'RESTORE',
    severity: 'error',
    humanTemplate:
      'Restore failed for slug="{slug}" (revisionId={revisionId}) at phase={phase}: {reason}.',
    requiredContextKeys: ['slug', 'revisionId', 'phase', 'reason'],
    nextFixHint: 'Reopen History and try a different revision, or Repair prompts first.',
  },
  HISTORY_UNDO_E001: {
    code: 'HISTORY_UNDO_E001',
    area: 'HISTORY',
    action: 'UNDO',
    severity: 'error',
    humanTemplate:
      'Undo of {undoKind} failed for slug="{slug}": {reason}.',
    requiredContextKeys: ['slug', 'undoKind', 'reason'],
    nextFixHint: 'Open History and restore the intended revision manually.',
  },
  HISTORY_EXPORT_E001: {
    code: 'HISTORY_EXPORT_E001',
    area: 'HISTORY',
    action: 'EXPORT',
    severity: 'error',
    humanTemplate:
      'Revision export failed for slug="{slug}" role={role}: {reason}.',
    requiredContextKeys: ['slug', 'role', 'reason'],
    nextFixHint: 'Retry the export; if it persists, reload the tab.',
  },
  HISTORY_IMPORT_E001: {
    code: 'HISTORY_IMPORT_E001',
    area: 'HISTORY',
    action: 'IMPORT_VALIDATE',
    severity: 'error',
    humanTemplate:
      'Revision import rejected for slug="{slug}" role={role} at stage={stage}: {reason}.',
    requiredContextKeys: ['slug', 'role', 'stage', 'reason'],
    nextFixHint: 'Pick a valid .json history archive exported from the same slug and try again.',
  },
  HISTORY_IMPORT_E002: {
    code: 'HISTORY_IMPORT_E002',
    area: 'HISTORY',
    action: 'IMPORT_WRITE',
    severity: 'error',
    humanTemplate:
      'Revision import DB write failed for slug="{slug}": {reason}.',
    requiredContextKeys: ['slug', 'reason'],
    nextFixHint: 'Retry the import; if it persists, export diagnostics and report.',
  },
  HISTORY_INTERNAL_E001: {
    code: 'HISTORY_INTERNAL_E001',
    area: 'HISTORY',
    action: 'INTERNAL',
    severity: 'warn',
    humanTemplate:
      'History panel internal warning at stage={stage}: {reason}.',
    requiredContextKeys: ['stage', 'reason'],
    nextFixHint: 'Non-fatal; captured for telemetry.',
  },
  // ---- Plan 26 step 11: prompt-injection validation migration codes ----
  PROMPT_VALIDATE_E002: {
    code: 'PROMPT_VALIDATE_E002',
    area: 'PROMPT',
    action: 'VALIDATE_TOKEN_DRIFT',
    severity: 'error',
    humanTemplate:
      'Cannot save {role} prompt "{slug}": {missingCount} required token(s) missing ({missingTokens}).',
    requiredContextKeys: ['role', 'slug', 'missingTokens', 'missingCount', 'ruleId'],
    nextFixHint: 'Re-insert the listed {{...}} token(s) in the editor and save again.',
  },
  PROMPT_VALIDATE_E003: {
    code: 'PROMPT_VALIDATE_E003',
    area: 'PROMPT',
    action: 'SAVE_UPSTREAM',
    severity: 'error',
    humanTemplate:
      'Save failed for {role} prompt "{slug}" ({ruleId}): {reason}.',
    requiredContextKeys: ['role', 'slug', 'ruleId', 'reason'],
    nextFixHint: 'Retry the save; if it persists, export diagnostics and report.',
  },
  PROMPT_UNDO_E001: {
    code: 'PROMPT_UNDO_E001',
    area: 'PROMPT',
    action: 'UNDO_UPSERT',
    severity: 'error',
    humanTemplate:
      'Undo of the last save failed for slug="{slug}": {reason}.',
    requiredContextKeys: ['slug', 'reason'],
    nextFixHint: 'Open History and restore the previous revision manually.',
  },
  // ---- Plan 26 step 12: seed + health migration codes ----
  SEED_PROMOTE_E001: {
    code: 'SEED_PROMOTE_E001',
    area: 'SEED',
    action: 'PROMOTE_DEFAULT',
    severity: 'error',
    humanTemplate:
      'Could not promote seed row "{slug}" to default for role={role}: {reason}.',
    requiredContextKeys: ['role', 'slug', 'reason'],
    nextFixHint: 'Run Repair prompts from the gear menu, then reopen the editor.',
  },
  SEED_LEGACY_UPGRADE_E001: {
    code: 'SEED_LEGACY_UPGRADE_E001',
    area: 'SEED',
    action: 'LEGACY_UPGRADE',
    severity: 'error',
    humanTemplate:
      'Legacy default body upgrade failed for role={role} slug="{slug}": {reason}.',
    requiredContextKeys: ['role', 'slug', 'reason'],
    nextFixHint: 'Retry the boot; if it persists, run More > Re-seed defaults (force).',
  },
  SEED_AUDIT_E001: {
    code: 'SEED_AUDIT_E001',
    area: 'SEED',
    action: 'AUDIT_WRITE',
    severity: 'warn',
    humanTemplate:
      'PromptSeedAudit row write failed: {reason}.',
    requiredContextKeys: ['reason'],
    nextFixHint: 'Non-fatal; seed still applied. Check DB schema drift.',
  },
  SEED_TELEMETRY_E001: {
    code: 'SEED_TELEMETRY_E001',
    area: 'SEED',
    action: 'PERSIST_TELEMETRY',
    severity: 'warn',
    humanTemplate:
      'Seed telemetry persistence failed: {reason}.',
    requiredContextKeys: ['reason'],
    nextFixHint: 'Non-fatal; localStorage may be full or blocked.',
  },
  SEED_BUNDLE_E001: {
    code: 'SEED_BUNDLE_E001',
    area: 'SEED',
    action: 'BUNDLE_LOOKUP',
    severity: 'error',
    humanTemplate:
      'Default prompt bundle lookup failed for slug="{slug}": {reason}.',
    requiredContextKeys: ['slug', 'reason'],
    nextFixHint: 'Run the prompt aggregation script and rebuild the extension.',
  },
  HEALTH_AUTO_REPAIR_E001: {
    code: 'HEALTH_AUTO_REPAIR_E001',
    area: 'HEALTH',
    action: 'AUTO_REPAIR',
    severity: 'error',
    humanTemplate:
      'Prompt auto-repair failed at stage={stage}: {reason}.',
    requiredContextKeys: ['stage', 'reason'],
    nextFixHint: 'Open the ⚙ gear on the affected chip and run "🩹 Repair prompts".',
  },
  // ---- Plan 26 step 13: DB layer migration codes ----
  DB_ROLE_ENFORCE_E001: {
    code: 'DB_ROLE_ENFORCE_E001',
    area: 'DB',
    action: 'ENFORCE_DEFAULT',
    severity: 'error',
    humanTemplate:
      'enforceSingleDefaultPerRole failed (role={role}, keepId={keepId}, stage={stage}): {reason}.',
    requiredContextKeys: ['role', 'keepId', 'stage', 'reason'],
    nextFixHint: 'Run More > Repair prompts, then retry the save.',
  },
  DB_PROMPT_E001: {
    code: 'DB_PROMPT_E001',
    area: 'DB',
    action: 'PROMPT_CRUD',
    severity: 'error',
    humanTemplate:
      'Prompt CRUD failed at {where}: {reason}.',
    requiredContextKeys: ['where', 'reason'],
    nextFixHint: 'Reopen the editor and retry; if it persists, run Repair prompts.',
  },
  DB_PROMPT_REVISION_SNAPSHOT_E001: {
    code: 'DB_PROMPT_REVISION_SNAPSHOT_E001',
    area: 'DB',
    action: 'REVISION_SNAPSHOT',
    severity: 'warn',
    humanTemplate:
      'Revision snapshot on upsert failed for slug={slug}: {reason}. The save itself succeeded; only history is missing.',
    requiredContextKeys: ['slug', 'reason'],
    nextFixHint: 'No user action required; check Export diagnostics if this recurs.',
  },
  DB_REVISION_E001: {
    code: 'DB_REVISION_E001',
    area: 'DB',
    action: 'REVISION_CRUD',
    severity: 'error',
    humanTemplate:
      'PromptRevision {where} failed (slug={slug}): {reason}.',
    requiredContextKeys: ['where', 'slug', 'reason'],
    nextFixHint: 'Retry from the History panel; export diagnostics if it persists.',
  },
  DB_REVISION_TRIM_E001: {
    code: 'DB_REVISION_TRIM_E001',
    area: 'DB',
    action: 'REVISION_TRIM',
    severity: 'warn',
    humanTemplate:
      'PromptRevision trim after {stage} failed for slug={slug}: {reason}. History over cap; not fatal.',
    requiredContextKeys: ['stage', 'slug', 'reason'],
    nextFixHint: 'No user action required; over-cap rows will be trimmed on next write.',
  },
  DB_MACRO_INIT_E001: {
    code: 'DB_MACRO_INIT_E001',
    area: 'DB',
    action: 'INIT',
    severity: 'error',
    humanTemplate:
      'Macro DB init failed at stage={stage}: {reason}.',
    requiredContextKeys: ['stage', 'reason'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  DB_MACRO_MIGRATION_E001: {
    code: 'DB_MACRO_MIGRATION_E001',
    area: 'DB',
    action: 'MIGRATE',
    severity: 'error',
    humanTemplate:
      'Prompt column migration failed for column={column}: {reason}.',
    requiredContextKeys: ['column', 'reason'],
    nextFixHint: 'Export diagnostics; the column will be retried on next boot.',
  },
  DB_MACRO_WRITE_E001: {
    code: 'DB_MACRO_WRITE_E001',
    area: 'DB',
    action: 'WRITE',
    severity: 'error',
    humanTemplate:
      '{op} failed: {reason}.',
    requiredContextKeys: ['op', 'reason'],
    nextFixHint: 'Retry the action; if it persists, export diagnostics.',
  },
  DB_MACRO_READ_E001: {
    code: 'DB_MACRO_READ_E001',
    area: 'DB',
    action: 'READ',
    severity: 'error',
    humanTemplate:
      '{op} failed: {reason}.',
    requiredContextKeys: ['op', 'reason'],
    nextFixHint: 'Reload the tab; if it persists, export diagnostics.',
  },
  DB_MACRO_EXPORT_E001: {
    code: 'DB_MACRO_EXPORT_E001',
    area: 'DB',
    action: 'EXPORT',
    severity: 'error',
    humanTemplate:
      'Database dump export failed: {reason}.',
    requiredContextKeys: ['reason'],
    nextFixHint: 'Retry export; if it persists, reload the extension and try again.',
  },
  DB_CHAT_SUBMIT_E001: {
    code: 'DB_CHAT_SUBMIT_E001',
    area: 'DB',
    action: 'CHAT_SUBMIT',
    severity: 'error',
    humanTemplate:
      'ProjectChatSubmit {op} failed (kind={kind}): {reason}.',
    requiredContextKeys: ['op', 'kind', 'reason'],
    nextFixHint: 'Retry the submit capture; if it persists, export diagnostics.',
  },
  // ---- Plan 26 step 14: repair-report modal codes ----
  REPAIR_RESEED_E001: {
    code: 'REPAIR_RESEED_E001',
    area: 'REPAIR',
    action: 'RESEED',
    severity: 'error',
    humanTemplate:
      'Repair reseed failed after {initialCount} initial issue(s): {reason}.',
    requiredContextKeys: ['initialCount', 'reason'],
    nextFixHint: 'Reload the tab and rerun "🩹 Repair prompts"; export diagnostics if it persists.',
  },
  REPAIR_RESIDUAL_E001: {
    code: 'REPAIR_RESIDUAL_E001',
    area: 'REPAIR',
    action: 'RESIDUAL',
    severity: 'warn',
    humanTemplate:
      'Repair finished with {finalCount} unresolved issue(s) (fixed={fixedCount}, stillBroken={stillBrokenCount}, newlyFlagged={newlyFlaggedCount}).',
    requiredContextKeys: ['finalCount', 'fixedCount', 'stillBrokenCount', 'newlyFlaggedCount'],
    nextFixHint: 'Open the repair report, copy it, and file the failing slug(s) for triage.',
  },
  REPAIR_COPY_E001: {
    code: 'REPAIR_COPY_E001',
    area: 'REPAIR',
    action: 'COPY',
    severity: 'warn',
    humanTemplate:
      'Copy repair report to clipboard failed: {reason}.',
    requiredContextKeys: ['reason'],
    nextFixHint: 'Select the report text manually and copy with Ctrl/Cmd+C.',
  },
  // ==== Plan 27 step 3: PROD-file code reservations ====
  // Codes below cover every remaining legacy `throw new Error(...)` site in
  // `standalone-scripts/macro-controller/src/` (see manifest at
  // `.lovable/plans/subtasks/27-legacy-throw-migration/SS-01-migration-manifest.md`).
  // Codes emitted this turn: CREDIT_FETCH_E001..E003 (credit-fetch.ts).
  // All other codes are reserved (INTENTIONALLY_UNEMITTED) and graduate as
  // steps 5..13 of Plan 27 land their migrations.

  // --- credit-fetch.ts (emitted, step 4) ---
  CREDIT_FETCH_E001: {
    code: 'CREDIT_FETCH_E001',
    area: 'CREDIT',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Credit fetch could not start: marco SDK path {missingApi} is unavailable (stage={readinessStage}).',
    requiredContextKeys: ['missingApi', 'readinessStage', 'op'],
    nextFixHint: 'Reload the tab; if the error persists, reinstall the extension.',
  },
  CREDIT_FETCH_E002: {
    code: 'CREDIT_FETCH_E002',
    area: 'CREDIT',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Credit fetch HTTP {status} at {url} (op={op}, retry={isRetry}).',
    requiredContextKeys: ['status', 'url', 'op', 'isRetry'],
    nextFixHint: 'Check network + auth; the loop will retry once via auth recovery.',
  },
  CREDIT_FETCH_E003: {
    code: 'CREDIT_FETCH_E003',
    area: 'CREDIT',
    action: 'AUTH_RECOVERY',
    severity: 'error',
    humanTemplate:
      'Credit auth recovery failed after HTTP {status}: {reason}.',
    requiredContextKeys: ['status', 'reason', 'tokenSource'],
    nextFixHint: 'Sign in to Lovable again in this tab, then retry the action.',
  },

  // --- credit-balance.ts (emitted, Plan 22 · toast migration) ---
  CREDIT_BALANCE_E001: {
    code: 'CREDIT_BALANCE_E001',
    area: 'CREDIT',
    action: 'WORKSPACE_RESOLVE_HTTP',
    severity: 'error',
    humanTemplate:
      'Credit-balance could not resolve workspace for project {projectId}: HTTP {status} at {url}.',
    requiredContextKeys: ['projectId', 'status', 'url'],
    nextFixHint: 'Check network + auth; the poller will retry on the next cycle.',
  },
  CREDIT_BALANCE_E002: {
    code: 'CREDIT_BALANCE_E002',
    area: 'CREDIT',
    action: 'WORKSPACE_RESOLVE_SHAPE',
    severity: 'error',
    humanTemplate:
      'Credit-balance workspace resolve for project {projectId} returned an unexpected payload: {reason}.',
    requiredContextKeys: ['projectId', 'reason'],
    nextFixHint: 'Reload the tab; if the shape mismatch persists, file a bug with the response preview.',
  },
  CREDIT_BALANCE_E003: {
    code: 'CREDIT_BALANCE_E003',
    area: 'CREDIT',
    action: 'WORKSPACE_RESOLVE_THREW',
    severity: 'error',
    humanTemplate:
      'Credit-balance workspace resolve threw for project {projectId}: {reason}.',
    requiredContextKeys: ['projectId', 'reason'],
    nextFixHint: 'Check the network tab; the poller will retry on the next cycle.',
  },
  CREDIT_BALANCE_E004: {
    code: 'CREDIT_BALANCE_E004',
    area: 'CREDIT',
    action: 'AUTH_RECOVERY',
    severity: 'error',
    humanTemplate:
      'Credit-balance auth recovery failed after HTTP {status} for workspace {wsId}.',
    requiredContextKeys: ['wsId', 'status'],
    nextFixHint: 'Sign in to lovable.dev in this tab and retry the action.',
  },
  CREDIT_BALANCE_E005: {
    code: 'CREDIT_BALANCE_E005',
    area: 'CREDIT',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Credit-balance fetch for workspace {wsId} failed with HTTP {status} (retry={isRetry}).',
    requiredContextKeys: ['wsId', 'status', 'isRetry'],
    nextFixHint: 'Check network + auth; the poller will retry on the next cycle.',
  },
  CREDIT_BALANCE_E006: {
    code: 'CREDIT_BALANCE_E006',
    area: 'CREDIT',
    action: 'RESPONSE_SHAPE',
    severity: 'error',
    humanTemplate:
      'Credit-balance response for workspace {wsId} is missing required field {missingField}.',
    requiredContextKeys: ['wsId', 'missingField'],
    nextFixHint: 'The API contract changed; file a bug with the raw response.',
  },
  CREDIT_BALANCE_E007: {
    code: 'CREDIT_BALANCE_E007',
    area: 'CREDIT',
    action: 'NETWORK',
    severity: 'error',
    humanTemplate:
      'Credit-balance network error for workspace {wsId}: {reason}.',
    requiredContextKeys: ['wsId', 'reason'],
    nextFixHint: 'Check network connectivity; the poller will retry on the next cycle.',
  },
  CREDIT_BALANCE_E008: {
    code: 'CREDIT_BALANCE_E008',
    area: 'CREDIT',
    action: 'LOW_BALANCE_MOVE',
    severity: 'warn',
    humanTemplate:
      'Daily credits ({dailyRemaining}) below threshold ({threshold}); moving workspace {direction}.',
    requiredContextKeys: ['dailyRemaining', 'threshold', 'direction'],
    nextFixHint: 'No action needed; the loop will move to the next workspace automatically.',
  },



  // --- credit-api.ts (reserved) ---
  CREDIT_ASSERT_E001: {
    code: 'CREDIT_ASSERT_E001',
    area: 'CREDIT',
    action: 'LEGACY_CALC_FOR_PRO_ZERO',
    severity: 'error',
    humanTemplate:
      'Legacy credit aggregator {fnName}() invoked for plan={plan}. The pro_0 plan MUST read enriched MacroCreditSummary from calculateProZeroCreditSummary(balance); the legacy path double-counts daily_limit and rollover.',
    requiredContextKeys: ['fnName', 'plan'],
    nextFixHint: 'Route pro_0 via pro-zero-credit-calculator and read enriched WorkspaceCredit fields; do not call calcTotalCredits/calcAvailableCredits with plan=pro_0.',
  },

  // --- remix-fetch.ts (reserved) ---
  REMIX_FETCH_E001: {
    code: 'REMIX_FETCH_E001',
    area: 'REMIX',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Remix fetch could not start: marco SDK path {missingApi} is unavailable (op={op}).',
    requiredContextKeys: ['missingApi', 'op'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  REMIX_FETCH_E002: {
    code: 'REMIX_FETCH_E002',
    area: 'REMIX',
    action: 'ARGS',
    severity: 'error',
    humanTemplate:
      'Remix fetch argument invalid: {argument} is required (op={op}).',
    requiredContextKeys: ['argument', 'op'],
    nextFixHint: 'The caller must pass a non-empty {argument}; open a bug if this occurred from UI.',
  },
  REMIX_FETCH_E003: {
    code: 'REMIX_FETCH_E003',
    area: 'REMIX',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Remix HTTP {status} at {url} (op={op}): {preview}.',
    requiredContextKeys: ['status', 'url', 'op', 'preview'],
    nextFixHint: 'Retry the remix action; check network + auth.',
  },

  // --- remix-bulk.ts (reserved) ---
  REMIX_BULK_E001: {
    code: 'REMIX_BULK_E001',
    area: 'REMIX',
    action: 'BULK_SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Bulk remix could not start: marco SDK path {missingApi} is unavailable (wsId={wsId}).',
    requiredContextKeys: ['missingApi', 'wsId'],
    nextFixHint: 'Reload the tab and reopen the Bulk Remix panel; if it persists, reinstall the extension.',
  },
  REMIX_BULK_E002: {
    code: 'REMIX_BULK_E002',
    area: 'REMIX',
    action: 'EMPTY_WORKSPACE',
    severity: 'warn',
    humanTemplate:
      'Bulk remix skipped workspace {wsId}: no candidate project matched base "{sourceBase}".',
    requiredContextKeys: ['wsId', 'sourceBase'],
    nextFixHint: 'Create at least one Lovable project in the workspace before retrying.',
  },
  REMIX_BULK_E003: {
    code: 'REMIX_BULK_E003',
    area: 'REMIX',
    action: 'BULK_HTTP',
    severity: 'error',
    humanTemplate:
      'Bulk remix HTTP {status} while listing projects for workspace {wsId}.',
    requiredContextKeys: ['status', 'wsId'],
    nextFixHint: 'Verify auth and network, then retry the bulk remix action.',
  },

  // --- remix-name-resolver.ts (reserved) ---
  REMIX_RESOLVE_E001: {
    code: 'REMIX_RESOLVE_E001',
    area: 'REMIX',
    action: 'RESOLVE_NAME',
    severity: 'error',
    humanTemplate:
      'Remix name resolver rejected input: {reason} (currentName="{currentName}").',
    requiredContextKeys: ['reason', 'currentName'],
    nextFixHint: 'Provide a non-empty project name and retry.',
  },
  REMIX_RESOLVE_E002: {
    code: 'REMIX_RESOLVE_E002',
    area: 'REMIX',
    action: 'RESOLVE_NAME_LIMIT',
    severity: 'error',
    humanTemplate:
      'Remix name resolver exhausted candidates starting from "{currentName}" after {maxCollisionIncrements} increments.',
    requiredContextKeys: ['currentName', 'maxCollisionIncrements'],
    nextFixHint: 'Rename existing "-N" duplicates in the workspace, then retry.',
  },

  // --- ws-members-fetch.ts (reserved) ---
  WS_MEMBERS_FETCH_E001: {
    code: 'WS_MEMBERS_FETCH_E001',
    area: 'WS_MEMBERS',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Workspace members fetch could not start: marco.api.memberships is unavailable (op={op}).',
    requiredContextKeys: ['op'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  WS_MEMBERS_FETCH_E002: {
    code: 'WS_MEMBERS_FETCH_E002',
    area: 'WS_MEMBERS',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Workspace members HTTP {status} for wsId={wsId}: {preview}.',
    requiredContextKeys: ['status', 'wsId', 'preview'],
    nextFixHint: 'Verify workspace permissions and retry.',
  },

  // --- ws-members-mutations.ts (reserved) ---
  WS_MEMBERS_MUTATE_E001: {
    code: 'WS_MEMBERS_MUTATE_E001',
    area: 'WS_MEMBERS',
    action: 'ARGS',
    severity: 'error',
    humanTemplate:
      'Workspace member {mutation} argument invalid: {argument} is required.',
    requiredContextKeys: ['mutation', 'argument'],
    nextFixHint: 'The UI must supply {argument}; report as a bug if this fired from a filled form.',
  },
  WS_MEMBERS_MUTATE_E002: {
    code: 'WS_MEMBERS_MUTATE_E002',
    area: 'WS_MEMBERS',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Workspace member {mutation} HTTP {status} for wsId={wsId}: {preview}.',
    requiredContextKeys: ['mutation', 'status', 'wsId', 'preview'],
    nextFixHint: 'Verify permissions on this workspace and retry.',
  },
  WS_MEMBERS_MUTATE_E003: {
    code: 'WS_MEMBERS_MUTATE_E003',
    area: 'WS_MEMBERS',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Workspace member {mutation} could not start: marco.api.memberships is unavailable.',
    requiredContextKeys: ['mutation'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },

  // --- ws-adjacent.ts (reserved) ---
  WS_CONTEXT_ADJACENT_E001: {
    code: 'WS_CONTEXT_ADJACENT_E001',
    area: 'WS_CONTEXT',
    action: 'FETCH_HTTP',
    severity: 'error',
    humanTemplate:
      'Adjacent workspace fetch failed: HTTP {status} (op={op}).',
    requiredContextKeys: ['status', 'op'],
    nextFixHint: 'Reload the workspace list and retry.',
  },
  WS_CONTEXT_ADJACENT_E002: {
    code: 'WS_CONTEXT_ADJACENT_E002',
    area: 'WS_CONTEXT',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Adjacent workspace fetch could not start: {missingApi} is unavailable.',
    requiredContextKeys: ['missingApi'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },


  // --- rename-api.ts ---
  RENAME_REQUEST_E001: {
    code: 'RENAME_REQUEST_E001',
    area: 'RENAME',
    action: 'REQUEST',
    severity: 'error',
    humanTemplate:
      'Project rename request failed at {url}: HTTP {status} (workspaceId={wsId}).',
    requiredContextKeys: ['url', 'status', 'wsId'],
    nextFixHint: 'Retry rename; if 403, you likely lack permission on the project.',
  },
  RENAME_FORBIDDEN_CACHED_E001: {
    code: 'RENAME_FORBIDDEN_CACHED_E001',
    area: 'RENAME',
    action: 'FORBIDDEN_CACHED',
    severity: 'warn',
    humanTemplate:
      'Project rename skipped: workspace {wsId} is in the forbidden cache from a prior 403.',
    requiredContextKeys: ['wsId'],
    nextFixHint: 'Call renameWorkspace(wsId, newName, true) to force-retry and bypass the cache.',
  },
  RENAME_NO_BEARER_E001: {
    code: 'RENAME_NO_BEARER_E001',
    area: 'RENAME',
    action: 'NO_BEARER',
    severity: 'error',
    humanTemplate:
      'Project rename aborted for workspace {wsId}: no bearer token available after auth recovery.',
    requiredContextKeys: ['wsId'],
    nextFixHint: 'Sign in to lovable.dev in this tab and retry the rename.',
  },
  RENAME_CREDIT_LIMIT_FALLBACK_E001: {
    code: 'RENAME_CREDIT_LIMIT_FALLBACK_E001',
    area: 'RENAME',
    action: 'CREDIT_LIMIT_FALLBACK',
    severity: 'warn',
    humanTemplate:
      'Rename hit HTTP {status} on the monthly-limit field for workspace {wsId}; retrying without it. Response: {bodyPreview}',
    requiredContextKeys: ['wsId', 'status', 'bodyPreview'],
    nextFixHint: 'No action needed; the retry omits default_monthly_member_credit_limit.',
  },
  RENAME_AUTH_RECOVERY_E001: {
    code: 'RENAME_AUTH_RECOVERY_E001',
    area: 'RENAME',
    action: 'AUTH_RECOVERY',
    severity: 'warn',
    humanTemplate:
      'Rename received HTTP 401 for workspace {wsId}; recovering session and retrying once.',
    requiredContextKeys: ['wsId'],
    nextFixHint: 'If this recurs, sign in to lovable.dev in this tab and retry.',
  },

  // --- settings-store.ts (reserved) ---
  SETTINGS_PERSIST_E001: {
    code: 'SETTINGS_PERSIST_E001',
    area: 'SETTINGS',
    action: 'PERSIST',
    severity: 'error',
    humanTemplate:
      'Settings persist failed: chrome.storage.local unavailable AND localStorage write threw ({reason}).',
    requiredContextKeys: ['reason', 'fallbackStage'],
    nextFixHint: 'Grant the extension storage permission and reload.',
  },

  // --- settings-modal.ts (reserved) ---
  SETTINGS_VALIDATE_E001: {
    code: 'SETTINGS_VALIDATE_E001',
    area: 'SETTINGS',
    action: 'VALIDATE',
    severity: 'error',
    humanTemplate:
      'Settings validation failed for "{fieldLabel}": expected non-negative number, got "{rawValue}".',
    requiredContextKeys: ['fieldLabel', 'rawValue'],
    nextFixHint: 'Enter a number greater than or equal to zero and save.',
  },

  // --- ui/projects-modal.ts (reserved) ---
  UI_PROJECTS_LIST_E001: {
    code: 'UI_PROJECTS_LIST_E001',
    area: 'UI',
    action: 'PROJECTS_LIST',
    severity: 'error',
    humanTemplate:
      'Projects modal could not load list at {url}: {reason} (status={status}).',
    requiredContextKeys: ['url', 'reason', 'status'],
    nextFixHint: 'Reopen the Projects modal; if it persists, reload the tab.',
  },

  // --- ui/section-open-tabs.ts (reserved) ---
  UI_COPY_E001: {
    code: 'UI_COPY_E001',
    area: 'UI',
    action: 'CLIPBOARD_COPY',
    severity: 'warn',
    humanTemplate:
      'Copy-to-clipboard fallback failed: {reason}.',
    requiredContextKeys: ['reason', 'strategy'],
    nextFixHint: 'Select the text manually and press Ctrl/Cmd+C.',
  },

  // --- ui/task-splitter-prompt.ts (reserved) ---
  SPLITTER_INVALID_N_E001: {
    code: 'SPLITTER_INVALID_N_E001',
    area: 'SPLITTER',
    action: 'VALIDATE_N_TYPE',
    severity: 'error',
    humanTemplate:
      'Task splitter rejected n: must be an integer, got {rawValue}.',
    requiredContextKeys: ['rawValue'],
    nextFixHint: 'Enter a whole number for the step count.',
  },
  SPLITTER_INVALID_N_E002: {
    code: 'SPLITTER_INVALID_N_E002',
    area: 'SPLITTER',
    action: 'VALIDATE_N_RANGE',
    severity: 'error',
    humanTemplate:
      'Task splitter rejected n={value}: must be between {minN} and {maxN}.',
    requiredContextKeys: ['value', 'minN', 'maxN'],
    nextFixHint: 'Choose a step count within the allowed range and retry.',
  },
  SPLITTER_EMPTY_INSTRUCTION_E001: {
    code: 'SPLITTER_EMPTY_INSTRUCTION_E001',
    area: 'SPLITTER',
    action: 'VALIDATE_INSTRUCTION',
    severity: 'error',
    humanTemplate:
      'Task splitter rejected rawInstruction: must be non-empty.',
    requiredContextKeys: ['inputLength'],
    nextFixHint: 'Type or paste a task description before splitting.',
  },

  // --- ui/template-renderer.ts (reserved) ---
  UI_TEMPLATE_NOT_FOUND_E001: {
    code: 'UI_TEMPLATE_NOT_FOUND_E001',
    area: 'UI',
    action: 'TEMPLATE_LOOKUP',
    severity: 'error',
    humanTemplate:
      'Template "{templateName}" not found; available: {availableList}.',
    requiredContextKeys: ['templateName', 'availableList'],
    nextFixHint: 'Register the template at boot or check for a typo in the caller.',
  },

  // --- ui/prompt-import-audit.ts (reserved) ---
  PROMPT_IO_AUDIT_E001: {
    code: 'PROMPT_IO_AUDIT_E001',
    area: 'PROMPT_IO',
    action: 'AUDIT_SHAPE',
    severity: 'error',
    humanTemplate:
      'Prompt import audit: parsed value is not an object (type={actualType}).',
    requiredContextKeys: ['actualType'],
    nextFixHint: 'Re-export the prompts and try again.',
  },
  PROMPT_IO_AUDIT_E002: {
    code: 'PROMPT_IO_AUDIT_E002',
    area: 'PROMPT_IO',
    action: 'AUDIT_ENTRIES',
    severity: 'error',
    humanTemplate:
      'Prompt import audit: "entries" is not an array (type={actualType}).',
    requiredContextKeys: ['actualType'],
    nextFixHint: 'The file is malformed; re-export from a supported source.',
  },

  // --- ui/prompt-import-modal.ts (reserved) ---
  PROMPT_IO_ENVELOPE_E001: {
    code: 'PROMPT_IO_ENVELOPE_E001',
    area: 'PROMPT_IO',
    action: 'ENVELOPE_VALIDATE',
    severity: 'error',
    humanTemplate:
      'Prompt import JSON envelope invalid: {errorList}.',
    requiredContextKeys: ['errorList'],
    nextFixHint: 'Fix the listed schema errors in the file and reimport.',
  },

  // --- ui/prompt-io-format-detect.ts (reserved) ---
  PROMPT_IO_FORMAT_E001: {
    code: 'PROMPT_IO_FORMAT_E001',
    area: 'PROMPT_IO',
    action: 'DETECT_FORMAT',
    severity: 'error',
    humanTemplate:
      'Unknown prompt bundle format. First 16 bytes: {byteHexDump}.',
    requiredContextKeys: ['byteHexDump'],
    nextFixHint: 'Provide a supported prompt bundle (ZIP, SQLite, or JSON).',
  },

  // --- ui/prompt-io-sqlite-reader.ts (reserved) ---
  PROMPT_IO_SQLITE_E001: {
    code: 'PROMPT_IO_SQLITE_E001',
    area: 'PROMPT_IO',
    action: 'SQLITE_META',
    severity: 'error',
    humanTemplate:
      'SQLite bundle Meta row missing key "{missingKey}".',
    requiredContextKeys: ['missingKey'],
    nextFixHint: 'The bundle is corrupt; re-export from the source extension.',
  },
  PROMPT_IO_SQLITE_E002: {
    code: 'PROMPT_IO_SQLITE_E002',
    area: 'PROMPT_IO',
    action: 'SQLITE_ROW',
    severity: 'error',
    humanTemplate:
      'SQLite bundle Prompts row is missing Name (rowId={rowId}).',
    requiredContextKeys: ['rowId'],
    nextFixHint: 'The bundle is corrupt; re-export from the source extension.',
  },
  PROMPT_IO_SQLITE_E003: {
    code: 'PROMPT_IO_SQLITE_E003',
    area: 'PROMPT_IO',
    action: 'SQLITE_TABLE_MISSING',
    severity: 'error',
    humanTemplate:
      'SQLite bundle is missing required table "{tableName}".',
    requiredContextKeys: ['tableName'],
    nextFixHint: 'The bundle is corrupt; re-export from the source extension.',
  },
  PROMPT_IO_SQLITE_E004: {
    code: 'PROMPT_IO_SQLITE_E004',
    area: 'PROMPT_IO',
    action: 'SQLITE_SCHEMA_MISMATCH',
    severity: 'error',
    humanTemplate:
      'SQLite bundle SchemaVersion={actualVersion}, expected {expectedVersion}.',
    requiredContextKeys: ['actualVersion', 'expectedVersion'],
    nextFixHint: 'Update the extension to match the bundle schema and retry.',
  },
  PROMPT_IO_SQLITE_E005: {
    code: 'PROMPT_IO_SQLITE_E005',
    area: 'PROMPT_IO',
    action: 'SQLITE_INIT',
    severity: 'error',
    humanTemplate:
      'SQLite reader init failed at stage={stage}: {reason}.',
    requiredContextKeys: ['stage', 'reason'],
    nextFixHint: 'Reload the tab and retry; export diagnostics if it persists.',
  },

  // --- ui/prompt-io-zip-reader.ts (reserved) ---
  PROMPT_IO_ZIP_E001: {
    code: 'PROMPT_IO_ZIP_E001',
    area: 'PROMPT_IO',
    action: 'ZIP_EOCD_MISSING',
    severity: 'error',
    humanTemplate:
      'ZIP is missing the End-of-Central-Directory record.',
    requiredContextKeys: ['byteLength'],
    nextFixHint: 'The file is truncated; re-export the prompt bundle.',
  },
  PROMPT_IO_ZIP_E002: {
    code: 'PROMPT_IO_ZIP_E002',
    area: 'PROMPT_IO',
    action: 'ZIP_CENTRAL_CORRUPT',
    severity: 'error',
    humanTemplate:
      'ZIP central directory corrupt at offset {offset} (signature=0x{signatureHex}).',
    requiredContextKeys: ['offset', 'signatureHex'],
    nextFixHint: 'The file is corrupt; re-export the prompt bundle.',
  },
  PROMPT_IO_ZIP_E003: {
    code: 'PROMPT_IO_ZIP_E003',
    area: 'PROMPT_IO',
    action: 'ZIP_LOCAL_CORRUPT',
    severity: 'error',
    humanTemplate:
      'ZIP local header corrupt for entry "{entryName}" (offset={offset}).',
    requiredContextKeys: ['entryName', 'offset'],
    nextFixHint: 'The file is corrupt; re-export the prompt bundle.',
  },
  PROMPT_IO_ZIP_E004: {
    code: 'PROMPT_IO_ZIP_E004',
    area: 'PROMPT_IO',
    action: 'ZIP_COMPRESSION_UNSUPPORTED',
    severity: 'error',
    humanTemplate:
      'ZIP entry "{entryName}" uses compression method {compressionMethod} (only store/0 supported).',
    requiredContextKeys: ['entryName', 'compressionMethod'],
    nextFixHint: 'Re-export the bundle using STORE compression (no deflate).',
  },
  PROMPT_IO_ZIP_E005: {
    code: 'PROMPT_IO_ZIP_E005',
    area: 'PROMPT_IO',
    action: 'ZIP_MANIFEST_MISSING',
    severity: 'error',
    humanTemplate:
      'ZIP bundle is missing manifest.json.',
    requiredContextKeys: ['entryCount'],
    nextFixHint: 'Re-export the bundle from a supported source.',
  },
  PROMPT_IO_ZIP_E006: {
    code: 'PROMPT_IO_ZIP_E006',
    area: 'PROMPT_IO',
    action: 'ZIP_MANIFEST_INVALID',
    severity: 'error',
    humanTemplate:
      'ZIP manifest.json failed validation: {errorList}.',
    requiredContextKeys: ['errorList'],
    nextFixHint: 'Fix the listed schema errors and re-export the bundle.',
  },
  PROMPT_IO_ZIP_E007: {
    code: 'PROMPT_IO_ZIP_E007',
    area: 'PROMPT_IO',
    action: 'ZIP_ENTRY_BODY_MISSING',
    severity: 'error',
    humanTemplate:
      'ZIP bundle is missing entries/{slug}.md for prompt "{promptName}".',
    requiredContextKeys: ['slug', 'promptName'],
    nextFixHint: 'Re-export the bundle from a supported source.',
  },

  // --- queue-control/task-queue.ts (reserved) ---
  QUEUE_INVARIANT_E001: {
    code: 'QUEUE_INVARIANT_E001',
    area: 'QUEUE',
    action: 'INVARIANT',
    severity: 'error',
    humanTemplate:
      'Task queue invariant violated at {where}: {reason}.',
    requiredContextKeys: ['where', 'reason'],
    nextFixHint: 'Reload the tab and inspect the queue state via diagnostics.',
  },

  // --- loop-cycle-fallback.ts (reserved) ---
  LOOP_FALLBACK_SDK_E001: {
    code: 'LOOP_FALLBACK_SDK_E001',
    area: 'LOOP',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'Loop cycle fallback could not start: marco.api.credits.fetchWorkspaces unavailable.',
    requiredContextKeys: ['op'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  LOOP_FALLBACK_HTTP_E001: {
    code: 'LOOP_FALLBACK_HTTP_E001',
    area: 'LOOP',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'Loop cycle fallback HTTP {status} at {url}.',
    requiredContextKeys: ['status', 'url', 'op'],
    nextFixHint: 'Check network + auth; the loop will fall back to cached credits.',
  },

  // --- gitsync/progress-probe.ts (reserved) ---
  GITSYNC_PROBE_E001: {
    code: 'GITSYNC_PROBE_E001',
    area: 'GITSYNC',
    action: 'ARGS',
    severity: 'error',
    humanTemplate:
      'gitsync probeProgress requires wsId, projectId, jobId (missing={missingArgs}).',
    requiredContextKeys: ['missingArgs'],
    nextFixHint: 'The caller must supply all three; report as a bug if this fired from UI.',
  },
  GITSYNC_PROBE_E002: {
    code: 'GITSYNC_PROBE_E002',
    area: 'GITSYNC',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'gitsync probeProgress could not start: {reason}.',
    requiredContextKeys: ['reason'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },
  GITSYNC_PROBE_E003: {
    code: 'GITSYNC_PROBE_E003',
    area: 'GITSYNC',
    action: 'HTTP',
    severity: 'error',
    humanTemplate:
      'gitsync probeProgress HTTP {status} at {url}.',
    requiredContextKeys: ['status', 'url'],
    nextFixHint: 'Retry the gitsync check; verify network + auth.',
  },

  // --- pro-zero/pro-zero-sdk-adapter.ts (reserved) ---
  PROZERO_ADAPTER_E001: {
    code: 'PROZERO_ADAPTER_E001',
    area: 'PROZERO',
    action: 'SDK_NOT_READY',
    severity: 'error',
    humanTemplate:
      'pro-zero adapter cannot bind: marco.api.credits is unavailable.',
    requiredContextKeys: ['stage'],
    nextFixHint: 'Reload the tab; if it persists, reinstall the extension.',
  },

  // --- async-utils.ts (reserved) ---
  ASYNC_RETRY_E001: {
    code: 'ASYNC_RETRY_E001',
    area: 'ASYNC',
    action: 'RETRY_EXHAUSTED',
    severity: 'error',
    humanTemplate:
      'withRetry exhausted after {attempts} attempts (op={op}): {reason}.',
    requiredContextKeys: ['attempts', 'op', 'reason'],
    nextFixHint: 'Retry the parent action; if it persists, export diagnostics.',
  },

  // --- types/prompt-role.ts (reserved) ---
  TYPE_EXHAUSTIVE_E001: {
    code: 'TYPE_EXHAUSTIVE_E001',
    area: 'TYPE',
    action: 'EXHAUSTIVE_CHECK',
    severity: 'error',
    humanTemplate:
      'Unhandled discriminant "{discriminantValue}" for type {typeName}.',
    requiredContextKeys: ['discriminantValue', 'typeName'],
    nextFixHint: 'Add a case for {discriminantValue} in the exhaustive switch and rebuild.',
  },
});

/** All defined codes, for iteration and CI checks. */
export const ALL_ERROR_CODES: readonly string[] = Object.freeze(Object.keys(ERROR_CODES));

/** Union of all registered error code identifiers. */
export type ErrorCode = keyof typeof ERROR_CODES;

/** Lookup helper — returns `undefined` for unknown codes; callers MUST validate. */
export function getErrorCodeEntry(code: string): ErrorCodeEntry | undefined {
  return ERROR_CODES[code];
}

/**
 * Extract `{placeholder}` names from a humanTemplate. Used by DiagnosticError
 * and by the Vitest suite in step 16 to prove every placeholder is listed in
 * requiredContextKeys.
 */
export function extractTemplatePlaceholders(template: string): readonly string[] {
  const out: string[] = [];
  // Match {name} but NOT {{n}} (the {{n}} token is a prompt-body marker, not a template variable).
  const re = /(^|[^{])\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    const name = match[2];
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}
