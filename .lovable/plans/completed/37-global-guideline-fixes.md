# Plan 37: Global Coding Guideline Fixes

- **Slug:** global-guideline-fixes
- **Status:** completed
- **Created:** 2026-08-17
- **Subtasks:** 120

## Goal

Systematically fix all coding guideline violations identified in the 2026-08-17 audit. Violations span:
- Rule 3: Raw `!` negations in if conditions (100+ instances)
- Rule 3: Compound `&&` conditions with more than 2 parts (20+ instances)
- Rule 3: Mixed polarity conditions (`isX && !isY`) (10+ instances)
- Rule 7: Files exceeding 100-line limit (80+ files)
- Rule 14: `let` mutation where `const` suffices (25+ instances)
- Rule 8: Magic numbers/strings (5+ instances)
- Rule 11: DRY violations in guard patterns (15+ instances)
- Rule 9: Inline anonymous types (3+ instances)

## Observations Source

`.lovable/memory/learned/01-guideline-audit-observations.md`

## Execution Strategy

Agents MUST execute subtasks in numeric order (01, 02, 03...). Each subtask is a focused micro-task targeting a single file or single violation type. No subtask should take more than 15 minutes. Each subtask must be committed separately with a descriptive `fix(guidelines):` prefix.

## Subtask Groups

### Group A: Rule 3 Fixes — Raw Negation Guards (subtasks 01-040)
Fix all `if (!x)` patterns to use named positive guard variables or semantic inverses.

### Group B: Rule 3 Fixes — Compound `&&` Extraction (subtasks 041-060)
Extract all multi-part `&&` conditions into named boolean variables.

### Group C: Rule 3 Fixes — Mixed Polarity (subtasks 061-070)
Fix all `isX && !isY` patterns to use named composite booleans.

### Group D: Rule 8 Fixes — Magic Numbers (subtasks 071-075)
Replace all magic numbers/strings with named constants.

### Group E: Rule 9 Fixes — Inline Types (subtasks 076-080)
Move all inline anonymous types to dedicated type files.

### Group F: Rule 11 Fixes — DRY Guards (subtasks 081-090)
Extract repeated guard patterns into shared utilities.

### Group G: Rule 14 Fixes — let to const (subtasks 091-100)
Convert unnecessary `let` declarations to `const` using return-early or IIFE patterns.

### Group H: Rule 7 Fixes — File Size Splitting (subtasks 101-120)
Split the largest god-files into responsibility-based sub-files.

## Subtask Index

