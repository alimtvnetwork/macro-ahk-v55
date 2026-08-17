# Guideline Audit Observations - 2026-08-17

> Audit date: 2026-08-17T12:50:00Z
> Auditor: Self-loop (no subagents)
> Scope: src/background/handlers/, standalone-scripts/macro-controller/src/

---

## Rule 1 Violations: Functions over 15 lines

### Oversized Files (violate Rule 7: 100-line file cap)

#### src/background/handlers/ (all files over 100 lines)
| File | Lines | Severity |
|------|-------|----------|
| config-auth-handler.ts | 945 | CRITICAL |
| library-handler.ts | 885 | CRITICAL |
| prompt-handler.ts | 799 | CRITICAL |
| injection-handler.ts | 740 | CRITICAL |
| token-seeder.ts | 592 | HIGH |
| project-api-handler.ts | 547 | HIGH |
| injection-toast.ts | 432 | HIGH |
| updater-handler.ts | 428 | HIGH |
| injection-pipeline.ts | 434 | HIGH |
| logging-handler.ts | 424 | HIGH |
| project-handler.ts | 413 | HIGH |
| storage-browser-handler.ts | 376 | HIGH |
| logging-export-handler.ts | 305 | HIGH |
| open-tabs-handler.ts | 307 | HIGH |
| automation-chain-handler.ts | 301 | HIGH |
| data-bridge-handler.ts | 333 | HIGH |
| prompt-chain-handler.ts | 256 | MEDIUM |
| recorder-step-handler.ts | 257 | MEDIUM |
| settings-handler.ts | 219 | MEDIUM |
| injection-request-resolver.ts | 240 | MEDIUM |
| injection-namespace-bootstrap.ts | 261 | MEDIUM |
| injection-wrapper.ts | 210 | MEDIUM |
| file-storage-handler.ts | 251 | MEDIUM |
| error-handler.ts | 223 | MEDIUM |
| dynamic-require-handler.ts | 239 | MEDIUM |
| injection-dependency-builder.ts | 216 | MEDIUM |
| injection-syntax-preflight.ts | 196 | MEDIUM |
| sdk-selftest-handler.ts | 191 | MEDIUM |
| recorder-capture-handler.ts | 186 | MEDIUM |
| sdk-bridge-handler.ts | 204 | MEDIUM |
| script-info-handler.ts | 242 | MEDIUM |
| script-config-handler.ts | 290 | MEDIUM |
| storage-surfaces-handler.ts | 286 | MEDIUM |
| user-script-log-handler.ts | 222 | MEDIUM |
| kv-handler.ts | 167 | MEDIUM |
| grouped-kv-handler.ts | 180 | MEDIUM |
| handler-guards.ts | 165 | MEDIUM |
| xpath-handler.ts | 155 | MEDIUM |
| xpath-validation-handler.ts | 164 | MEDIUM |
| storage-handler.ts | 176 | MEDIUM |
| run-stats-handler.ts | 134 | MEDIUM |
| injection-result-builder.ts | 136 | MEDIUM |
| project-injection-status.ts | 127 | MEDIUM |
| schema-meta-handler.ts | 120 | MEDIUM |
| project-export-handler.ts | 111 | MEDIUM |

#### standalone-scripts/macro-controller/src/ui/ (all over 100 lines)
| File | Lines | Severity |
|------|-------|----------|
| next-inline-ui.ts | 1423 | CRITICAL |
| prompt-dropdown.ts | 1527 | CRITICAL |
| prompt-history-panel.ts | 1468 | CRITICAL |
| projects-modal.ts | 1389 | CRITICAL |
| prompt-injection.ts | 1356 | CRITICAL |
| repeat-loop-ui.ts | 1283 | CRITICAL |
| task-splitter-ui.ts | 1005 | CRITICAL |
| settings-tab-panels.ts | 1025 | CRITICAL |
| credit-totals-modal.ts | 876 | CRITICAL |
| prompt-io.ts | 824 | HIGH |
| prompt-import-modal.ts | 830 | CRITICAL |
| error-overlay.ts | 803 | CRITICAL |
| prompt-utils.ts | 851 | CRITICAL |
| prompt-editor.ts | 657 | HIGH |
| macro-ui.ts | 652 | HIGH |
| task-next-ui.ts | 681 | HIGH |
| prompt-loader.ts | 516 | HIGH |
| prompt-drag-order.ts | 514 | HIGH |
| tools-sections-builder.ts | 461 | HIGH |
| seed-diagnostics-panel.ts | 445 | HIGH |
| hot-reload-section.ts | 444 | HIGH |
| ui-status-renderer.ts | 433 | HIGH |
| panel-layout.ts | 659 | HIGH |
| panel-controls.ts | 642 | HIGH |
| panel-sections.ts | 340 | HIGH |
| menu-builder.ts | 372 | HIGH |
| ws-filter-menu.ts | 455 | HIGH |
| prompt-io-zip-stream.ts | 242 | MEDIUM |
| prompt-io-zip.ts | 228 | MEDIUM |
| prompt-io-dialog.ts | 284 | MEDIUM |
| prompt-cache.ts | 349 | HIGH |
| prompt-diff.ts | 189 | MEDIUM |

