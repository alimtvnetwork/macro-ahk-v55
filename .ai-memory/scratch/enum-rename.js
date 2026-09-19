/**
 * enum-rename.js
 * 
 * PURPOSE: Rename all enum names in the codebase to follow the convention:
 *   - Garbage auto-generated names (SemanticSemantic*, Enum_*, etc.) → meaningful names with Type suffix
 *   - Names with "Enum" suffix → replace "Enum" with "Type"
 *   - Names with no type-indicating suffix → add "Type" suffix
 *   - Names that already have Type/Status/Code/Phase suffix → keep (they're fine)
 * 
 * RULE: Only touch enum names (declarations + usages). Do NOT touch values, logic, or anything else.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── RENAME MAPPING ─────────────────────────────────────────────────────────
// Format: 'OldName' => 'NewName'
// Priority: longer/more-specific names first to avoid partial replacements
const RENAME_MAP = {
  // ── GARBAGE NAMES (auto-generated, meaningless) ──────────────────────────
  'SemanticSemantic43ebc56c':         'SessionCopyStateType',
  'Enum_43ebc56c':                    'SessionCopyStateType',   // old name for same thing
  'SemanticSemantice15ad':            'PromptFieldKeyType',
  'SemanticSemanticStageEnum':        'ImportStageType',
  'SemanticSemantic7249a':            'ScriptRunResultFieldType',
  'SemanticSemantic31dd676d':         'NavigationDirectionType',
  'SemanticSemanticLogLevelEnum':     'ExtLogLevelType',
  'SemanticSemanticVariantEnum1':     'AlertVariantType',
  'SemanticSemantic56e0146f':         'SqliteCommandType',
  'SemanticSemantic83c400f':          'SqlStmtOpType',
  'SemanticSemanticSkipReasonEnum':   'SkipReasonType',
  'SemanticSemantic76ebb':            'HttpErrorCategoryType',
  'WriteUISnapshotSnapshot':          'UISnapshotFieldType',
  'PromptOrderSourceSource':          'PromptOrderSourceType',
  'ComputeAndRenderPreviewO':         'PreviewTriggerType',
  'RenderPartialImportErrorsSource':  'ImportErrorSourceType',
  'SubstituteTaskNextPromptTextPrompt': 'PromptSubstituteFieldType',
  'DEFAULTREMIXNEXTVCASINGEnum':     'RemixCasingType',
  'NeedsBalanceEnrichmentInputWorkspace': 'WorkspaceEnrichmentFieldType',
  'ColumnValidationType1':            'ColumnValidationType',

  // ── "Enum" suffix → "Type" suffix ────────────────────────────────────────
  'FullStrategyEnum':             'FullStrategyType',
  'KindEnum':                     'LogKindType',
  'SeverityFilterEnum':           'SeverityFilterType',
  'SourceFilterEnum':             'SourceFilterType',
  'EditorThemeNameEnum':          'EditorThemeType',
  'DatabaseEnum':                 'DatabaseType',
  'DirectionEnum':                'DirectionType',
  'StepLinkSlotEnum':             'StepLinkSlotType',
  'StageEnum':                    'SqlStageType',
  'StepGroupViewEnum':            'StepGroupViewType',
  'OriginEnum':                   'PromptOriginType',
  'TargetEnum':                   'InjectionTargetType',
  'InjectionLaunchSourceEnum':    'InjectionLaunchSourceType',
  'InlineSyntaxFlagSourceEnum':   'InlineSyntaxFlagSourceType',
  'ConnectionEnum':               'ConnectionStateType',
  'MimeKindEnum':                 'MimeKindType',
  'FormatEnum':                   'DocFormatType',
  'SurfaceEnum':                  'StorageSurfaceType',
  'LogLevelEnum':                 'LogLevelType',
  'InjectionMethodEnum':          'InjectionMethodType',
  'BridgeOutcomeEnum':            'BridgeOutcomeType',
  'WorkspaceDisplayKindEnum':     'WorkspaceDisplayKindType',
  'WorkspaceDisplayToneEnum':     'WorkspaceDisplayToneType',
  'MemberRoleEnum':               'MemberRoleType',
  'BucketEnum':                   'SqlBucketType',
  'ErrorSeverityEnum':            'ErrorSeverityType',
  'ErrorAreaEnum':                'ErrorAreaType',
  'ToastLevelEnum':               'ToastLevelType',
  'ProjectLockReasonEnum':        'ProjectLockReasonType',
  'StrategyEnum':                 'SelectorStrategyType',
  'PromptSeedEventNameEnum':      'PromptSeedEventType',
  'RenameStrategyEnum':           'RenameStrategyType',
  'LoadStageEnum':                'PromptLoadStageType',
  'CreditToneEnum':               'CreditToneType',
  'SortKeyEnum':                  'WorkspaceSortKeyType',
  'SortDirEnum':                  'SortDirectionType',
  'JsonLogLevelEnum':             'JsonLogLevelType',
  'RuleZeroCodeEnum':             'RuleZeroCodeType',
  'CreditBalanceFetchSourceEnum': 'CreditBalanceFetchSourceType',
  'CreditSummarySourceEnum':      'CreditSummarySourceType',
  'ChatSubmitSourceEnum':         'ChatSubmitSourceType',
  'LovableIdleResultEnum':        'LovableIdleResultType',
  'ActiveQueueTabEnum':           'ActiveQueueTabType',
  'PromptsBundleFormatEnum':      'PromptsBundleFormatType',
  'SlugPositionSourceEnum':       'SlugPositionSourceType',
  'HistorySortKeyEnum':           'HistorySortKeyType',
  'HistoryImportedFilterEnum':    'HistoryImportedFilterType',
  'ImportAuditRowActionEnum':     'ImportAuditRowActionType',
  'ImportErrorCodeEnum':          'ImportErrorCodeType',
  'ConflictEnum':                 'ImportConflictType',
  'RuleEnum':                     'ValidatedRuleType',
  'ViolationKindEnum':            'ViolationKindType',
  'PasteOutcomeEnum':             'PasteOutcomeType',
  'CaptureSourceEnum':            'CaptureSourceType',
  'RepeatPhaseEnum':              'RepeatPhaseType',
  'DisplayValueEnum':             'CssDisplayType',
  'TaskNextPromptSourceEnum':     'TaskNextPromptSourceType',
  'SplitterParseReasonEnum':      'SplitterParseReasonType',
  'PlanPromptSourceEnum':         'PlanPromptSourceType',
  'StepEnum':                     'StepMutationType',
  'IdEnum':                       'MarcoElementIdType',
  'SummaryPillKindEnum':          'SummaryPillKindType',
  'MatchStrategyEnum':            'MatchStrategyType',
  'IdempotentResultEnum':         'IdempotentResultType',
  'WorkspaceStatusKindEnum':      'WorkspaceStatusKindType',

  // ── Names with no type-indicating suffix → add "Type" ────────────────────
  'LinkState':                    'LinkStateType',
  'UsePopupActionsMode':          'PopupActionsModeType',
  'CookieBindingRole':            'CookieBindingRoleType',
  'ChainStepStatus':              'ChainStepStatusType',
  'UseRecorderSelectionSource':   'RecorderSelectionSourceType',
  'MessageRequestStatus':         'MessageRequestStatusType',
  'LoggingMode':                  'LoggingModeType',
  'MatchType':                    'MatchRuleType',    // avoid collision with src MatchType
  'GitsyncStatus':                'GitsyncStatusType',
  'MarcoSDKAuthResolutionDiagSource': 'AuthResolutionDiagSourceType',
  'DetectedWorkspaceSnapshotSource': 'WorkspaceSnapshotSourceType',
  'Mode':                         'OperationModeType',
  'KeyEnum':                      'GracePeriodKeyType',
  'TimingEntryStatus':            'TimingEntryStatusType',
  'ToastEntryType':               'ToastEntryLevelType', // already has Type but ambiguous
  'MacroTaskStatus':              'MacroTaskStatusType',
  'WorkspaceStatusKind':          'WorkspaceStatusKindType',
  'CreditSortMode':               'CreditSortModeType',
  'BuildSessionPhase':            'BuildSessionPhaseType',
  'ToastPropsVariant':            'ToastVariantType',
  'InjectionResultEntrySkipReason': 'InjectionSkipReasonType',
  'HealthyRowRole':               'PromptRowRoleType',
  'FireMouseType':                'MouseEventType',
  'BatchRefreshOptionsSource':    'BatchRefreshSourceType',
  'FetchAndPersistResultOutcome': 'FetchPersistOutcomeType',
  'NeedsBalanceEnrichmentResultReason': 'BalanceEnrichmentReasonType',
  'ShouldFetchDecisionReason':    'FetchDecisionReasonType',
  'GitsyncJobStatus':             'GitsyncJobStatusType',
  'GitsyncConnectionStateReason': 'GitsyncConnectionReasonType',
  'AutoResumeResultReason':       'AutoResumeReasonType',
  'QueueClickResultReason':       'QueueClickReasonType',
  'TaskQueueItemStatus':          'TaskQueueItemStatusType',
  'PromptHealthIssueCode':        'PromptHealthIssueType', // Code→Type for consistency
  'OrphanRepairEntryOutcome':     'OrphanRepairOutcomeType',
  'ReseedResultMode':             'ReseedModeType',
  'SeedStageStatus':              'SeedStageStatusType',
  'SeedStageReportStage':         'SeedReportStageType',
  'CachedPromptEntryRole':        'CachedPromptRoleType',
  'FilterStateMode':              'FilterStateModeType',
  'JsonMigrationAction':          'JsonMigrationActionType',
  'ForeignKeyDefOnDelete':        'ForeignKeyOnDeleteType',
  'ShowMsgType':                  'ShowMsgLevelType',
  'OverlayErrorLevel':            'OverlayErrorLevelType',
  'ImportAuditStatus':            'ImportAuditStatusType',
  'MakeBtnVariant':               'ButtonVariantType',
  'numFieldKind':                 'NumFieldKindType',
  'CycleStatus':                  'CycleStatusType',
  'ImportProgressPhase':          'ImportProgressPhaseType',
  'ClassifyImportErrorPhase':     'ImportErrorPhaseType',
  'EvaluateRouteChangeSource':    'RouteChangeSourceType',
  'RegisteredUserScriptWorld':    'UserScriptWorldType',
  'InjectableScriptRunAt':        'ScriptRunAtType',
  'wireStartNumInputKey':         'NumInputKeyType',
  'RejectionType':                'RejectionCategoryType',
  'RegisteredUserScriptWorld':    'UserScriptWorldType',
  'SeedCookieBindingRole':        'SeedCookieRoleType',

  // ── Names that are good but still need "Type" suffix ─────────────────────
  'BatchFailurePolicyEnum':       'BatchFailurePolicyType',  // in run-batch.ts
  'BatchGroupStatus':             'BatchGroupStatusType',    // in run-batch.ts

  // ── src/ enums that need renaming ─────────────────────────────────────────
  // (from task-4346 scan of src/ directory)
  // StepKindId - keep (database FK name, KindId is the convention)
  // BgLogTag - keep (tag not enum, string values)
  // MessageType - keep (already Type)
  // MembershipRoleApiCode, RunSummary*Code, etc. - keep (Code is a meaningful suffix for lookup codes)
  'AllowedHomeUrl':               'AllowedHomeUrlType',
  'NavDirection':                 'NavDirectionType',
  'OwnerSwitchCsvColumn':         'OwnerSwitchCsvColumnType',
  'LogPhase':                     'LogPhaseType',
  'LogSeverity':                  'LogSeverityType',
  'UserAddCsvColumn':             'UserAddCsvColumnType',
  'UserAddLogPhase':              'UserAddLogPhaseType',
  'UserAddLogSeverity':           'UserAddLogSeverityType',
  'CreditFetchOutcome':           'CreditFetchOutcomeType',
  'CreditBalanceFetchStatus':     'CreditBalanceFetchStatusType',
  'CreditBalanceLogEvent':        'CreditBalanceLogEventType',
  'MacroCreditSource':            'MacroCreditSourceType',
  'WorkspacePlan':                'WorkspacePlanType',
  'ApiPath':                      'ApiPathType',
  'LoopDirection':                'LoopDirectionType',
  'CreditSource':                 'CreditSourceType',
  'CssFragment':                  'CssFragmentType',
  'DataAttr':                     'DataAttrType',
  'DomId':                        'DomIdType',
  'Label':                        'LabelType',
  'PromptCacheKey':               'PromptCacheKeyType',
  'StorageKey':                   'StorageKeyType',
  'StyleId':                      'StyleIdType',
  'SubscriptionStatus':           'SubscriptionStatusType',
  'WsTierValue':                  'WsTierValueType',
  'PlanName':                     'PlanNameType',
  'WsTier':                       'WsTierType',
  'BannerState':                  'BannerStateType',
  'AssetInjectTarget':            'AssetInjectTargetType',
  'InjectionRunAt':               'InjectionRunAtType',
  'InjectionWorld':               'InjectionWorldType',
  'XPathKind':                    'XPathKindType',
  'BannerLifecyclePhase':         'BannerLifecyclePhaseType',
  'BannerEventName':              'BannerEventNameType',
  'BannerLogFn':                  'BannerLogFnType',
  // RunSqlMethod is good (Method is a suffix), keep
  // Plan - in plan.ts, standalone-scripts
  'Plan':                         'PlanTierType',
  // GrantType - already has Type suffix, keep
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getAllTsFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'scratch'].includes(entry.name)) continue;
      getAllTsFiles(full, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

// Build sorted array of [oldName, newName] — longer names first to avoid partial replacements
const sortedRenames = Object.entries(RENAME_MAP).sort((a, b) => b[0].length - a[0].length);

function applyRenames(content) {
  let changed = false;
  for (const [oldName, newName] of sortedRenames) {
    // Match the name as a whole word (not preceded/followed by alphanumeric or _)
    const regex = new RegExp(`(?<![\\w])${escapeRegex(oldName)}(?![\\w])`, 'g');
    if (regex.test(content)) {
      content = content.replace(new RegExp(`(?<![\\w])${escapeRegex(oldName)}(?![\\w])`, 'g'), newName);
      changed = true;
    }
  }
  return { content, changed };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const root = path.resolve(__dirname, '..');
const files = getAllTsFiles(root);

let totalFilesChanged = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const { content, changed } = applyRenames(original);
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    totalFilesChanged++;
    // Count how many of the renames hit this file
    let hits = 0;
    for (const [oldName] of sortedRenames) {
      if (original.includes(oldName)) hits++;
    }
    totalReplacements += hits;
    console.log(`  UPDATED: ${path.relative(root, file)} (${hits} rename(s))`);
  }
}

console.log(`\nDone: ${totalFilesChanged} files updated, ${totalReplacements} total rename-hits.`);
