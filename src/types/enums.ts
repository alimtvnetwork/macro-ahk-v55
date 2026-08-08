// Auto-generated enums
export const Status = { AUTHENTICATED: "authenticated", DEGRADED: "degraded", UNAUTHENTICATED: "unauthenticated" } as const;
export type Status = typeof Status[keyof typeof Status];
export const WorldEnum = { MAIN: "MAIN", ISOLATED: "ISOLATED" } as const;
export type WorldEnum = typeof WorldEnum[keyof typeof WorldEnum];
export const SkipReasonEnum = { AUTOATTACH_SKIPPED_AUTOSTART_OFF: "AUTOATTACH_SKIPPED_AUTOSTART_OFF", AUTOATTACH_SKIPPED_OPT_OUT: "AUTOATTACH_SKIPPED_OPT_OUT", AUTOATTACH_SKIPPED_URL_NO_MATCH: "AUTOATTACH_SKIPPED_URL_NO_MATCH", AUTOATTACH_ALREADY_ATTACHED: "AUTOATTACH_ALREADY_ATTACHED", AUTOATTACH_SKIPPED_INCOMPATIBLE_RUN_CONTEXT: "AUTOATTACH_SKIPPED_INCOMPATIBLE_RUN_CONTEXT", AUTOATTACH_SKIPPED_COOKIE_BINDING_MISSING: "AUTOATTACH_SKIPPED_COOKIE_BINDING_MISSING", AUTOATTACH_SKIPPED_DEP_MISSING: "AUTOATTACH_SKIPPED_DEP_MISSING", AUTOATTACH_SKIPPED_CONDITION_FAIL: "AUTOATTACH_SKIPPED_CONDITION_FAIL" } as const;
export type SkipReasonEnum = typeof SkipReasonEnum[keyof typeof SkipReasonEnum];
export const TriggerEnum = { LOAD: "load", REFRESH: "refresh", ACTIVATE: "activate" } as const;
export type TriggerEnum = typeof TriggerEnum[keyof typeof TriggerEnum];
export const BootPersistenceMode = { OPFS: "opfs", STORAGE: "storage", MEMORY: "memory" } as const;
export type BootPersistenceMode = typeof BootPersistenceMode[keyof typeof BootPersistenceMode];
export const RunAtEnum = { DOCUMENT_START: "document_start", DOCUMENT_IDLE: "document_idle" } as const;
export type RunAtEnum = typeof RunAtEnum[keyof typeof RunAtEnum];
export const DomTargetEnum = { BODY: "body", DOCUMENTELEMENT: "documentElement", UNKNOWN: "unknown" } as const;
export type DomTargetEnum = typeof DomTargetEnum[keyof typeof DomTargetEnum];
export const ToastActionEnum = { ACCEPT: "accept", DISMISS_TAB: "dismiss-tab", DISMISS_PERSIST: "dismiss-persist" } as const;
export type ToastActionEnum = typeof ToastActionEnum[keyof typeof ToastActionEnum];
export const Enum_24dffcd9 = { CRITICAL: "critical", OK: "ok", WARNING: "warning" } as const;
export type Enum_24dffcd9 = typeof Enum_24dffcd9[keyof typeof Enum_24dffcd9];
export const Enum_2183c564 = { DEGRADED: "degraded", ERROR: "error", OK: "ok" } as const;
export type Enum_2183c564 = typeof Enum_2183c564[keyof typeof Enum_2183c564];
export const CacheCategoryEnum = { SCRIPTS: "scripts", CONFIGS: "configs", PROJECTS: "projects", SCRIPT_CODE: "script_code", NAMESPACE: "namespace", SETTINGS: "settings" } as const;
export type CacheCategoryEnum = typeof CacheCategoryEnum[keyof typeof CacheCategoryEnum];
export const RoleEnum = { GLOBAL_DEP: "global-dep", EXPLICIT_DEP: "explicit-dep", TARGET: "target" } as const;
export type RoleEnum = typeof RoleEnum[keyof typeof RoleEnum];
export const LevelEnum = { INFO: "INFO", WARN: "WARN" } as const;
export type LevelEnum = typeof LevelEnum[keyof typeof LevelEnum];
export const LevelEnum1 = { LOG: "log", WARN: "warn", ERROR: "error" } as const;
export type LevelEnum1 = typeof LevelEnum1[keyof typeof LevelEnum1];
export const LevelEnum2 = { LOG: "log", WARN: "warn", ERROR: "error", __GROUP__: "__group__", __GROUPEND__: "__groupEnd__" } as const;
export type LevelEnum2 = typeof LevelEnum2[keyof typeof LevelEnum2];
export const SortOrder = { ASC: "asc", DESC: "desc" } as const;
export type SortOrder = typeof SortOrder[keyof typeof SortOrder];
export const Type = { TEXT: "TEXT", INTEGER: "INTEGER", REAL: "REAL", BLOB: "BLOB", BOOLEAN: "BOOLEAN" } as const;
export type Type = typeof Type[keyof typeof Type];
export const MergeStrategyEnum = { DEEP: "deep", REPLACE: "replace" } as const;
export type MergeStrategyEnum = typeof MergeStrategyEnum[keyof typeof MergeStrategyEnum];
export const SourceEnum = { REMOTE: "remote", LOCAL: "local", HARDCODED: "hardcoded" } as const;
export type SourceEnum = typeof SourceEnum[keyof typeof SourceEnum];
export const Type1 = { STRING: "string", NUMBER: "number", DATE: "date", REGEX: "regex", ENUM: "enum" } as const;
export type Type1 = typeof Type1[keyof typeof Type1];
export const OnDeleteEnum = { CASCADE: "CASCADE", SET_NULL: "SET NULL", NO_ACTION: "NO ACTION", RESTRICT: "RESTRICT" } as const;
export type OnDeleteEnum = typeof OnDeleteEnum[keyof typeof OnDeleteEnum];
export const ScriptCodeSourceEnum = { CACHE: "cache", FETCH: "fetch", EMBEDDED: "embedded" } as const;
export type ScriptCodeSourceEnum = typeof ScriptCodeSourceEnum[keyof typeof ScriptCodeSourceEnum];
export const SourceEnum1 = { ACTIVE_PROJECT: "active-project", NONE: "none" } as const;
export type SourceEnum1 = typeof SourceEnum1[keyof typeof SourceEnum1];
export const PhaseEnum = { IDLE: "Idle", RECORDING: "Recording", PAUSED: "Paused" } as const;
export type PhaseEnum = typeof PhaseEnum[keyof typeof PhaseEnum];
export const HealthState = { HEALTHY: "HEALTHY", DEGRADED: "DEGRADED", ERROR: "ERROR", FATAL: "FATAL" } as const;
export type HealthState = typeof HealthState[keyof typeof HealthState];
export const BranchEnum = { EMPTY: "empty", ABOUT_BLANK: "about-blank", PREFIX: "prefix", ALLOWED: "allowed" } as const;
export type BranchEnum = typeof BranchEnum[keyof typeof BranchEnum];
export const LevelEnum3 = { INFO: "info", SUCCESS: "success", WARNING: "warning", ERROR: "error" } as const;
export type LevelEnum3 = typeof LevelEnum3[keyof typeof LevelEnum3];
export const Type2 = { ELEMENT_EXISTS: "element_exists", ELEMENT_ABSENT: "element_absent", KV_EQUALS: "kv_equals", KV_EXISTS: "kv_exists" } as const;
export type Type2 = typeof Type2[keyof typeof Type2];
export const TriggerType = { MANUAL: "manual", ON_PAGE_LOAD: "on_page_load", ON_ELEMENT: "on_element", INTERVAL: "interval", CRON: "cron" } as const;
export type TriggerType = typeof TriggerType[keyof typeof TriggerType];
export const ChainRunnerStatus = { IDLE: "idle", RUNNING: "running", PAUSED: "paused", COMPLETED: "completed", ERROR: "error", CANCELLED: "cancelled" } as const;
export type ChainRunnerStatus = typeof ChainRunnerStatus[keyof typeof ChainRunnerStatus];
export const BranchLabelEnum = { THEN: "then", ELSE: "else" } as const;
export type BranchLabelEnum = typeof BranchLabelEnum[keyof typeof BranchLabelEnum];
export const KindEnum1 = { CLICK: "click", ROUTE: "route", KEY: "key", MOUNT: "mount" } as const;
export type KindEnum1 = typeof KindEnum1[keyof typeof KindEnum1];
export const LabelEnum = { PROJECTS: "Projects", SCRIPTS: "Scripts", CONFIGS: "Configs" } as const;
export type LabelEnum = typeof LabelEnum[keyof typeof LabelEnum];
export const SequencePreviewIssueEnum = { EMPTY: "empty", TOO_LONG: "too-long", DUPLICATE: "duplicate", COLLISION: "collision" } as const;
export type SequencePreviewIssueEnum = typeof SequencePreviewIssueEnum[keyof typeof SequencePreviewIssueEnum];
export const ChainShortcutActionEnum = { RUN: "run", STOP: "stop" } as const;
export type ChainShortcutActionEnum = typeof ChainShortcutActionEnum[keyof typeof ChainShortcutActionEnum];
export const Type3 = { KEYDOWN: "keydown", KEYUP: "keyup" } as const;
export type Type3 = typeof Type3[keyof typeof Type3];
export const ComboInvalidReasonEnum = { EMPTY: "Empty", MODIFIERSONLY: "ModifiersOnly", UNKNOWNKEY: "UnknownKey", MULTIPLEKEYS: "MultipleKeys" } as const;
export type ComboInvalidReasonEnum = typeof ComboInvalidReasonEnum[keyof typeof ComboInvalidReasonEnum];
export const WaitInvalidReasonEnum = { EMPTY: "Empty", NOTANUMBER: "NotANumber", NEGATIVE: "Negative", NOTFINITE: "NotFinite", TOOLARGE: "TooLarge" } as const;
export type WaitInvalidReasonEnum = typeof WaitInvalidReasonEnum[keyof typeof WaitInvalidReasonEnum];
export const KeywordEventsExportStageEnum = { DISCOVERY: "discovery", SQLITE_BUILD: "sqlite-build", ZIP_BUNDLE: "zip-bundle", DOWNLOAD: "download", DONE: "done" } as const;
export type KeywordEventsExportStageEnum = typeof KeywordEventsExportStageEnum[keyof typeof KeywordEventsExportStageEnum];
export const MatchedByEnum = { UID: "uid", KEYWORD: "keyword" } as const;
export type MatchedByEnum = typeof MatchedByEnum[keyof typeof MatchedByEnum];
export const BaseEnum = { VS: "vs", VS_DARK: "vs-dark", HC_BLACK: "hc-black" } as const;
export type BaseEnum = typeof BaseEnum[keyof typeof BaseEnum];
export const RecorderSyncTransportEnum = { CHROME_STORAGE: "chrome.storage", LOCALSTORAGE: "localStorage", MEMORY: "memory" } as const;
export type RecorderSyncTransportEnum = typeof RecorderSyncTransportEnum[keyof typeof RecorderSyncTransportEnum];
export const BundleMode = { FULL: "full", PROMPTS_ONLY: "prompts-only" } as const;
export type BundleMode = typeof BundleMode[keyof typeof BundleMode];
export const CodeEnum = { MISSING_TABLE: "MISSING_TABLE", UNKNOWN_TABLE: "UNKNOWN_TABLE", MISSING_COLUMN: "MISSING_COLUMN", UNKNOWN_COLUMN: "UNKNOWN_COLUMN", NON_PASCAL_TABLE: "NON_PASCAL_TABLE", NON_PASCAL_COLUMN: "NON_PASCAL_COLUMN", LEGACY_SNAKE_CASE: "LEGACY_SNAKE_CASE", MISSING_FORMAT_VERSION: "MISSING_FORMAT_VERSION", UNSUPPORTED_FORMAT_VERSION: "UNSUPPORTED_FORMAT_VERSION", READ_ERROR: "READ_ERROR" } as const;
export type CodeEnum = typeof CodeEnum[keyof typeof CodeEnum];
export const Status2 = { NEW: "new", OVERWRITE: "overwrite" } as const;
export type Status2 = typeof Status2[keyof typeof Status2];
export const RequireStatus = { LOADED: "loaded", DENIED: "denied", ERROR: "error", NOT_FOUND: "not_found" } as const;
export type RequireStatus = typeof RequireStatus[keyof typeof RequireStatus];
export const AssetType = { PROMPT: "prompt", SCRIPT: "script", CHAIN: "chain", PRESET: "preset" } as const;
export type AssetType = typeof AssetType[keyof typeof AssetType];
export const ActionEnum = { CREATED: "created", IDENTICAL: "identical", CONFLICT: "conflict" } as const;
export type ActionEnum = typeof ActionEnum[keyof typeof ActionEnum];
export const ProbeFailureReasonEnum = { NOTABID: "NoTabId", NORECEIVER: "NoReceiver", EMPTYRESPONSE: "EmptyResponse", PROBEFAILED: "ProbeFailed", EXCEPTION: "Exception" } as const;
export type ProbeFailureReasonEnum = typeof ProbeFailureReasonEnum[keyof typeof ProbeFailureReasonEnum];
export const OriginEnum1 = { INJECTION_RECORD: "injection-record", EVALUATED: "evaluated" } as const;
export type OriginEnum1 = typeof OriginEnum1[keyof typeof OriginEnum1];
export const BindingSourceEnum = { INJECTION: "injection", PROBE: "probe", NONE: "none" } as const;
export type BindingSourceEnum = typeof BindingSourceEnum[keyof typeof BindingSourceEnum];
export const RawSqlKindEnum = { READ: "read", WRITE: "write", SCHEMA: "schema", TRANSACTION: "transaction" } as const;
export type RawSqlKindEnum = typeof RawSqlKindEnum[keyof typeof RawSqlKindEnum];
export const ThemeEnum = { SYSTEM: "system", LIGHT: "light", DARK: "dark" } as const;
export type ThemeEnum = typeof ThemeEnum[keyof typeof ThemeEnum];
export const AccessDeniedCodeEnum = { RESPECTIVE_HOST_PERMISSION: "RESPECTIVE_HOST_PERMISSION", MISSING_HOST_PERMISSION: "MISSING_HOST_PERMISSION", PAGE_CONTENTS_BLOCKED: "PAGE_CONTENTS_BLOCKED", EXTENSIONS_GALLERY_BLOCKED: "EXTENSIONS_GALLERY_BLOCKED", RESTRICTED_SCHEME: "RESTRICTED_SCHEME", NO_HOST_PATTERN: "NO_HOST_PATTERN", PERMISSION_NOT_GRANTED: "PERMISSION_NOT_GRANTED", GENERIC_CANNOT_SCRIPT: "GENERIC_CANNOT_SCRIPT", UNKNOWN: "UNKNOWN" } as const;
export type AccessDeniedCodeEnum = typeof AccessDeniedCodeEnum[keyof typeof AccessDeniedCodeEnum];
export const Type4 = { DOWNLOAD: "Download", EXECUTE: "Execute", UPDATE: "Update", VALIDATE: "Validate" } as const;
export type Type4 = typeof Type4[keyof typeof Type4];
export const ResourceType = { SCRIPT: "Script", BINARY: "Binary", CHROMEEXTENSION: "ChromeExtension" } as const;
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];
export const Status7 = { PASS: "pass", FAIL: "fail", FALLBACK: "fallback" } as const;
export type Status7 = typeof Status7[keyof typeof Status7];
export const SelectorKindEnum = { AUTO: "Auto", XPATH: "XPath", CSS: "Css" } as const;
export type SelectorKindEnum = typeof SelectorKindEnum[keyof typeof SelectorKindEnum];
export const OpEnum = { EQ: "eq", GTE: "gte", LTE: "lte" } as const;
export type OpEnum = typeof OpEnum[keyof typeof OpEnum];
export const ReasonEnum = { CONDITIONTIMEOUT: "ConditionTimeout", INVALIDSELECTOR: "InvalidSelector" } as const;
export type ReasonEnum = typeof ReasonEnum[keyof typeof ReasonEnum];
export const KindEnum2 = { XPATH: "XPath", CSS: "Css" } as const;
export type KindEnum2 = typeof KindEnum2[keyof typeof KindEnum2];
export const Mode1 = { EQ: "eq", CONTAINS: "contains" } as const;
export type Mode1 = typeof Mode1[keyof typeof Mode1];
export const ConditionFailureReasonEnum = { CONDITIONTIMEOUT: "ConditionTimeout", INVALIDSELECTOR: "InvalidSelector", INVALIDURLPATTERN: "InvalidUrlPattern", ROUTELOOPDETECTED: "RouteLoopDetected", INVALIDROUTETARGET: "InvalidRouteTarget" } as const;
export type ConditionFailureReasonEnum = typeof ConditionFailureReasonEnum[keyof typeof ConditionFailureReasonEnum];
export const OutcomeEnum = { PASS: "Pass", FAIL: "Fail" } as const;
export type OutcomeEnum = typeof OutcomeEnum[keyof typeof OutcomeEnum];
export const ReasonEnum1 = { INVALIDROUTETARGET: "InvalidRouteTarget", ROUTELOOPDETECTED: "RouteLoopDetected" } as const;
export type ReasonEnum1 = typeof ReasonEnum1[keyof typeof ReasonEnum1];
export const MethodEnum = { GET: "GET", POST: "POST", PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" } as const;
export type MethodEnum = typeof MethodEnum[keyof typeof MethodEnum];
export const DriftFieldNameEnum = { TAGNAME: "TagName", ID: "Id", CLASSNAME: "ClassName", ARIALABEL: "AriaLabel", NAME: "Name", TYPE: "Type", TEXTSNIPPET: "TextSnippet", OUTERHTMLSNIPPET: "OuterHtmlSnippet" } as const;
export type DriftFieldNameEnum = typeof DriftFieldNameEnum[keyof typeof DriftFieldNameEnum];
export const DriftChangeKindEnum = { UNCHANGED: "Unchanged", ADDED: "Added", REMOVED: "Removed", MODIFIED: "Modified" } as const;
export type DriftChangeKindEnum = typeof DriftChangeKindEnum[keyof typeof DriftChangeKindEnum];
export const DriftVerdictEnum = { IDENTICAL: "Identical", ATTRIBUTEDRIFT: "AttributeDrift", RENAMEDIDENTITY: "RenamedIdentity", DIFFERENTELEMENT: "DifferentElement", PRIMARYMISSING: "PrimaryMissing", FALLBACKMISSING: "FallbackMissing" } as const;
export type DriftVerdictEnum = typeof DriftVerdictEnum[keyof typeof DriftVerdictEnum];
export const DriftTimelineState = { NO_HISTORY: "no-history", ALWAYS_FAILING: "always-failing", HEALTHY: "healthy", DRIFTED: "drifted" } as const;
export type DriftTimelineState = typeof DriftTimelineState[keyof typeof DriftTimelineState];
export const BranchEnum1 = { SUCCESS: "Success", FAILURE: "Failure" } as const;
export type BranchEnum1 = typeof BranchEnum1[keyof typeof BranchEnum1];
export const FailurePhaseEnum = { RECORD: "Record", REPLAY: "Replay" } as const;
export type FailurePhaseEnum = typeof FailurePhaseEnum[keyof typeof FailurePhaseEnum];
export const FailureReasonCodeEnum = { VARIABLEMISSING: "VariableMissing", VARIABLENULL: "VariableNull", VARIABLEUNDEFINED: "VariableUndefined", VARIABLEEMPTY: "VariableEmpty", VARIABLETYPEMISMATCH: "VariableTypeMismatch", ZEROMATCHES: "ZeroMatches", PRIMARYMISSEDFALLBACKOK: "PrimaryMissedFallbackOk", XPATHSYNTAXERROR: "XPathSyntaxError", CSSSYNTAXERROR: "CssSyntaxError", UNRESOLVEDANCHOR: "UnresolvedAnchor", EMPTYEXPRESSION: "EmptyExpression", NOSELECTORS: "NoSelectors", TIMEOUT: "Timeout", CONDITIONTIMEOUT: "ConditionTimeout", JSTHREW: "JsThrew", UNKNOWN: "Unknown" } as const;
export type FailureReasonCodeEnum = typeof FailureReasonCodeEnum[keyof typeof FailureReasonCodeEnum];
export const Enum_3f9b995 = { ATTEMPTS: "Attempts", MESSAGE: "Message", REASON: "Reason", REASONDETAIL: "ReasonDetail", STACK: "Stack", VERBOSE: "Verbose" } as const;
export type Enum_3f9b995 = typeof Enum_3f9b995[keyof typeof Enum_3f9b995];
export const VariableValueType = { STRING: "string", NUMBER: "number", BOOLEAN: "boolean", NULL: "null", UNDEFINED: "undefined", OBJECT: "object", ARRAY: "array" } as const;
export type VariableValueType = typeof VariableValueType[keyof typeof VariableValueType];
export const VariableFailureReasonEnum = { RESOLVED: "Resolved", MISSINGCOLUMN: "MissingColumn", NULLVALUE: "NullValue", UNDEFINEDVALUE: "UndefinedValue", EMPTYSTRING: "EmptyString", TYPEMISMATCH: "TypeMismatch" } as const;
export type VariableFailureReasonEnum = typeof VariableFailureReasonEnum[keyof typeof VariableFailureReasonEnum];
export const FormFieldType = { TEXT: "text", EMAIL: "email", PASSWORD: "password", NUMBER: "number", TEL: "tel", URL: "url", SEARCH: "search", DATE: "date", DATETIME_LOCAL: "datetime-local", MONTH: "month", WEEK: "week", TIME: "time", COLOR: "color", RANGE: "range", FILE: "file", HIDDEN: "hidden", CHECKBOX: "checkbox", RADIO: "radio", SELECT: "select", SELECT_MULTIPLE: "select-multiple", TEXTAREA: "textarea", SUBMIT: "submit", BUTTON: "button", OTHER: "other" } as const;
export type FormFieldType = typeof FormFieldType[keyof typeof FormFieldType];
export const TagEnum = { FORM: "form", CONTAINER: "container" } as const;
export type TagEnum = typeof TagEnum[keyof typeof TagEnum];
export const HighlighterMode = { OFF: "off", RECORDING: "recording", REPLAY: "replay", INSPECTOR: "inspector" } as const;
export type HighlighterMode = typeof HighlighterMode[keyof typeof HighlighterMode];
export const HttpStepReasonEnum = { OK: "Ok", ENDPOINTHTTPERROR: "EndpointHttpError", ENDPOINTTIMEOUT: "EndpointTimeout", ENDPOINTPARSEERROR: "EndpointParseError", BADPARAMS: "BadParams" } as const;
export type HttpStepReasonEnum = typeof HttpStepReasonEnum[keyof typeof HttpStepReasonEnum];
export const UrlTabClickReasonEnum = { URLTABCLICKTIMEOUT: "UrlTabClickTimeout", TABNOTFOUND: "TabNotFound", INVALIDURLPATTERN: "InvalidUrlPattern", SELECTORNOTFOUND: "SelectorNotFound", URLPATTERNMISMATCH: "UrlPatternMismatch" } as const;
export type UrlTabClickReasonEnum = typeof UrlTabClickReasonEnum[keyof typeof UrlTabClickReasonEnum];
export const UrlMatchEnum = { EXACT: "Exact", PREFIX: "Prefix", GLOB: "Glob", REGEX: "Regex" } as const;
export type UrlMatchEnum = typeof UrlMatchEnum[keyof typeof UrlMatchEnum];
export const Mode2 = { OPENNEW: "OpenNew", FOCUSEXISTING: "FocusExisting", OPENORFOCUS: "OpenOrFocus" } as const;
export type Mode2 = typeof Mode2[keyof typeof Mode2];
export const ConditionFailureSourceEnum = { GATE: "Gate", CONDITIONSTEP: "ConditionStep", WAIT: "Wait" } as const;
export type ConditionFailureSourceEnum = typeof ConditionFailureSourceEnum[keyof typeof ConditionFailureSourceEnum];
export const ReasonEnum2 = { INVALIDSELECTOR: "InvalidSelector", ZEROMATCHES: "ZeroMatches", CONDITIONTIMEOUT: "ConditionTimeout" } as const;
export type ReasonEnum2 = typeof ReasonEnum2[keyof typeof ReasonEnum2];
export const SourceEnum6 = { VARS: "Vars", ROW: "Row" } as const;
export type SourceEnum6 = typeof SourceEnum6[keyof typeof SourceEnum6];
export const KindEnum3 = { CLICK: "Click", TYPE: "Type", SELECT: "Select", WAIT: "Wait" } as const;
export type KindEnum3 = typeof KindEnum3[keyof typeof KindEnum3];
export const OnTimeoutEnum = { FAIL: "Fail", SKIP: "Skip" } as const;
export type OnTimeoutEnum = typeof OnTimeoutEnum[keyof typeof OnTimeoutEnum];
export const ReasonEnum3 = { TIMEOUT: "Timeout", INVALIDSELECTOR: "InvalidSelector" } as const;
export type ReasonEnum3 = typeof ReasonEnum3[keyof typeof ReasonEnum3];
export const PromotionErrorCodeEnum = { TARGETNOTFOUND: "TargetNotFound", ALREADYPRIMARY: "AlreadyPrimary", EMPTYINPUT: "EmptyInput" } as const;
export type PromotionErrorCodeEnum = typeof PromotionErrorCodeEnum[keyof typeof PromotionErrorCodeEnum];
export const SourceEnum7 = { OPTIONS: "options", CONTROLLER: "controller", EXTERNAL: "external" } as const;
export type SourceEnum7 = typeof SourceEnum7[keyof typeof SourceEnum7];
export const RecordedStepKindEnum = { CLICK: "Click", TYPE: "Type", SELECT: "Select", SUBMIT: "Submit", WAIT: "Wait", JSINLINE: "JsInline" } as const;
export type RecordedStepKindEnum = typeof RecordedStepKindEnum[keyof typeof RecordedStepKindEnum];
export const SelectorStrategyEnum = { ID: "Id", TESTID: "TestId", ROLETEXT: "RoleText", POSITIONAL: "Positional" } as const;
export type SelectorStrategyEnum = typeof SelectorStrategyEnum[keyof typeof SelectorStrategyEnum];
export const Enum_11487e75 = { ERROR: "error", IDLE: "idle", OK: "ok", WARN: "warn" } as const;
export type Enum_11487e75 = typeof Enum_11487e75[keyof typeof Enum_11487e75];
export const ActionEnum1 = { START: "start", PAUSE: "pause", STOP: "stop" } as const;
export type ActionEnum1 = typeof ActionEnum1[keyof typeof ActionEnum1];
export const KindEnum4 = { XPATH: "XPath", CSS: "Css", ARIA: "Aria" } as const;
export type KindEnum4 = typeof KindEnum4[keyof typeof KindEnum4];
export const AttemptFailureReasonEnum = { MATCHED: "Matched", ZEROMATCHES: "ZeroMatches", XPATHSYNTAXERROR: "XPathSyntaxError", CSSSYNTAXERROR: "CssSyntaxError", UNRESOLVEDANCHOR: "UnresolvedAnchor", EMPTYEXPRESSION: "EmptyExpression", EVALUATIONTHREW: "EvaluationThrew" } as const;
export type AttemptFailureReasonEnum = typeof AttemptFailureReasonEnum[keyof typeof AttemptFailureReasonEnum];
export const AttemptStrategyEnum = { XPATHFULL: "XPathFull", XPATHRELATIVE: "XPathRelative", CSS: "Css", ARIA: "Aria", UNKNOWN: "Unknown" } as const;
export type AttemptStrategyEnum = typeof AttemptStrategyEnum[keyof typeof AttemptStrategyEnum];
export const Enum_1b5148e6 = { ELEMENT: "Element", ERROR: "Error", MATCHCOUNT: "MatchCount", MATCHED: "Matched", RESOLVEDEXPRESSION: "ResolvedExpression" } as const;
export type Enum_1b5148e6 = typeof Enum_1b5148e6[keyof typeof Enum_1b5148e6];
export const SelectorHealthEnum = { HEALTHY: "healthy", REGRESSED: "regressed", ALWAYS_FAILING: "always-failing", UNKNOWN: "unknown" } as const;
export type SelectorHealthEnum = typeof SelectorHealthEnum[keyof typeof SelectorHealthEnum];
export const Enum_50213bfa = { DESCRIPTION: "Description", INLINEJS: "InlineJs", LABEL: "Label", ORDERINDEX: "OrderIndex", PARAMSJSON: "ParamsJson", STEPID: "StepId", STEPKINDID: "StepKindId", STEPSTATUSID: "StepStatusId", VARIABLENAME: "VariableName" } as const;
export type Enum_50213bfa = typeof Enum_50213bfa[keyof typeof Enum_50213bfa];
export const UrlTabClickReasonEnum1 = { OK: "Ok", TABNOTFOUND: "TabNotFound", INVALIDURLPATTERN: "InvalidUrlPattern", SELECTORNOTFOUND: "SelectorNotFound", URLPATTERNMISMATCH: "UrlPatternMismatch", URLTABCLICKTIMEOUT: "UrlTabClickTimeout", BADPARAMS: "BadParams" } as const;
export type UrlTabClickReasonEnum1 = typeof UrlTabClickReasonEnum1[keyof typeof UrlTabClickReasonEnum1];
export const ReasonEnum4 = { INVALIDURLPATTERN: "InvalidUrlPattern", BADPARAMS: "BadParams" } as const;
export type ReasonEnum4 = typeof ReasonEnum4[keyof typeof ReasonEnum4];
export const WaitForPredicateEnum = { EXISTS: "Exists", VISIBLE: "Visible" } as const;
export type WaitForPredicateEnum = typeof WaitForPredicateEnum[keyof typeof WaitForPredicateEnum];
export const ContainerEnum = { TOP: "top", THEN: "then", ELSE: "else" } as const;
export type ContainerEnum = typeof ContainerEnum[keyof typeof ContainerEnum];
export const VariantEnum = { DEFAULT: "default", SECONDARY: "secondary", DESTRUCTIVE: "destructive", OUTLINE: "outline" } as const;
export type VariantEnum = typeof VariantEnum[keyof typeof VariantEnum];
export const Mode3 = { REPLACE: "replace", PREFIX: "prefix", SUFFIX: "suffix", SEQUENCE: "sequence" } as const;
export type Mode3 = typeof Mode3[keyof typeof Mode3];
export const KindEnum5 = { PREFIX: "prefix", SUFFIX: "suffix" } as const;
export type KindEnum5 = typeof KindEnum5[keyof typeof KindEnum5];
export const EditorMode = { TREE: "tree", RAW: "raw" } as const;
export type EditorMode = typeof EditorMode[keyof typeof EditorMode];
export const SectionEnum = { URLS: "urls", VARIABLES: "variables", XPATH: "xpath", COOKIES: "cookies", SCRIPTS: "scripts", KV: "kv", FILES: "files", ALL: "all" } as const;
export type SectionEnum = typeof SectionEnum[keyof typeof SectionEnum];
export const AuditSeverityEnum = { P0: "P0", P1: "P1", P2: "P2" } as const;
export type AuditSeverityEnum = typeof AuditSeverityEnum[keyof typeof AuditSeverityEnum];
export const BadgeEnum = { DESTRUCTIVE: "destructive", DEFAULT: "default", OUTLINE: "outline" } as const;
export type BadgeEnum = typeof BadgeEnum[keyof typeof BadgeEnum];
export const ToneEnum = { DEFAULT: "default", DESTRUCTIVE: "destructive", WARN: "warn", MUTED: "muted" } as const;
export type ToneEnum = typeof ToneEnum[keyof typeof ToneEnum];
export const ToneEnum1 = { DEFAULT: "default", WARN: "warn" } as const;
export type ToneEnum1 = typeof ToneEnum1[keyof typeof ToneEnum1];
export const LanguageEnum = { JAVASCRIPT: "javascript", JSON: "json", MARKDOWN: "markdown" } as const;
export type LanguageEnum = typeof LanguageEnum[keyof typeof LanguageEnum];
export const Enum_48fffa10 = { ASSETS: "assets", GROUPS: "groups" } as const;
export type Enum_48fffa10 = typeof Enum_48fffa10[keyof typeof Enum_48fffa10];
export const Enum_d264e93 = { EDIT: "edit", PREVIEW: "preview" } as const;
export type Enum_d264e93 = typeof Enum_d264e93[keyof typeof Enum_d264e93];
export const SidebarSectionEnum = { PROJECTS: "projects", SCRIPTS: "scripts", PROMPTS: "prompts", AUTOMATION: "automation", UPDATERS: "updaters", STORAGE: "storage", API: "api", LIBRARY: "library", STEP_GROUPS: "step-groups", SETTINGS: "settings", ABOUT: "about", LOGGING: "logging", TIMING: "timing", DATA: "data", NETWORK: "network", ACTIVITY: "activity", AUDIT: "audit" } as const;
export type SidebarSectionEnum = typeof SidebarSectionEnum[keyof typeof SidebarSectionEnum];
export const Type5 = { SECTION: "section", PROJECT: "project", SCRIPT: "script" } as const;
export type Type5 = typeof Type5[keyof typeof Type5];
export const ProjectTabEnum = { GENERAL: "general", SCRIPTS: "scripts", URLS: "urls", VARIABLES: "variables", XPATH: "xpath", COOKIES: "cookies", UPDATER: "updater", DOCS: "docs", FILES: "files", TIMING: "timing", AUTH: "auth", STORAGE: "storage", NETWORK: "network", RECORDER: "recorder", DIAGNOSTICS: "diagnostics" } as const;
export type ProjectTabEnum = typeof ProjectTabEnum[keyof typeof ProjectTabEnum];
export const StorageSubTabEnum = { KV: "kv", DATABASE: "database", CONFIG: "config", INDEXEDDB: "indexeddb" } as const;
export type StorageSubTabEnum = typeof StorageSubTabEnum[keyof typeof StorageSubTabEnum];
export const ActionEnum2 = { OPEN: "open", IGNORE: "ignore" } as const;
export type ActionEnum2 = typeof ActionEnum2[keyof typeof ActionEnum2];
export const UrlSubTabEnum = { RULES: "rules", PROJECT_URLS: "project-urls", VARIABLES: "variables" } as const;
export type UrlSubTabEnum = typeof UrlSubTabEnum[keyof typeof UrlSubTabEnum];
export const AccentEnum = { GREEN: "green", AMBER: "amber" } as const;
export type AccentEnum = typeof AccentEnum[keyof typeof AccentEnum];
export const FieldEnum = { KEY: "key", VALUE: "value" } as const;
export type FieldEnum = typeof FieldEnum[keyof typeof FieldEnum];
export const Enum_33898847 = { ERROR: "error", SYNCED: "synced", SYNCING: "syncing" } as const;
export type Enum_33898847 = typeof Enum_33898847[keyof typeof Enum_33898847];
export const ToneEnum2 = { DEFAULT: "default", SUCCESS: "success", MUTED: "muted" } as const;
export type ToneEnum2 = typeof ToneEnum2[keyof typeof ToneEnum2];
export const StorageSurfaceEnum = { DATABASE: "database", SESSION: "session", COOKIES: "cookies", INDEXEDDB: "indexeddb", LANDING: "landing" } as const;
export type StorageSurfaceEnum = typeof StorageSurfaceEnum[keyof typeof StorageSurfaceEnum];
export const Enum_162dadd6 = { COOKIES: "cookies", INDEXEDDB: "indexeddb", SESSION: "session" } as const;
export type Enum_162dadd6 = typeof Enum_162dadd6[keyof typeof Enum_162dadd6];
export const ErrorCategoryEnum = { HOST_PERMISSION: "host-permission", SCRIPTING_BLOCKED: "scripting-blocked", RESTRICTED_SCHEME: "restricted-scheme", OTHER: "other" } as const;
export type ErrorCategoryEnum = typeof ErrorCategoryEnum[keyof typeof ErrorCategoryEnum];
export const InitOutcomeEnum = { SUCCESS: "success", FAILED: "failed", IN_PROGRESS: "in_progress", UNKNOWN: "unknown" } as const;
export type InitOutcomeEnum = typeof InitOutcomeEnum[keyof typeof InitOutcomeEnum];
export const FixScenarioEnum = { ALL_CLEAR: "all_clear", MANIFEST_MISSING_DIRECTIVE: "manifest_missing_directive", STALE_BUILD_RELOAD_NEEDED: "stale_build_reload_needed", CSP_BLOCKED_UNKNOWN_CAUSE: "csp_blocked_unknown_cause", BOOT_FAILED_NON_CSP: "boot_failed_non_csp", BUILD_TOOLING_PNPM_DLX_LESS: "build_tooling_pnpm_dlx_less" } as const;
export type FixScenarioEnum = typeof FixScenarioEnum[keyof typeof FixScenarioEnum];
export const Status8 = { IDLE: "idle", RUNNING: "running", ERROR: "error" } as const;
export type Status8 = typeof Status8[keyof typeof Status8];
export const Enum_1ab45d34 = { FULL: "full", SHORT: "short" } as const;
export type Enum_1ab45d34 = typeof Enum_1ab45d34[keyof typeof Enum_1ab45d34];
export const CauseKindEnum = { WASM_MISSING: "wasm-missing", WASM: "wasm", OPFS: "opfs", STORAGE: "storage", MIGRATION: "migration", SCHEMA: "schema", UNKNOWN: "unknown" } as const;
export type CauseKindEnum = typeof CauseKindEnum[keyof typeof CauseKindEnum];
export const Enum_43ebc56c = { COPIED: "copied", IDLE: "idle", LOADING: "loading" } as const;
export type Enum_43ebc56c = typeof Enum_43ebc56c[keyof typeof Enum_43ebc56c];
export const ToneEnum3 = { WARN: "warn", INFO: "info", OK: "ok", ERROR: "error" } as const;
export type ToneEnum3 = typeof ToneEnum3[keyof typeof ToneEnum3];
export const SideEnum = { PRIMARY: "primary", FALLBACK: "fallback" } as const;
export type SideEnum = typeof SideEnum[keyof typeof SideEnum];
export const BranchEnum2 = { DEFAULT: "Default", SUCCESS: "Success", FAILURE: "Failure" } as const;
export type BranchEnum2 = typeof BranchEnum2[keyof typeof BranchEnum2];
export const ExportFormatEnum = { PRETTY: "pretty", MINIFIED: "minified" } as const;
export type ExportFormatEnum = typeof ExportFormatEnum[keyof typeof ExportFormatEnum];
export const ReasonGroupEnum = { VARIABLE: "variable", SELECTOR: "selector", SYNTAX: "syntax", TIMEOUT: "timeout", OTHER: "other" } as const;
export type ReasonGroupEnum = typeof ReasonGroupEnum[keyof typeof ReasonGroupEnum];
export const ControllerMode = { MINI: "mini", COMPACT: "compact", EXPANDED: "expanded" } as const;
export type ControllerMode = typeof ControllerMode[keyof typeof ControllerMode];
export const TraceStepStatus = { MATCHED: "matched", MISSED: "missed", ERRORED: "errored", PENDING: "pending" } as const;
export type TraceStepStatus = typeof TraceStepStatus[keyof typeof TraceStepStatus];
export const RoleEnum3 = { PRIMARY: "Primary", FALLBACK: "Fallback" } as const;
export type RoleEnum3 = typeof RoleEnum3[keyof typeof RoleEnum3];
export const OutcomeEnum1 = { MATCHED: "matched", EXHAUSTED: "exhausted", EMPTY: "empty" } as const;
export type OutcomeEnum1 = typeof OutcomeEnum1[keyof typeof OutcomeEnum1];
export const OrientationEnum = { HORIZONTAL: "horizontal", VERTICAL: "vertical" } as const;
export type OrientationEnum = typeof OrientationEnum[keyof typeof OrientationEnum];
export const IndicatorEnum = { LINE: "line", DOT: "dot", DASHED: "dashed" } as const;
export type IndicatorEnum = typeof IndicatorEnum[keyof typeof IndicatorEnum];
export const Enum_7cb0a3c2 = { PAYLOAD: "payload", VERTICALALIGN: "verticalAlign" } as const;
export type Enum_7cb0a3c2 = typeof Enum_7cb0a3c2[keyof typeof Enum_7cb0a3c2];
export const State = { EXPANDED: "expanded", COLLAPSED: "collapsed" } as const;
export type State = typeof State[keyof typeof State];
export const SideEnum1 = { LEFT: "left", RIGHT: "right" } as const;
export type SideEnum1 = typeof SideEnum1[keyof typeof SideEnum1];
export const VariantEnum1 = { SIDEBAR: "sidebar", FLOATING: "floating", INSET: "inset" } as const;
export type VariantEnum1 = typeof VariantEnum1[keyof typeof VariantEnum1];
export const CollapsibleEnum = { OFFCANVAS: "offcanvas", ICON: "icon", NONE: "none" } as const;
export type CollapsibleEnum = typeof CollapsibleEnum[keyof typeof CollapsibleEnum];
export const SizeEnum = { SM: "sm", MD: "md" } as const;
export type SizeEnum = typeof SizeEnum[keyof typeof SizeEnum];
export const SizeEnum1 = { SM: "sm", DEFAULT: "default", ICON: "icon" } as const;
export type SizeEnum1 = typeof SizeEnum1[keyof typeof SizeEnum1];
export const Type9 = { DRAGENTER: "dragenter", DRAGOVER: "dragover", DRAGLEAVE: "dragleave", DROP: "drop" } as const;
export type Type9 = typeof Type9[keyof typeof Type9];
export const ActionEnum4 = { START: "start", PAUSE: "pause", RESUME: "resume", STOP: "stop" } as const;
export type ActionEnum4 = typeof ActionEnum4[keyof typeof ActionEnum4];
export const CoercionKindEnum = { AUTO: "auto", STRING: "string", NUMBER: "number", BOOLEAN: "boolean", JSON: "json" } as const;
export type CoercionKindEnum = typeof CoercionKindEnum[keyof typeof CoercionKindEnum];
export const CsvFailureBranchEnum = { EMPTY_INPUT: "empty-input", SIZE_LIMIT: "size-limit", UNTERMINATED_QUOTE: "unterminated-quote", NO_ROWS: "no-rows", DUPLICATE_HEADERS: "duplicate-headers", EMPTY_HEADER: "empty-header", ROW_LIMIT: "row-limit" } as const;
export type CsvFailureBranchEnum = typeof CsvFailureBranchEnum[keyof typeof CsvFailureBranchEnum];
export const DelimiterEnum = { _: ",", _: ";" } as const;
export type DelimiterEnum = typeof DelimiterEnum[keyof typeof DelimiterEnum];
export const ExportReasonEnum = { OK: "Ok", PROJECTNOTFOUND: "ProjectNotFound", GROUPNOTFOUND: "GroupNotFound", GROUPOUTSIDEPROJECT: "GroupOutsideProject", EMPTYSELECTION: "EmptySelection", RUNGROUPTARGETMISSING: "RunGroupTargetMissing", INTERNALERROR: "InternalError" } as const;
export type ExportReasonEnum = typeof ExportReasonEnum[keyof typeof ExportReasonEnum];
export const ExportErrorSeverityEnum = { SELECTION: "Selection", BUNDLE: "Bundle", INTERNAL: "Internal" } as const;
export type ExportErrorSeverityEnum = typeof ExportErrorSeverityEnum[keyof typeof ExportErrorSeverityEnum];
export const Enum_28c2faf8 = { DISPATCHEVENT: "dispatchEvent", QUERYSELECTOR: "querySelector" } as const;
export type Enum_28c2faf8 = typeof Enum_28c2faf8[keyof typeof Enum_28c2faf8];
export const ConflictPolicyEnum = { SKIP: "Skip", RENAME: "Rename", FAIL: "Fail" } as const;
export type ConflictPolicyEnum = typeof ConflictPolicyEnum[keyof typeof ConflictPolicyEnum];
export const ImportReasonEnum = { OK: "Ok", BUNDLENOTZIP: "BundleNotZip", MANIFESTMISSING: "ManifestMissing", MANIFESTMALFORMED: "ManifestMalformed", MANIFESTVERSIONUNSUPPORTED: "ManifestVersionUnsupported", DBFILEMISSING: "DbFileMissing", DBCHECKSUMMISMATCH: "DbChecksumMismatch", DBSCHEMAINCOMPATIBLE: "DbSchemaIncompatible", DBCORRUPT: "DbCorrupt", DESTINATIONPROJECTMISSING: "DestinationProjectMissing", ATTACHPARENTMISSING: "AttachParentMissing", ATTACHPARENTWRONGPROJECT: "AttachParentWrongProject", NAMECONFLICT: "NameConflict", RUNGROUPTARGETMISSING: "RunGroupTargetMissing", INTERNALERROR: "InternalError" } as const;
export type ImportReasonEnum = typeof ImportReasonEnum[keyof typeof ImportReasonEnum];
export const KindEnum7 = { KEEP: "Keep", COLLISION: "Collision", SKIP: "Skip" } as const;
export type KindEnum7 = typeof KindEnum7[keyof typeof KindEnum7];
export const ImportErrorSeverityEnum = { BUNDLE: "Bundle", CONFLICT: "Conflict", INTERNAL: "Internal" } as const;
export type ImportErrorSeverityEnum = typeof ImportErrorSeverityEnum[keyof typeof ImportErrorSeverityEnum];
export const InputSourceMethodEnum = { GET: "GET", POST: "POST" } as const;
export type InputSourceMethodEnum = typeof InputSourceMethodEnum[keyof typeof InputSourceMethodEnum];
export const InputSourceFailurePolicyEnum = { ABORT: "Abort", CONTINUEWITHLOCAL: "ContinueWithLocal" } as const;
export type InputSourceFailurePolicyEnum = typeof InputSourceFailurePolicyEnum[keyof typeof InputSourceFailurePolicyEnum];
export const KindEnum8 = { TYPE: "Type", SELECT: "Select" } as const;
export type KindEnum8 = typeof KindEnum8[keyof typeof KindEnum8];
export const BatchGroupStatus = { PENDING: "Pending", RUNNING: "Running", SUCCEEDED: "Succeeded", FAILED: "Failed", SKIPPED: "Skipped" } as const;
export type BatchGroupStatus = typeof BatchGroupStatus[keyof typeof BatchGroupStatus];
export const BatchFailurePolicyEnum = { STOPONFAILURE: "StopOnFailure", CONTINUEONFAILURE: "ContinueOnFailure" } as const;
export type BatchFailurePolicyEnum = typeof BatchFailurePolicyEnum[keyof typeof BatchFailurePolicyEnum];
export const OutcomeEnum4 = { EXECUTED: "Executed", SKIPPED: "Skipped", ENTEREDGROUP: "EnteredGroup", EXITEDGROUP: "ExitedGroup", FAILED: "Failed" } as const;
export type OutcomeEnum4 = typeof OutcomeEnum4[keyof typeof OutcomeEnum4];
export const RunGroupFailureReasonEnum = { LEAFSTEPFAILED: "LeafStepFailed", RUNGROUPCYCLE: "RunGroupCycle", RUNGROUPDEPTHEXCEEDED: "RunGroupDepthExceeded", MISSINGTARGETGROUP: "MissingTargetGroup", MISSINGROOTGROUP: "MissingRootGroup", TARGETNOTINPROJECT: "TargetNotInProject" } as const;
export type RunGroupFailureReasonEnum = typeof RunGroupFailureReasonEnum[keyof typeof RunGroupFailureReasonEnum];
export const Enum_4c6f84e9 = { GROUP: "group", PLAN: "plan" } as const;
export type Enum_4c6f84e9 = typeof Enum_4c6f84e9[keyof typeof Enum_4c6f84e9];
export const WaitConditionEnum = { APPEARS: "Appears", DISAPPEARS: "Disappears", VISIBLE: "Visible" } as const;
export type WaitConditionEnum = typeof WaitConditionEnum[keyof typeof WaitConditionEnum];
export const Enum_4085bbd6 = { KIND: "Kind", SELECTOR: "Selector" } as const;
export type Enum_4085bbd6 = typeof Enum_4085bbd6[keyof typeof Enum_4085bbd6];
export const ActiveViewEnum = { LOGS: "logs", ERRORS: "errors", DATASTORE: "datastore" } as const;
export type ActiveViewEnum = typeof ActiveViewEnum[keyof typeof ActiveViewEnum];
export const StorageCategoryEnum = { DATABASE: "database", SESSION: "session", COOKIES: "cookies", LOCAL: "local" } as const;
export type StorageCategoryEnum = typeof StorageCategoryEnum[keyof typeof StorageCategoryEnum];
export const NewPropertyType = { STRING: "string", NUMBER: "number", BOOLEAN: "boolean", OBJECT: "object", ARRAY: "array" } as const;
export type NewPropertyType = typeof NewPropertyType[keyof typeof NewPropertyType];
export const FormatEnum1 = { MARKDOWN: "markdown", PRISMA: "prisma", BOTH: "both" } as const;
export type FormatEnum1 = typeof FormatEnum1[keyof typeof FormatEnum1];
export const ActionEnum5 = { CREATE: "create", MODIFY: "modify", DROP: "drop" } as const;
export type ActionEnum5 = typeof ActionEnum5[keyof typeof ActionEnum5];
export const Enum_4fd41a90 = { MARKDOWN: "markdown", PRISMA: "prisma" } as const;
export type Enum_4fd41a90 = typeof Enum_4fd41a90[keyof typeof Enum_4fd41a90];
export const StageEnum3 = { GLOBAL: "global", DEPENDENCY: "dependency", PROJECT: "project" } as const;
export type StageEnum3 = typeof StageEnum3[keyof typeof StageEnum3];
export const SelfTestPhaseEnum = { INSERT: "insert", VERIFY: "verify", CLEANUP: "cleanup" } as const;
export type SelfTestPhaseEnum = typeof SelfTestPhaseEnum[keyof typeof SelfTestPhaseEnum];
export const CauseStatus = { OK: "ok", WARN: "warn", ERROR: "error" } as const;
export type CauseStatus = typeof CauseStatus[keyof typeof CauseStatus];
export const Status10 = { UP_TO_DATE: "up-to-date", UPDATE_AVAILABLE: "update-available", ERROR: "error", UNCHECKED: "unchecked" } as const;
export type Status10 = typeof Status10[keyof typeof Status10];
export const StatusFilter = { ALL: "all", SUCCESS: "success", SKIPPED: "skipped", FAILURE: "failure" } as const;
export type StatusFilter = typeof StatusFilter[keyof typeof StatusFilter];
export const SelectorStatus = { EMPTY: "empty", INVALID: "invalid", NO_MATCH: "no-match", MATCH: "match" } as const;
export type SelectorStatus = typeof SelectorStatus[keyof typeof SelectorStatus];
export const KindEnum9 = { ACTIVEELEMENT: "ActiveElement", BODY: "Body" } as const;
export type KindEnum9 = typeof KindEnum9[keyof typeof KindEnum9];
export const Enum_4b5a7f2f = { RELOAD: "reload", SETSTEPLINK: "setStepLink", SETSTEPTAGS: "setStepTags", UPDATESTEPMETA: "updateStepMeta" } as const;
export type Enum_4b5a7f2f = typeof Enum_4b5a7f2f[keyof typeof Enum_4b5a7f2f];
export const Mode5 = { ADD: "add", REMOVE: "remove" } as const;
export type Mode5 = typeof Mode5[keyof typeof Mode5];































































































































































