---

## Rule 3 Violations: Raw `!` negation in if-conditions (non-boolean-named variables)

### src/background/handlers/automation-chain-handler.ts
- L172: `if (!chain || !chain.name || !chain.slug)` — triple negation + compound
- L221: `if (!chainId)` — should extract `isChainIdMissing`
- L244: `if (!chainId)` — same pattern repeated (DRY violation)
- L270: `if (!Array.isArray(chains))` — should extract `isChainsMissing`

### src/background/handlers/config-auth-handler.ts
- L372: `if (!authToken)` — should extract `isAuthTokenMissing`
- L377: `if (!authToken)` — repeated negation
- L382: `if (!authToken)` — repeated negation (3x!)
- L592: `if (!raw)` — vague name, should be `isRawDataMissing`
- L679: `if (!url)` — should extract `isUrlMissing`
- L726: `if (!hasSessionCookie || !projectId)` — mixed positive/negative
- L738: `if (!response.ok)` — should extract `isResponseFailed`
- L885: `if (!canListCookies)` — use `isListCookiesProhibited`
- L599: `if (typeof token === "string" && token.startsWith("eyJ") && token.split(".").length === 3)` — triple `&&`, banned

### src/background/handlers/dynamic-require-handler.ts
- L57: `if (!target || !requesterProjectId || !tabId)` — triple negation compound
- L67: `if (!requester)` — should extract `isRequesterMissing`
- L74: `if (!requester.settings?.allowDynamicRequests)` — negating method call
- L85: `if (!resolved)` — should extract `isResolutionFailed`
- L94: `if (!targetProject.isGlobal && targetProject.id !== requesterProjectId)` — compound condition

### src/background/handlers/file-storage-handler.ts
- L45: `if (!dbManager)` — repeated pattern, extract `isDbManagerMissing`
- L77: `if (!projectId)`, L81: `if (!filename)`, L123: `if (!fileId)`, L162: `if (!projectId)`, L199: `if (!fileId)`, L224: `if (!projectId || typeof projectId !== "string")` — mass raw negations

### src/background/handlers/grouped-kv-handler.ts
- L34: `if (!dbManager)` — extract `isDbManagerMissing`
- L51,55,83,87,113,117,137,167: repeated `if (!group)` and `if (!key)` patterns — DRY violation

### src/background/handlers/injection-dependency-builder.ts
- L23: `if (!activeId)` — extract `isActiveIdMissing`
- L28: `if (!activeProject)` — extract `isActiveProjectMissing`
- L53,101: `if (!relevantIds.has(sub.projectId))` — negating method call
- L117: `if (!depProject?.scripts?.length)` — should extract `isDependencyScriptsMissing`

### src/background/handlers/injection-handler.ts
- L164: `if (!isForceRun && !hasInlineSyntaxError)` — double negation compound (mixed polarity banned)
- L182: `if (cachedPayload && !cacheMatchesRequest)` — mixed positive/negative in same condition (banned by Rule 3)
- L686: `if (!r)` — too short a name, vague
- L702: `if (!allOk)` — should use `isAnyFailed` semantically
- L726: `if (!allOk)` — repeated

### src/background/handlers/injection-namespace-bootstrap.ts
- L39: `if (!win.RiseupAsiaMacroExt)` — should extract
- L43: `if (!ext.Projects)` — should extract
- L91: `if (!_llmGuideCache.has(guideKey))` — negating method call
- L128,133,156: repeated negation patterns

