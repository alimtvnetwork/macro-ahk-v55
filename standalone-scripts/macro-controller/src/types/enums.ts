// Auto-generated enums
export const RequestType = { XHR: "xhr", FETCH: "fetch" } as const;
export type RequestType = typeof RequestType[keyof typeof RequestType];
export const FullStrategyEnum = { ID: "id", TESTID: "testid", ROLE_TEXT: "role-text", POSITIONAL: "positional" } as const;
export type FullStrategyEnum = typeof FullStrategyEnum[keyof typeof FullStrategyEnum];
export const KindEnum = { LOG: "log", ERROR: "error" } as const;
export type KindEnum = typeof KindEnum[keyof typeof KindEnum];
export const SeverityFilterEnum = { ALL: "all", INFO: "info", WARN: "warn", ERROR: "error" } as const;
export type SeverityFilterEnum = typeof SeverityFilterEnum[keyof typeof SeverityFilterEnum];
export const SourceFilterEnum = { ALL: "all", BACKGROUND: "background", CONTENT: "content", USER_SCRIPT: "user-script", MACRO: "macro" } as const;
export type SourceFilterEnum = typeof SourceFilterEnum[keyof typeof SourceFilterEnum];
export const EditorThemeNameEnum = { DRACULA: "dracula", MONOKAI: "monokai", NORD: "nord", LIGHT: "light" } as const;
export type EditorThemeNameEnum = typeof EditorThemeNameEnum[keyof typeof EditorThemeNameEnum];
export const DatabaseEnum = { LOGS: "logs", ERRORS: "errors" } as const;
export type DatabaseEnum = typeof DatabaseEnum[keyof typeof DatabaseEnum];
export const DirectionEnum = { UP: "up", DOWN: "down" } as const;
export type DirectionEnum = typeof DirectionEnum[keyof typeof DirectionEnum];
export const LinkState = { SYNCED: "synced", PINNED: "pinned", DETACHED: "detached" } as const;
export type LinkState = typeof LinkState[keyof typeof LinkState];
export const Enum_7249a314 = { DURATIONMS: "durationMs", ERRORMESSAGE: "errorMessage", ISSUCCESS: "isSuccess", SCRIPTID: "scriptId", SCRIPTNAME: "scriptName", SKIPREASON: "skipReason" } as const;
export type Enum_7249a314 = typeof Enum_7249a314[keyof typeof Enum_7249a314];
export const Enum_7b1045ad = { MERGE: "merge", REPLACE: "replace" } as const;
export type Enum_7b1045ad = typeof Enum_7b1045ad[keyof typeof Enum_7b1045ad];
export const MatchStrategyEnum = { EXACT: "exact", PREFIX: "prefix", CONTAINS: "contains", REGEX: "regex" } as const;
export type MatchStrategyEnum = typeof MatchStrategyEnum[keyof typeof MatchStrategyEnum];
export const RoleEnum1 = { SESSION: "session", REFRESH: "refresh", CUSTOM: "custom" } as const;
export type RoleEnum1 = typeof RoleEnum1[keyof typeof RoleEnum1];
export const ChainStepStatus = { PENDING: "pending", RUNNING: "running", DONE: "done", ERROR: "error", SKIPPED: "skipped" } as const;
export type ChainStepStatus = typeof ChainStepStatus[keyof typeof ChainStepStatus];
export const StepLinkSlotEnum = { ONSUCCESSPROJECTID: "OnSuccessProjectId", ONFAILUREPROJECTID: "OnFailureProjectId" } as const;
export type StepLinkSlotEnum = typeof StepLinkSlotEnum[keyof typeof StepLinkSlotEnum];
export const SourceEnum2 = { OPTIONS: "options", CONTROLLER: "controller" } as const;
export type SourceEnum2 = typeof SourceEnum2[keyof typeof SourceEnum2];
export const Status1 = { SUCCESS: "success", ERROR: "error", SKIPPED: "skipped" } as const;
export type Status1 = typeof Status1[keyof typeof Status1];
export const StageEnum = { SQLJS: "sqljs", STORAGE_READ: "storage-read", STORAGE_WRITE: "storage-write", OTHER: "other" } as const;
export type StageEnum = typeof StageEnum[keyof typeof StageEnum];
export const StepGroupViewEnum = { TREE: "tree", LIST: "list" } as const;
export type StepGroupViewEnum = typeof StepGroupViewEnum[keyof typeof StepGroupViewEnum];
export const Enum_31dd676d = { BACK: "back", FORWARD: "forward" } as const;
export type Enum_31dd676d = typeof Enum_31dd676d[keyof typeof Enum_31dd676d];
export const OriginEnum = { AUTHOR: "AUTHOR", USER: "USER" } as const;
export type OriginEnum = typeof OriginEnum[keyof typeof OriginEnum];
export const WorldEnum1 = { USER_SCRIPT: "USER_SCRIPT", MAIN: "MAIN" } as const;
export type WorldEnum1 = typeof WorldEnum1[keyof typeof WorldEnum1];
export const RunAtEnum1 = { DOCUMENT_START: "document_start", DOCUMENT_END: "document_end", DOCUMENT_IDLE: "document_idle" } as const;
export type RunAtEnum1 = typeof RunAtEnum1[keyof typeof RunAtEnum1];
export const TargetEnum = { EXTENSION: "extension", PREVIEW: "preview" } as const;
export type TargetEnum = typeof TargetEnum[keyof typeof TargetEnum];
export const InjectionLaunchSourceEnum = { MANUAL: "manual", PASSIVE: "passive" } as const;
export type InjectionLaunchSourceEnum = typeof InjectionLaunchSourceEnum[keyof typeof InjectionLaunchSourceEnum];
export const SkipReasonEnum1 = { DISABLED: "disabled", MISSING: "missing", RESOLVER_MISMATCH: "resolver_mismatch", EMPTY_CODE: "empty_code" } as const;
export type SkipReasonEnum1 = typeof SkipReasonEnum1[keyof typeof SkipReasonEnum1];
export const InlineSyntaxFlagSourceEnum = { WIRE: "wire", LEGACY_DEFAULT: "legacy-default" } as const;
export type InlineSyntaxFlagSourceEnum = typeof InlineSyntaxFlagSourceEnum[keyof typeof InlineSyntaxFlagSourceEnum];
export const Status3 = { VALID: "valid", EXPIRING: "expiring", EXPIRED: "expired", MISSING: "missing" } as const;
export type Status3 = typeof Status3[keyof typeof Status3];
export const Status4 = { LOADED: "loaded", DEFAULTS: "defaults", FAILED: "failed" } as const;
export type Status4 = typeof Status4[keyof typeof Status4];
export const ConnectionEnum = { ONLINE: "online", OFFLINE: "offline", DEGRADED: "degraded" } as const;
export type ConnectionEnum = typeof ConnectionEnum[keyof typeof ConnectionEnum];
export const LoggingMode = { SQLITE: "sqlite", FALLBACK: "fallback" } as const;
export type LoggingMode = typeof LoggingMode[keyof typeof LoggingMode];
export const MimeKindEnum = { CSV: "csv", JSON: "json" } as const;
export type MimeKindEnum = typeof MimeKindEnum[keyof typeof MimeKindEnum];
export const FormatEnum = { MARKDOWN: "markdown", PRISMA: "prisma", BOTH: "both", META: "meta" } as const;
export type FormatEnum = typeof FormatEnum[keyof typeof FormatEnum];
export const SurfaceEnum = { SYNC: "sync", KV: "kv", FILES: "files", GKV: "gkv" } as const;
export type SurfaceEnum = typeof SurfaceEnum[keyof typeof SurfaceEnum];
export const MatchType = { GLOB: "glob", REGEX: "regex", EXACT: "exact", PREFIX: "prefix" } as const;
export type MatchType = typeof MatchType[keyof typeof MatchType];
export const LogLevelEnum = { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error" } as const;
export type LogLevelEnum = typeof LogLevelEnum[keyof typeof LogLevelEnum];
export const MatchType1 = { GLOB: "glob", EXACT: "exact", REGEX: "regex" } as const;
export type MatchType1 = typeof MatchType1[keyof typeof MatchType1];
export const RoleEnum2 = { SESSION: "session", REFRESH: "refresh", OTHER: "other" } as const;
export type RoleEnum2 = typeof RoleEnum2[keyof typeof RoleEnum2];
export const InjectionMethodEnum = { GLOBAL: "global", MESSAGE: "message" } as const;
export type InjectionMethodEnum = typeof InjectionMethodEnum[keyof typeof InjectionMethodEnum];
export const DEFAULTREMIXNEXTVCASINGEnum = { PRESERVE: "preserve", UPPER: "upper", LOWER: "lower" } as const;
export type DEFAULTREMIXNEXTVCASINGEnum = typeof DEFAULTREMIXNEXTVCASINGEnum[keyof typeof DEFAULTREMIXNEXTVCASINGEnum];
export const GitsyncStatus = { FOUND: "found", NOT_LINKED: "not_linked", ERROR: "error" } as const;
export type GitsyncStatus = typeof GitsyncStatus[keyof typeof GitsyncStatus];
export const SourceEnum3 = { BRIDGE: "bridge", LOCALSTORAGE: "localStorage", NONE: "none" } as const;
export type SourceEnum3 = typeof SourceEnum3[keyof typeof SourceEnum3];
export const BridgeOutcomeEnum = { HIT: "hit", TIMEOUT: "timeout", ERROR: "error", SKIPPED: "skipped" } as const;
export type BridgeOutcomeEnum = typeof BridgeOutcomeEnum[keyof typeof BridgeOutcomeEnum];
export const LogLevelEnum1 = { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error", SUCCESS: "success", DELEGATE: "delegate", CHECK: "check", SKIP: "skip", SUB: "sub", INFO: "INFO", ERROR: "ERROR", WARN: "WARN", DEBUG: "DEBUG", SUB: "SUB" } as const;
export type LogLevelEnum1 = typeof LogLevelEnum1[keyof typeof LogLevelEnum1];
export const SourceEnum4 = { API: "api", CACHE: "cache", DOM: "dom", NONE: "none" } as const;
export type SourceEnum4 = typeof SourceEnum4[keyof typeof SourceEnum4];
export const Mode = { MANUAL: "manual", NEXT: "next" } as const;
export type Mode = typeof Mode[keyof typeof Mode];
export const KeyEnum = { EXPIRYGRACEPERIODDAYS: "expiryGracePeriodDays", REFILLWARNINGTHRESHOLDDAYS: "refillWarningThresholdDays" } as const;
export type KeyEnum = typeof KeyEnum[keyof typeof KeyEnum];
export const SourceEnum5 = { HISTORY: "history", POPSTATE: "popstate" } as const;
export type SourceEnum5 = typeof SourceEnum5[keyof typeof SourceEnum5];
export const IdempotentResultEnum = { PROCEED: "proceed", ABORT: "abort" } as const;
export type IdempotentResultEnum = typeof IdempotentResultEnum[keyof typeof IdempotentResultEnum];
export const Status5 = { OK: "ok", WARN: "warn", ERROR: "error", PENDING: "pending" } as const;
export type Status5 = typeof Status5[keyof typeof Status5];
export const LevelEnum4 = { INFO: "info", SUCCESS: "success", WARN: "warn", ERROR: "error" } as const;
export type LevelEnum4 = typeof LevelEnum4[keyof typeof LevelEnum4];
export const Status6 = { PENDING: "pending", PROCESSING: "processing", COMPLETED: "completed", FAILED: "failed", HOLD: "hold" } as const;
export type Status6 = typeof Status6[keyof typeof Status6];
export const WorkspaceDisplayKindEnum = { CANCELED: "canceled", EXPIRED: "expired", EXPIRED_HARD: "expired-hard", EXPIRE_SOON: "expire-soon", PAST_DUE_EXPIRING: "past-due-expiring", REFILL_SOON: "refill-soon", NORMAL: "normal" } as const;
export type WorkspaceDisplayKindEnum = typeof WorkspaceDisplayKindEnum[keyof typeof WorkspaceDisplayKindEnum];
export const WorkspaceDisplayToneEnum = { MUTED: "muted", DANGER: "danger", WARNING: "warning", ORANGE: "orange", INFO: "info", NONE: "none" } as const;
export type WorkspaceDisplayToneEnum = typeof WorkspaceDisplayToneEnum[keyof typeof WorkspaceDisplayToneEnum];
export const WorkspaceStatusKind = { FULLY_EXPIRED: "fully-expired", EXPIRED_CANCELED: "expired-canceled", EXPIRED: "expired", ABOUT_TO_EXPIRE: "about-to-expire", PAST_DUE_EXPIRING: "past-due-expiring", ABOUT_TO_REFILL: "about-to-refill", NORMAL: "normal" } as const;
export type WorkspaceStatusKind = typeof WorkspaceStatusKind[keyof typeof WorkspaceStatusKind];
export const MemberRoleEnum = { MEMBER: "member", OWNER: "owner" } as const;
export type MemberRoleEnum = typeof MemberRoleEnum[keyof typeof MemberRoleEnum];
export const CreditSortMode = { NONE: "none", HIGH: "high", LOW: "low", PRO_HIGH: "pro-high", PRO_LOW: "pro-low" } as const;
export type CreditSortMode = typeof CreditSortMode[keyof typeof CreditSortMode];
export const PhaseEnum1 = { RECORDING: "Recording", PAUSED: "Paused" } as const;
export type PhaseEnum1 = typeof PhaseEnum1[keyof typeof PhaseEnum1];
export const VariantEnum2 = { SUCCESS: "success", ERROR: "error" } as const;
export type VariantEnum2 = typeof VariantEnum2[keyof typeof VariantEnum2];
export const VariantEnum3 = { SUCCESS: "success", ERROR: "error", INFO: "info" } as const;
export type VariantEnum3 = typeof VariantEnum3[keyof typeof VariantEnum3];
export const SkipReasonEnum2 = { DISABLED: "disabled", MISSING: "missing", RESOLVER_MISMATCH: "resolver_mismatch" } as const;
export type SkipReasonEnum2 = typeof SkipReasonEnum2[keyof typeof SkipReasonEnum2];
export const Enum_56e0146f = { CLOSE: "close", EXEC: "exec", EXPORT: "export", PREPARE: "prepare", RUN: "run" } as const;
export type Enum_56e0146f = typeof Enum_56e0146f[keyof typeof Enum_56e0146f];
export const Enum_83c400f = { BIND: "bind", FREE: "free", RUN: "run", STEP: "step" } as const;
export type Enum_83c400f = typeof Enum_83c400f[keyof typeof Enum_83c400f];
export const RoleEnum4 = { PLAN: "plan", NEXT: "next" } as const;
export type RoleEnum4 = typeof RoleEnum4[keyof typeof RoleEnum4];
export const Type6 = { MOUSEOVER: "mouseover", MOUSEOUT: "mouseout" } as const;
export type Type6 = typeof Type6[keyof typeof Type6];
export const SourceEnum8 = { BATCH: "batch", MANUAL: "manual" } as const;
export type SourceEnum8 = typeof SourceEnum8[keyof typeof SourceEnum8];
export const OutcomeEnum2 = { FETCHED: "fetched", THROTTLED: "throttled", FAILED: "failed" } as const;
export type OutcomeEnum2 = typeof OutcomeEnum2[keyof typeof OutcomeEnum2];
export const Enum_75c5b314 = { ID: "id", PLAN: "plan", TIER: "tier" } as const;
export type Enum_75c5b314 = typeof Enum_75c5b314[keyof typeof Enum_75c5b314];
export const ReasonEnum5 = { OK: "ok", NO_ID: "no-id", FREE_TIER: "free-tier", NON_ENRICHABLE_PLAN: "non-enrichable-plan", CACHE_FRESH: "cache-fresh" } as const;
export type ReasonEnum5 = typeof ReasonEnum5[keyof typeof ReasonEnum5];
export const CreditBalanceFetchSourceEnum = { AUTO: "auto", BATCH: "batch", MANUAL: "manual" } as const;
export type CreditBalanceFetchSourceEnum = typeof CreditBalanceFetchSourceEnum[keyof typeof CreditBalanceFetchSourceEnum];
export const ReasonEnum6 = { OK: "ok", FORCED: "forced", PER_WS_COOLDOWN: "per-ws-cooldown", INTER_WS_COOLDOWN: "inter-ws-cooldown" } as const;
export type ReasonEnum6 = typeof ReasonEnum6[keyof typeof ReasonEnum6];
export const Enum_76ebb585 = { AUTHERROR: "AuthError", HTTP4XX: "Http4xx", HTTP5XX: "Http5xx" } as const;
export type Enum_76ebb585 = typeof Enum_76ebb585[keyof typeof Enum_76ebb585];
export const CreditSummarySourceEnum = { INLINE: "Inline", CACHE: "Cache", TIMEOUT: "Timeout", MISSING: "Missing", PENDING: "Pending" } as const;
export type CreditSummarySourceEnum = typeof CreditSummarySourceEnum[keyof typeof CreditSummarySourceEnum];
export const ChatSubmitSourceEnum = { PASTE: "paste", REPEAT: "repeat", NEXT_CHIP: "next-chip", PLAN_CHIP: "plan-chip", MANUAL: "manual" } as const;
export type ChatSubmitSourceEnum = typeof ChatSubmitSourceEnum[keyof typeof ChatSubmitSourceEnum];
export const MethodEnum1 = { QUERY: "QUERY", SCHEMA: "SCHEMA" } as const;
export type MethodEnum1 = typeof MethodEnum1[keyof typeof MethodEnum1];
export const RuleZeroCodeEnum = { TEMPLATE: "template", MATCH: "match", NO_DECLARATION: "no-declaration", NO_STEPS: "no-steps", MISMATCH: "mismatch" } as const;
export type RuleZeroCodeEnum = typeof RuleZeroCodeEnum[keyof typeof RuleZeroCodeEnum];
export const BucketEnum = { SELECT: "SELECT", ALTER: "ALTER", WRITE: "WRITE" } as const;
export type BucketEnum = typeof BucketEnum[keyof typeof BucketEnum];
export const ErrorSeverityEnum = { FATAL: "fatal", ERROR: "error", WARN: "warn", INFO: "info" } as const;
export type ErrorSeverityEnum = typeof ErrorSeverityEnum[keyof typeof ErrorSeverityEnum];
export const ErrorAreaEnum = { PROMPT: "PROMPT", PROMPT_IO: "PROMPT_IO", SEED: "SEED", HEALTH: "HEALTH", REPAIR: "REPAIR", HISTORY: "HISTORY", DB: "DB", HTTP: "HTTP", SDK: "SDK", WS_MEMBERS: "WS_MEMBERS", WS_MOVE: "WS_MOVE", WS_CONTEXT: "WS_CONTEXT", REMIX: "REMIX", RENAME: "RENAME", GITSYNC: "GITSYNC", CREDIT: "CREDIT", PROZERO: "PROZERO", SETTINGS: "SETTINGS", SPLITTER: "SPLITTER", TELEMETRY: "TELEMETRY", UI: "UI", ASYNC: "ASYNC", LOOP: "LOOP", QUEUE: "QUEUE", TYPE: "TYPE" } as const;
export type ErrorAreaEnum = typeof ErrorAreaEnum[keyof typeof ErrorAreaEnum];
export const ToastLevelEnum = { ERROR: "error", WARN: "warn", INFO: "info" } as const;
export type ToastLevelEnum = typeof ToastLevelEnum[keyof typeof ToastLevelEnum];
export const GitsyncJobStatus = { PENDING: "pending", RUNNING: "running", COMPLETED: "completed", FAILED: "failed" } as const;
export type GitsyncJobStatus = typeof GitsyncJobStatus[keyof typeof GitsyncJobStatus];
export const ReasonEnum7 = { NO_JOB: "no_job", NO_REPO_URL: "no_repo_url", DEADLINE: "deadline", ERROR: "error" } as const;
export type ReasonEnum7 = typeof ReasonEnum7[keyof typeof ReasonEnum7];
export const ProjectLockReasonEnum = { API_423: "api-423", API_BODY_LOCKED: "api-body-locked", DOM_BANNER: "dom-banner" } as const;
export type ProjectLockReasonEnum = typeof ProjectLockReasonEnum[keyof typeof ProjectLockReasonEnum];
export const ReasonEnum8 = { LOOP_STOPPED: "loop-stopped", DOCUMENT_HIDDEN: "document-hidden", QUEUE_MISSING: "queue-missing", QUEUE_EMPTY: "queue-empty", ALREADY_RUNNING: "already-running", NO_RESUME_BUTTON: "no-resume-button", OK: "ok", THREW: "threw" } as const;
export type ReasonEnum8 = typeof ReasonEnum8[keyof typeof ReasonEnum8];
export const ReasonEnum9 = { OK: "ok", PAUSE_MISSING: "pause-missing", RESUME_MISSING: "resume-missing" } as const;
export type ReasonEnum9 = typeof ReasonEnum9[keyof typeof ReasonEnum9];
export const StrategyEnum = { PRIMARY_XPATH: "primary-xpath", FALLBACK_HEADER_WALK: "fallback-header-walk", FALLBACK_ARIA_WALK: "fallback-aria-walk", NONE: "none" } as const;
export type StrategyEnum = typeof StrategyEnum[keyof typeof StrategyEnum];
export const Status9 = { PENDING: "pending", ACTIVE: "active", DONE: "done", FAILED: "failed" } as const;
export type Status9 = typeof Status9[keyof typeof Status9];
export const CodeEnum1 = { QUERY_FAILED: "query-failed", ROW_MISSING: "row-missing", NOT_FLAGGED_DEFAULT: "not-flagged-default", NAME_EMPTY: "name-empty", BODY_EMPTY: "body-empty", MISSING_REQUIRED_TOKEN: "missing-required-token", REPLACE_KEY_INVALID: "replace-key-invalid", REPLACE_VALUES_INVALID: "replace-values-invalid" } as const;
export type CodeEnum1 = typeof CodeEnum1[keyof typeof CodeEnum1];
export const OutcomeEnum3 = { ADOPTED: "adopted", SKIPPED_LOOKUP_FAILED: "skipped-lookup-failed", SKIPPED_MISSING: "skipped-missing", SKIPPED_ROLE_OK: "skipped-role-ok", FAILED_UPSERT: "failed-upsert" } as const;
export type OutcomeEnum3 = typeof OutcomeEnum3[keyof typeof OutcomeEnum3];
export const Mode4 = { IDEMPOTENT: "idempotent", FORCE: "force" } as const;
export type Mode4 = typeof Mode4[keyof typeof Mode4];
export const SeedStageStatus = { OK: "ok", FAILED: "failed", SKIPPED: "skipped" } as const;
export type SeedStageStatus = typeof SeedStageStatus[keyof typeof SeedStageStatus];
export const StageEnum1 = { SCHEMA_INIT: "schema-init", LEGACY_READ_MEMORY_DEDUPE: "legacy-read-memory-dedupe", ORPHAN_REPAIR: "orphan-repair", SEED_PLAN_NEXT: "seed-plan-next", AUTO_REPAIR: "auto-repair", READ_MEMORY_DUPLICATE_VALIDATION: "read-memory-duplicate-validation" } as const;
export type StageEnum1 = typeof StageEnum1[keyof typeof StageEnum1];
export const PromptSeedEventNameEnum = { SEED_START: "seed.start", SEED_INSERT_OR_IGNORE: "seed.insert-or-ignore", SEED_LEGACY_UPGRADE: "seed.legacy-upgrade", SEED_LEGACY_UPGRADE_SKIP: "seed.legacy-upgrade-skip", SEED_PROMOTE_DEFAULT: "seed.promote-default", SEED_PROMOTE_DEFAULT_KEPT: "seed.promote-default-kept", SEED_COMPLETE: "seed.complete", SEED_FAILED: "seed.failed", SEED_AUDIT_SKIP: "seed.audit-skip", SEED_AUDIT_WRITE: "seed.audit-write", EDITOR_PREFILL_DB_HIT: "editor.prefill.db-hit", EDITOR_PREFILL_RESEED: "editor.prefill.reseed", EDITOR_PREFILL_DIRECT_INSERT: "editor.prefill.direct-insert", EDITOR_PREFILL_DIRECT_INSERT_FAILED: "editor.prefill.direct-insert-failed", EDITOR_PREFILL_STATIC_FALLBACK: "editor.prefill.static-fallback", EDITOR_PREFILL_MISSING: "editor.prefill.missing", EDITOR_PREFILL_DRIFT: "editor.prefill.drift", RESEED_START: "reseed.start", RESEED_FORCE: "reseed.force", RESEED_COMPLETE: "reseed.complete", HEALTH_DEFAULT_ISSUCCESS: "health.default.isSuccess", HEALTH_DEFAULT_MISSING: "health.default.missing", HEALTH_DEFAULT_SCHEMA_DRIFT: "health.default.schema-drift", HEALTH_AUTO_REPAIR_START: "health.auto-repair.start", HEALTH_AUTO_REPAIR_RECOVERED: "health.auto-repair.recovered", HEALTH_AUTO_REPAIR_FAILED: "health.auto-repair.failed" } as const;
export type PromptSeedEventNameEnum = typeof PromptSeedEventNameEnum[keyof typeof PromptSeedEventNameEnum];
export const RenameStrategyEnum = { NORMAL: "normal", NO_LIMIT: "no-limit", AUTH_RETRY: "auth-retry", RATE_RETRY: "rate-retry" } as const;
export type RenameStrategyEnum = typeof RenameStrategyEnum[keyof typeof RenameStrategyEnum];
export const KeyEnum1 = { DOLLAR: "dollar", HASH: "hash", STAR: "star" } as const;
export type KeyEnum1 = typeof KeyEnum1[keyof typeof KeyEnum1];
export const RejectionType = { THREW: "threw", REJECTED: "rejected" } as const;
export type RejectionType = typeof RejectionType[keyof typeof RejectionType];
export const LoadStageEnum = { INITIAL_LIST: "initial-list", AUTO_SEED: "auto-seed", POST_SEED_LIST: "post-seed-list" } as const;
export type LoadStageEnum = typeof LoadStageEnum[keyof typeof LoadStageEnum];
export const RoleEnum5 = { PLAN: "plan", NEXT: "next", GENERIC: "generic" } as const;
export type RoleEnum5 = typeof RoleEnum5[keyof typeof RoleEnum5];
export const CreditToneEnum = { OK: "ok", WARN: "warn", USED: "used", TOTAL: "total", MUTED: "muted", ACCENT: "accent" } as const;
export type CreditToneEnum = typeof CreditToneEnum[keyof typeof CreditToneEnum];
export const SortKeyEnum = { NAME: "name", PLAN: "plan", PROJECTS: "projects", USED: "used", REM: "rem", TOTAL: "total" } as const;
export type SortKeyEnum = typeof SortKeyEnum[keyof typeof SortKeyEnum];
export const SortDirEnum = { ASC: "asc", DESC: "desc", NONE: "none" } as const;
export type SortDirEnum = typeof SortDirEnum[keyof typeof SortDirEnum];
export const Enum_7dc824d7 = { EXACT: "exact", LIKE: "like" } as const;
export type Enum_7dc824d7 = typeof Enum_7dc824d7[keyof typeof Enum_7dc824d7];
export const JsonLogLevelEnum = { OK: "ok", ERR: "err", INFO: "info", WARN: "warn" } as const;
export type JsonLogLevelEnum = typeof JsonLogLevelEnum[keyof typeof JsonLogLevelEnum];
export const ActionEnum3 = { ADDCOLUMN: "addColumn", DROPCOLUMN: "dropColumn", RENAMECOLUMN: "renameColumn" } as const;
export type ActionEnum3 = typeof ActionEnum3[keyof typeof ActionEnum3];
export const Type7 = { STRING: "string", DATE: "date", REGEX: "regex" } as const;
export type Type7 = typeof Type7[keyof typeof Type7];
export const OnDeleteEnum1 = { CASCADE: "CASCADE", SET_NULL: "SET NULL", RESTRICT: "RESTRICT" } as const;
export type OnDeleteEnum1 = typeof OnDeleteEnum1[keyof typeof OnDeleteEnum1];
export const Type8 = { OK: "ok", ERR: "err" } as const;
export type Type8 = typeof Type8[keyof typeof Type8];
export const LevelEnum5 = { ERROR: "error", WARN: "warn" } as const;
export type LevelEnum5 = typeof LevelEnum5[keyof typeof LevelEnum5];
export const LovableIdleResultEnum = { IDLE: "idle", CANCELLED: "cancelled", TIMEOUT: "timeout" } as const;
export type LovableIdleResultEnum = typeof LovableIdleResultEnum[keyof typeof LovableIdleResultEnum];
export const ActiveQueueTabEnum = { ACTIVE: "active", HISTORY: "history", LIVE: "live" } as const;
export type ActiveQueueTabEnum = typeof ActiveQueueTabEnum[keyof typeof ActiveQueueTabEnum];
export const PromptsBundleFormatEnum = { JSON: "json", ZIP: "zip", SQLITE: "sqlite" } as const;
export type PromptsBundleFormatEnum = typeof PromptsBundleFormatEnum[keyof typeof PromptsBundleFormatEnum];
export const Enum_190b59f6 = { ID: "id", SAVEDAT: "savedAt" } as const;
export type Enum_190b59f6 = typeof Enum_190b59f6[keyof typeof Enum_190b59f6];
export const SlugPositionSourceEnum = { DEFAULT: "default", MIGRATED: "migrated", DRAG: "drag" } as const;
export type SlugPositionSourceEnum = typeof SlugPositionSourceEnum[keyof typeof SlugPositionSourceEnum];
export const SourceEnum9 = { LOCALSTORAGE: "localStorage", DEFAULT: "default" } as const;
export type SourceEnum9 = typeof SourceEnum9[keyof typeof SourceEnum9];
export const HistorySortKeyEnum = { DATE: "date", REASON: "reason" } as const;
export type HistorySortKeyEnum = typeof HistorySortKeyEnum[keyof typeof HistorySortKeyEnum];
export const HistoryImportedFilterEnum = { ALL: "all", ONLY: "only", EXCLUDE: "exclude" } as const;
export type HistoryImportedFilterEnum = typeof HistoryImportedFilterEnum[keyof typeof HistoryImportedFilterEnum];
export const ImportAuditRowActionEnum = { ADD: "add", OVERWRITE: "overwrite", SKIP: "skip", RENAME: "rename" } as const;
export type ImportAuditRowActionEnum = typeof ImportAuditRowActionEnum[keyof typeof ImportAuditRowActionEnum];
export const ImportAuditStatus = { IN_PROGRESS: "in_progress", COMMITTED: "committed", ROLLED_BACK: "rolled_back" } as const;
export type ImportAuditStatus = typeof ImportAuditStatus[keyof typeof ImportAuditStatus];
export const ImportErrorCodeEnum = { PARSE_INVALID_JSON: "PARSE_INVALID_JSON", PARSE_ZIP_CORRUPT: "PARSE_ZIP_CORRUPT", PARSE_SQLITE_INVALID: "PARSE_SQLITE_INVALID", PARSE_UNKNOWN_FORMAT: "PARSE_UNKNOWN_FORMAT", PARSE_SCHEMA_MISMATCH: "PARSE_SCHEMA_MISMATCH", PARSE_EMPTY_BUNDLE: "PARSE_EMPTY_BUNDLE", COMMIT_QUOTA_EXCEEDED: "COMMIT_QUOTA_EXCEEDED", COMMIT_IDB_UNAVAILABLE: "COMMIT_IDB_UNAVAILABLE", COMMIT_TRANSACTION_ABORTED: "COMMIT_TRANSACTION_ABORTED", COMMIT_DOUBLE_FAULT: "COMMIT_DOUBLE_FAULT", COMMIT_UNKNOWN: "COMMIT_UNKNOWN" } as const;
export type ImportErrorCodeEnum = typeof ImportErrorCodeEnum[keyof typeof ImportErrorCodeEnum];
export const PhaseEnum2 = { PARSE: "parse", COMMIT: "commit" } as const;
export type PhaseEnum2 = typeof PhaseEnum2[keyof typeof PhaseEnum2];
export const StageEnum2 = { IDLE: "idle", PARSING: "parsing", PREVIEW: "preview", COMMITTING: "committing", DONE: "done", ERROR: "error" } as const;
export type StageEnum2 = typeof StageEnum2[keyof typeof StageEnum2];
export const ConflictEnum = { NEW: "new", UPDATE: "update", IDENTICAL: "identical", DUPLICATE: "duplicate" } as const;
export type ConflictEnum = typeof ConflictEnum[keyof typeof ConflictEnum];
export const VariantEnum4 = { PRIMARY: "primary", GHOST: "ghost" } as const;
export type VariantEnum4 = typeof VariantEnum4[keyof typeof VariantEnum4];
export const RuleEnum = { RULE_ZERO: "rule-zero", TOKEN_DRIFT: "token-drift", UPSTREAM: "upstream" } as const;
export type RuleEnum = typeof RuleEnum[keyof typeof RuleEnum];
export const PhaseEnum3 = { ENTRIES: "entries", REVISIONS: "revisions", DONE: "done" } as const;
export type PhaseEnum3 = typeof PhaseEnum3[keyof typeof PhaseEnum3];
export const OriginEnum2 = { CLICK: "click", DROP: "drop" } as const;
export type OriginEnum2 = typeof OriginEnum2[keyof typeof OriginEnum2];
export const SourceEnum10 = { PARSE: "parse", ENTRY: "entry" } as const;
export type SourceEnum10 = typeof SourceEnum10[keyof typeof SourceEnum10];
export const ViolationKindEnum = { OK: "ok", OUT_OF_ORDER: "out-of-order", UNKNOWN: "unknown", MISSING: "missing" } as const;
export type ViolationKindEnum = typeof ViolationKindEnum[keyof typeof ViolationKindEnum];
export const PasteOutcomeEnum = { INJECTED: "injected", CLIPBOARD: "clipboard", FAILED: "failed", CANCELLED: "cancelled" } as const;
export type PasteOutcomeEnum = typeof PasteOutcomeEnum[keyof typeof PasteOutcomeEnum];
export const CaptureSourceEnum = { PASTE: "paste", NEXT_CHIP: "next-chip", PLAN_CHIP: "plan-chip" } as const;
export type CaptureSourceEnum = typeof CaptureSourceEnum[keyof typeof CaptureSourceEnum];
export const RepeatPhaseEnum = { IDLE: "idle", SUBMITTING: "submitting", WAITING_COMPLETION: "waiting-completion", WAITING_DELAY: "waiting-delay" } as const;
export type RepeatPhaseEnum = typeof RepeatPhaseEnum[keyof typeof RepeatPhaseEnum];
export const DisplayValueEnum = { FLEX: "flex", INLINE_FLEX: "inline-flex" } as const;
export type DisplayValueEnum = typeof DisplayValueEnum[keyof typeof DisplayValueEnum];
export const ListType = { UL: "ul", OL: "ol" } as const;
export type ListType = typeof ListType[keyof typeof ListType];
export const KindEnum6 = { GRACE: "grace", REFILL: "refill" } as const;
export type KindEnum6 = typeof KindEnum6[keyof typeof KindEnum6];
export const TaskNextPromptSourceEnum = { QUEUE: "queue", LEGACY: "legacy" } as const;
export type TaskNextPromptSourceEnum = typeof TaskNextPromptSourceEnum[keyof typeof TaskNextPromptSourceEnum];
export const Enum_3c41a5e1 = { REPLACEKEY: "replaceKey", TEXT: "text" } as const;
export type Enum_3c41a5e1 = typeof Enum_3c41a5e1[keyof typeof Enum_3c41a5e1];
export const CycleStatus = { OK: "ok", PASTE_FAILED: "paste-failed", SUBMIT_FAILED: "submit-failed", IDLE_CANCELLED: "idle-cancelled", IDLE_TIMEOUT: "idle-timeout", CANCELLED: "cancelled", QUEUE_EMPTY: "queue-empty" } as const;
export type CycleStatus = typeof CycleStatus[keyof typeof CycleStatus];
export const SplitterParseReasonEnum = { JSONMISSING: "JsonMissing", JSONPARSEFAILED: "JsonParseFailed", SUBTASKSMISSING: "SubtasksMissing", WRONGLENGTH: "WrongLength", SUBTASKINVALID: "SubtaskInvalid" } as const;
export type SplitterParseReasonEnum = typeof SplitterParseReasonEnum[keyof typeof SplitterParseReasonEnum];
export const Enum_e15ad38 = { NAME: "name", PARENTSLUG: "parentSlug", REPLACEKEY: "replaceKey", SLUG: "slug", TEXT: "text", VARIANTVALUE: "variantValue" } as const;
export type Enum_e15ad38 = typeof Enum_e15ad38[keyof typeof Enum_e15ad38];
export const PlanPromptSourceEnum = { DB_DEFAULT: "db-default", WINDOW_CONFIG: "window-config", PREAMBLE_PROMPTS: "preamble-prompts", DEFAULT_PROMPTS: "default-prompts", PARENT_SLUG_VARIANT: "parent-slug-variant", SLUG_VARIANT: "slug-variant", NOT_FOUND: "not-found" } as const;
export type PlanPromptSourceEnum = typeof PlanPromptSourceEnum[keyof typeof PlanPromptSourceEnum];
export const StepEnum = { UNHIDDEN: "unhidden", CHILD_ADDED: "child-added" } as const;
export type StepEnum = typeof StepEnum[keyof typeof StepEnum];
export const IdEnum = { MARCO_SAVE_PROMPT_BTN: "marco-save-prompt-btn", MARCO_CHATBOX_PROMPTS_BTN: "marco-chatbox-prompts-btn" } as const;
export type IdEnum = typeof IdEnum[keyof typeof IdEnum];
export const SummaryPillKindEnum = { PRO: "pro", PROCREDITS: "proCredits", FREECREDITS: "freeCredits" } as const;
export type SummaryPillKindEnum = typeof SummaryPillKindEnum[keyof typeof SummaryPillKindEnum];















































































































