| # | File | Rule | Summary |
|---|------|------|---------|
| 01 | automation-chain-handler.ts | Rule 3 | Extract guard variables for !chain, !chainId |
| 02 | config-auth-handler.ts | Rule 3 | Extract isAuthTokenMissing guard |
| 03 | config-auth-handler.ts | Rule 3 | Extract isRawDataMissing, isUrlMissing guards |
| 04 | config-auth-handler.ts | Rule 3 | Fix !response.ok, !canListCookies patterns |
| 05 | dynamic-require-handler.ts | Rule 3 | Extract isRequesterMissing, isResolutionFailed |
| 06 | dynamic-require-handler.ts | Rule 3 | Fix compound negation at L57 and L94 |
| 07 | file-storage-handler.ts | Rule 3 | Extract isDbManagerMissing guard (used 1x) |
| 08 | file-storage-handler.ts | Rule 3 | Extract isProjectIdMissing, isFilenameMissing, isFileIdMissing |
| 09 | grouped-kv-handler.ts | Rule 3 | Extract isDbManagerMissing, isGroupMissing, isKeyMissing |
| 10 | injection-dependency-builder.ts | Rule 3 | Extract isActiveIdMissing, isActiveProjectMissing |
| 11 | injection-dependency-builder.ts | Rule 3 | Fix !relevantIds.has() negations |
| 12 | injection-handler.ts | Rule 3 | Fix L164 double negation compound condition |
| 13 | injection-handler.ts | Rule 3 | Fix L182 mixed polarity: cachedPayload && !cacheMatchesRequest |
| 14 | injection-handler.ts | Rule 3 | Fix L686,702,726 !r and !allOk patterns |
| 15 | injection-namespace-bootstrap.ts | Rule 3 | Extract isExtRootMissing, isProjectsMissing |
| 16 | injection-namespace-bootstrap.ts | Rule 3 | Fix !_llmGuideCache.has() negation |
| 17 | injection-namespace-bootstrap.ts | Rule 3 | Fix L128,133,156 repeated negation guards |
| 18 | library-handler.ts | Rule 3 | Extract isDbManagerMissing guard |
| 19 | library-handler.ts | Rule 3 | Extract isAssetMissing, isLinkMissing, isGroupMissing, isSettingsJsonMissing |
| 20 | project-api-handler.ts | Rule 3 | Extract isSlugMissing, isEndpointMissing guards |
| 21 | project-api-handler.ts | Rule 3 | Extract isTableNameMissing, isColumnsMissing, isSqlMissing |
| 22 | prompt-handler.ts | Rule 3 | Extract isDbManagerMissing, isTrimmedEmpty, isCategoryIdMissing |
| 23 | prompt-handler.ts | Rule 3 | Fix compound negation at L322 and L498 |
| 24 | prompt-handler.ts | Rule 3 | Fix !Number.isFinite() negation at L706, L766 |
| 25 | token-seeder.ts | Rule 3 | Replace !hasTabAccess with isTabAccessDenied |
| 26 | token-seeder.ts | Rule 3 | Replace !hasPermission with isPermissionDenied |
| 27 | token-seeder.ts | Rule 3 | Replace !canExecuteScript with isScriptExecutionBlocked |
| 28 | token-seeder.ts | Rule 3 | Fix !key, !isSupabaseKey, !raw guards |
| 29 | seed-plan-next.ts | Rule 3 | Extract isBucketMissing guard at L151 |
| 30 | seed-plan-next.ts | Rule 3 | Fix !row.isDefault — use row.isAlternate |
| 31 | seed-plan-next.ts | Rule 3 | Fix !match.isMatch — use match.isMismatch |
| 32 | prompt-editor.ts | Rule 3 | Extract isSeedMissing, isRowMissing guards |
| 33 | prompt-editor.ts | Rule 3 | Replace !isClean with isDirty |
| 34 | prompt-editor.ts | Rule 3 | Fix vague !rc guard — extract isRcMissing |
| 35 | prompt-dropdown.ts | Rule 3 | Extract isEntriesEmpty, isHeaderMissing |
| 36 | prompt-dropdown.ts | Rule 3 | Fix !container.hasAttribute() negation |
| 37 | prompt-dropdown.ts | Rule 3 | Fix double negation at L402 |
| 38 | prompt-dropdown.ts | Rule 3 | Fix !resolved, !p.text, !p.slug guards |
| 39 | prompt-dropdown.ts | Rule 3 | Fix compound negation at L1013 and L1301 |
| 40 | prompt-dropdown.ts | Rule 3 | Fix !confirm() negation at L725 |
| 41 | config-auth-handler.ts | Rule 3 | Extract isJwtToken() helper, replace triple && at L599 |
| 42 | config-auth-handler.ts | Rule 3 | Extract isSupabaseAuthKey() helper, replace triple && at L613 |
| 43 | token-seeder.ts | Rule 3 | Extract isJwtSessionValue() helper, replace triple && at L125 |
| 44 | token-seeder.ts | Rule 3 | Extract isValidJwtAccessToken() helper, replace triple && at L259 |
| 45 | injection-request-resolver.ts | Rule 3 | Extract isRawFieldsComplete(), replace triple && at L199 |
| 46 | open-tabs-handler.ts | Rule 3 | Extract isValidProjectProbe(), replace 4-part && at L185 |
| 47 | seed-plan-next.ts | Rule 3 | Extract isNoChangeBootDetected(), replace 4-part compound at L445 |
| 48 | api-namespace.ts | Rule 3 | Extract isExtensibleObject(), replace triple && at L122,134 |
| 49 | config-validator.ts | Rule 3 | Extract isInvalidThemePreset(), replace triple && at L172 |
| 50 | startup-global-handlers.ts | Rule 3 | Extract isReloadShortcut(), replace triple && at L67 |
| 51 | prompt-dropdown.ts | Rule 3 | Extract isNoFilterActive(), replace double negation at L402 |
| 52 | ws-members-chip-input.ts | Rule 3 | Extract isBackspaceOnEmptyWithChips(), replace compound at L96 |
| 53 | macro-db.ts | Rule 3 | Extract isValidDumpResponse(), replace triple && at L454 |
| 54 | prompt-revision-db.ts | Rule 3 | Extract isContextWithSlug(), replace triple && at L64 |
| 55 | rule-zero-validator.ts | Rule 3 | Extract isNextHeadingInSteps(), replace triple && at L142 |
| 56 | projects-cache.ts | Rule 3 | Extract isValidFiniteHeight(), replace triple && at L45 |
| 57 | injection-handler.ts | Rule 3 | Extract isForceRunOrSyntaxError(), fix L164 mixed polarity |
| 58 | injection-handler.ts | Rule 3 | Extract isCacheStale(), fix L182 mixed polarity |
| 59 | dynamic-require-handler.ts | Rule 3 | Extract isCrossProjectAccess(), fix L94 mixed polarity |
| 60 | file-storage-handler.ts | Rule 3 | Extract isInvalidProjectId(), fix L224 compound |
| 61 | injection-handler.ts | Rule 3 | Rename !allOk to isAnyFailed at L702 and L726 |
| 62 | config-auth-handler.ts | Rule 3 | Rename !hasSessionCookie to isSessionCookieMissing at L726 |
| 63 | prompt-handler.ts | Rule 3 | Extract isLegacyPromptsAbsent() from L322 compound |
| 64 | prompt-handler.ts | Rule 3 | Extract isNameOrTextMissing() from L498 compound |
| 65 | automation-chain-handler.ts | Rule 3 | Extract isChainDataInvalid() from L172 compound |
| 66 | dynamic-require-handler.ts | Rule 3 | Extract isTargetOrCallerMissing() from L57 compound |
| 67 | file-storage-handler.ts | Rule 3 | Extract isProjectIdOrFilenameInvalid() from L224 |
| 68 | grouped-kv-handler.ts | Rule 11 | DRY: extract requireGroupKey() shared guard function |
| 69 | grouped-kv-handler.ts | Rule 3 | Replace all !group, !key negations using requireGroupKey() |
| 70 | kv-handler.ts | Rule 11 | DRY: reuse requireGroupKey() pattern |
| 71 | injection-toast.ts | Rule 8 | Replace magic number 350 with ANIMATION_DURATION_MS constant |
| 72 | injection-toast.ts | Rule 8 | Replace magic number 15000 with TOAST_TIMEOUT_MS constant |
| 73 | config-auth-handler.ts | Rule 8 | Replace magic number 3 with JWT_SEGMENT_COUNT constant |
| 74 | config-auth-handler.ts | Rule 8 | Replace magic number 20 with MIN_TOKEN_LENGTH constant |
| 75 | token-seeder.ts | Rule 8 | Replace magic number 20 with MIN_TOKEN_LENGTH constant (reuse from 74) |
| 76 | injection-handler.ts | Rule 9 | Move PipelineLine type to types file (defined twice in same file!) |
| 77 | injection-handler.ts | Rule 9 | Remove duplicate PipelineLine definition at L451 |
| 78 | injection-handler.ts | Rule 9 | Move inline Array<{msg, level}> type at L693 to types file |
| 79 | config-auth-handler.ts | Rule 9 | Move any inline anonymous type shapes to types file |
| 80 | prompt-handler.ts | Rule 9 | Move any inline anonymous type shapes to types file |
| 81 | file-storage-handler.ts | Rule 11 | Extract requireDbManager() from repeated !dbManager pattern |
| 82 | grouped-kv-handler.ts | Rule 11 | Reuse requireDbManager() shared utility |
| 83 | library-handler.ts | Rule 11 | Reuse requireDbManager() shared utility |
| 84 | kv-handler.ts | Rule 11 | Reuse requireDbManager() shared utility |
| 85 | error-handler.ts | Rule 11 | Reuse requireDbManager() shared utility |
| 86 | prompt-handler.ts | Rule 11 | Reuse requireDbManager() shared utility |
| 87 | config-auth-handler.ts | Rule 14 | Convert !authToken repeated 3x to single const + early return |
| 88 | injection-handler.ts | Rule 14 | Convert let budgetMs = 500 to IIFE const pattern |
| 89 | injection-namespace-bootstrap.ts | Rule 14 | Convert let allConfigs = [] to const accumulator pattern |
| 90 | injection-namespace-bootstrap.ts | Rule 14 | Convert let nsScript / let fileCache to const patterns |
| 91 | config-auth-handler.ts | Rule 14 | Convert module-level let cache vars with documented exception |
| 92 | injection-toast.ts | Rule 14 | Convert let container = getElementById to const (re-read each time) |
| 93 | config-auth-handler.ts | Rule 14 | Convert let value = null pattern to const with early return |
| 94 | data-bridge-handler.ts | Rule 14 | Convert let count = 0 to reduce() accumulator (immutable) |
| 95 | data-bridge-handler.ts | Rule 14 | Convert let cleared = 0 to const result shape |
| 96 | injection-wrapper.ts | Rule 14 | Convert let version = "unknown" to const with fallback |
| 97 | dynamic-require-handler.ts | Rule 14 | Convert let version = "unknown" to const with fallback |
| 98 | automation-chain-handler.ts | Rule 14 | Convert let imported = 0 to immutable accumulator |
| 99 | injection-namespace-bootstrap.ts | Rule 14 | Audit all remaining let declarations for const conversion |
| 100 | injection-syntax-preflight.ts | Rule 14 | Convert let inlineCandidateCount, firstFailureId, firstFailureMessage to immutable reduce |
| 101 | config-auth-handler.ts | Rule 7 | Split 945-line file: extract token-validation.ts (JWT helpers) |
| 102 | config-auth-handler.ts | Rule 7 | Split: extract cookie-session-reader.ts |
| 103 | config-auth-handler.ts | Rule 7 | Split: extract auth-refresh-handler.ts |
| 104 | library-handler.ts | Rule 7 | Split 885-line file: extract library-asset-handler.ts |
| 105 | library-handler.ts | Rule 7 | Split: extract library-query-builder.ts |
| 106 | prompt-handler.ts | Rule 7 | Split 799-line file: extract prompt-crud-handler.ts |
| 107 | prompt-handler.ts | Rule 7 | Split: extract prompt-category-handler.ts |
| 108 | injection-handler.ts | Rule 7 | Split 740-line file: extract injection-pipeline-logger.ts |
| 109 | injection-handler.ts | Rule 7 | Split: extract injection-mirror-diagnostics.ts |
| 110 | token-seeder.ts | Rule 7 | Split 592-line file: extract token-jwt-validator.ts |
| 111 | token-seeder.ts | Rule 7 | Split: extract token-cookie-reader.ts |
| 112 | project-api-handler.ts | Rule 7 | Split 547-line file: extract project-schema-handler.ts |
| 113 | injection-toast.ts | Rule 7 | Split 432-line file: extract injection-loading-toast.ts |
| 114 | injection-pipeline.ts | Rule 7 | Split 434-line file: extract pipeline-hash-utils.ts |
| 115 | logging-handler.ts | Rule 7 | Split 424-line file: extract log-query-builder.ts |
| 116 | updater-handler.ts | Rule 7 | Split 428-line file: extract update-check-handler.ts |
| 117 | project-handler.ts | Rule 7 | Split 413-line file: extract project-crud-handler.ts |
| 118 | storage-browser-handler.ts | Rule 7 | Split 376-line file: extract storage-query-handler.ts |
| 119 | logging-export-handler.ts | Rule 7 | Split 305-line file: extract log-export-formatter.ts |
| 120 | open-tabs-handler.ts | Rule 7 | Split 307-line file: extract tab-probe-handler.ts |