### src/background/handlers/library-handler.ts
- L52: `if (!dbManager)` — repeated pattern
- L211: `if (!asset)` — extract `isAssetMissing`
- L330: `if (!link)` — extract `isLinkMissing`
- L538: `if (!group)` — extract `isGroupMissing`
- L686: `if (!settingsJson)` — extract `isSettingsJsonMissing`

### src/background/handlers/project-api-handler.ts
- L79,83,88: `if (!slug)`, `if (!endpoint)`, `if (!hasProjectDb(slug))` — raw negations
- L228,233,245,277: repeated negation guards

### src/background/handlers/prompt-handler.ts
- L64: `if (!dbManager)` — extract
- L163: `if (!trimmed)` — extract `isTrimmedEmpty`
- L197: `if (!categoryId)` — extract `isCategoryIdMissing`
- L322: `if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0)` — compound
- L498: `if (!name || !text)` — compound negation
- L706,766: `if (!Number.isFinite(numId))` — negating method call

### src/background/handlers/token-seeder.ts
- L96: `if (!isSupportedTab)` — acceptable (named boolean) BUT `isSupportedTab` is negative
- L106: `if (!hasTabAccess)` — should use `isTabAccessDenied`
- L234,240,245: `if (!key)`, `if (!isSupabaseKey)`, `if (!raw || raw.length < 20)` — raw negations
- L308: `if (!hasPermission)` — should use `isPermissionDenied`
- L316: `if (!canExecuteScript)` — should use `isScriptExecutionBlocked`
- L125: `if (sessionLookup.value !== null && sessionLookup.value.startsWith("eyJ") && sessionLookup.value.split(".").length === 3)` — triple &&, banned

---

## Rule 3 Violations: standalone-scripts/macro-controller/src/

### standalone-scripts/macro-controller/src/ui/prompt-editor.ts
- L201: `if (!rc)` — vague name `rc`, should be descriptive + no `!`
- L249,269: `if (!seed)` — repeated, extract `isSeedMissing`
- L382: `if (!isClean)` — should use `isDirty`
- L642: `if (!row)` — extract `isRowMissing`

### standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts
- L349: `if (!entries.length)` — extract `isEntriesEmpty`
- L368: `if (!container.hasAttribute('data-prompts-dropdown'))` — negating method call
- L402: `if (!getPromptCategoryFilter() && !_currentSearchQuery)` — double negation compound
- L536: `if (!header)` — extract `isHeaderMissing`
- L630: `if (!resolved)` — extract `isResolutionFailed`
- L656: `if (!p.text)` — extract `isTextEmpty`
- L725: `if (!confirm(...))` — negating function call
- L1013: `if (!n || n < 1 || n > 999)` — compound multi-condition
- L1160: `if (!p.slug)` — extract `isSlugMissing`
- L1301: `if (!updated.name || !updated.text)` — compound negation

### standalone-scripts/macro-controller/src/seed/seed-plan-next.ts
- L151: `if (!bucket)` — extract `isBucketMissing`
- L264: `if (!row.isDefault)` — use `isRowNonDefault` or check `row.isAlternate`
- L407: `if (!match.isMatch)` — use semantic inverse `match.isMismatch`
- L445: `if (!isFailure && params.inserted === 0 && params.promoted === 0 && params.upgraded === 0)` — triple && compound banned

---

## Rule 3 Violations: Multiple `&&` / mixed polarity conditions

### src/background/handlers/config-auth-handler.ts
- L599: `if (typeof token === "string" && token.startsWith("eyJ") && token.split(".").length === 3)` — triple &&, extract to `isJwtToken(token)`
- L613: `if (key && key.startsWith("sb-") && key.includes("-auth-token"))` — triple &&, extract to `isSupabaseAuthKey(key)`

### src/background/handlers/token-seeder.ts
- L125: `if (sessionLookup.value !== null && sessionLookup.value.startsWith("eyJ") && sessionLookup.value.split(".").length === 3)` — triple &&, extract to `isJwtSessionValue(sessionLookup.value)`
- L259: `if (session?.access_token && typeof session.access_token === "string" && session.access_token.startsWith("eyJ"))` — triple &&, extract to `isValidJwtAccessToken(session)`

### src/background/handlers/injection-request-resolver.ts
- L199: `if (fields.rawPath !== null && fields.rawOrder !== null && !fields.hasCodeKey)` — triple && with mixed polarity

### src/background/handlers/open-tabs-handler.ts
- L185: `if (projectId === null && probePayload && typeof probePayload.projectId === "string" && probePayload.projectId !== "")` — 4-part && compound

### standalone-scripts/macro-controller/src/seed/seed-plan-next.ts
- L445: 4-part compound condition with && and negation

### standalone-scripts/macro-controller/src/*.ts
- api-namespace.ts L122,L134: `if (child && typeof child === 'object' && !Object.isExtensible(child))` — triple &&
- config-validator.ts L172: triple &&
- startup-global-handlers.ts L67: triple &&

---

## Rule 4 Violations: Booleans without is/has prefix

### src/background/handlers/automation-chain-handler.ts
- L275: `let imported = 0` — not a boolean but named without proper tracking flag

### src/background/handlers/config-auth-handler.ts
- L127: `let isRefreshing = false` — OK (has is prefix) but flag is used for mutation (let)
- Multiple `let` flags that should be extracted as named `isX` guard constants

### src/background/handlers/data-bridge-handler.ts
- L104: `let count = 0` — not named for boolean extraction
- L263: `let cleared = 0` — not a boolean but should be tracked as flag

---

## Rule 7 Violations: Mutation (let instead of const)

### src/background/handlers/injection-toast.ts
- L50: `let loaderTimer` — mutable timer variable (legitimate for cleanup)
- L72: `let container` — mutable reassignment
- L121,122: `let dismissTimer`, `let removeTimer` — multiple timers
- L198,220,280,281,350,400,401: same pattern repeated in 3 different toast functions

### src/background/handlers/injection-handler.ts
- L341,463: `let budgetMs = 500` — immediately reassigned in try-catch (could be const + IIFE)

### src/background/handlers/injection-namespace-bootstrap.ts
- L99: `let script = getSettingsNsCache(settingsHash)` — reassigned at L100
- L163: `let allConfigs` — reassigned at L178
- L195: `let nsScript = cachedScripts.get(pid)` — reassigned
- L197: `let fileCache` — mutated in loop

### src/background/handlers/config-auth-handler.ts
- L124,125,126,127: module-level `let` cache variables — appropriate for module cache but violate rule
- L365: `let authToken: string | null = null` — should be const + return early pattern
- L861: `let value: string | null = null` — initialized then conditionally assigned

---

## Rule 8 Violations: Magic numbers/strings

### src/background/handlers/injection-toast.ts
- L422: `removeTimer = setTimeout(cleanup, 350)` — magic number 350 (was `Timings.ANIMATION_DURATION`)
- L15000 reference was replaced with literal earlier in session

### src/background/handlers/config-auth-handler.ts
- L599: `token.split(".").length === 3` — magic number 3 (JWT segments)
- L245: `raw.length < 20` — magic number 20 (minimum token length)

---

## Rule 11: DRY violations (repeated patterns)

### src/background/handlers/
- `if (!dbManager)` pattern repeated verbatim across: file-storage-handler.ts, grouped-kv-handler.ts, library-handler.ts, kv-handler.ts, error-handler.ts, prompt-handler.ts — at least 6 files, same guard
- `if (!authToken)` repeated 3x consecutively in config-auth-handler.ts L372-382

---

## Rule 9 Violations: Types defined inline

### src/background/handlers/injection-handler.ts
- L302: `type PipelineLine = { "msg": string; level: PipelineLineLevelType }` — defined inline, should be in types file
- L451: Same `PipelineLine` type defined again in same file — DRY violation too
- L693: `Array<{ "msg": string; level: MirrorDiagnosticToTabLevelType }>` — inline anonymous type

---

## Summary Statistics

| Category | Files Affected | Violation Instances |
|----------|---------------|---------------------|
| Rule 7: File >100 lines | 80+ files | 80+ |
| Rule 3: Raw `!` negation | 15+ files | 100+ |
| Rule 3: Compound && (>2) | 10+ files | 20+ |
| Rule 3: Mixed polarity | 5+ files | 10+ |
| Rule 4: Boolean no prefix | 3+ files | 5+ |
| Rule 14: let mutation | 5 files | 25+ |
| Rule 8: Magic numbers | 3 files | 5+ |
| Rule 11: DRY violations | 6 files | 15+ |
| Rule 9: Inline types | 1 file | 3 |
| **Total** | **~30 files** | **~260+ instances** |
