# Project Memory

## Core
- **Timezone**: NEVER hardcode a timezone. Use the user's local timezone at render time (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Store UTC, render local.
- **Read-only folders**: Never modify `skipped/` or `.release/` folders.
- **No Supabase**: Supabase is strictly forbidden (auth, tokens, SDKs, localStorage).
- **No Plan 10**: Plan 10 unified-billing-all-workspaces is rejected.
- **No Storage PascalCase Migration**: Phase 2c-storage v2 is strictly forbidden.
- **Versioning**: The GIT TAG `vX.Y.Z` is the SOLE source of truth for the release version. `version.json` is a build-time artifact.
- **No version-specific workflow tests**: Never require historical version tags or disabled auditor asset lists in CI tests.
- **Linting**: Zero ESLint warnings/errors; modular architecture.
- **Restricted identifiers**: Never use `arr`, `cb`, `fn`, `el`, `msg`, `ctx`, `obj`, `val`.
- **Code Red Logging**: All file/path errors MUST include exact path, missing item, and reasoning.
- **Namespace Logging**: Use `RiseupAsiaMacroExt.Logger.error()`, never bare `log()`.
- **Dark Theme Enforced**: Dark-only theme. No light mode or theme toggles.
- **No-Retry Policy**: Bans unauthorized recursive retry or exponential backoff.
- **No Explicit Unknown**: No `unknown` except in `CaughtError`.
- **Error Handling**: Defensive property access (`?.`, `??`) required. CQ14 (braces), CQ15 (newlines).
- **Test-with-features**: Every new feature/fix ships with matching tests.
- **readme.txt**: STRICTLY PROHIBITED to auto-write any time/clock/git-update value.
- **Verbose logging gate**: Per-project `Project.VerboseLogging` (default OFF).
- **No-Questions Mode**: Log ambiguities to `.lovable/ambiguous-questions/`.
- **`next` command**: Always DO the next task in the same turn. End with a flat numbered list.
- **"next prompt" / "plan prompt"**: Edits the button BODY text in `standalone-scripts/prompts/`.
- **CI push trigger unfiltered**: `.github/workflows/ci.yml` MUST use bare `on: push:`.
- **Loop iteration cap 250**: Hard-capped at 250 iterations for all loops.
- **Em dashes banned**: Never use em dashes (—) in any output. Use commas, colons, or parentheses.

## Memories
- [Latest release policy](mem://constraints/latest-release-must-be-complete)
- [Dropdown prompts registry](mem://prompts/dropdown-prompts-registry)
- [Timezone](mem://localization/timezone)
- [Versioning policy](mem://workflow/versioning-policy)
- [Tag = version](mem://spec/commands/05-tag-is-single-source-of-truth-for-version)
- [Release pipeline agnostic](mem://features/release-pipeline-repo-url-agnostic)
- [Release ceremony](mem://workflow/release-ceremony)
- [Planning roadmap](mem://workflow/planning-roadmap)
- [File naming convention](mem://workflow/file-naming-convention)
- [Spec organization](mem://architecture/spec-organization)
- [Task execution pattern](mem://workflow/task-execution-pattern)
- [Linting policy](mem://architecture/linting-policy)
- [Restricted identifiers](mem://standards/restricted-identifiers-and-function-size)
- [Unit test contracts](mem://standards/unit-test-contracts)
- [Extension startup UX](mem://features/extension-startup-ux)
- [Data storage layers](mem://architecture/data-storage-layers)
- [Auth bridge service](mem://architecture/auth-bridge-service)
- [Dynamic script loading](mem://architecture/dynamic-script-loading)
- [Instruction dual-emit](mem://architecture/instruction-dual-emit-phase-2b)
- [Extension error management](mem://architecture/extension-error-management)
- [Real-time error sync](mem://architecture/real-time-error-synchronization)
- [Self-healing script storage](mem://architecture/self-healing-script-storage)
- [Log diagnostics export](mem://features/log-diagnostics-export)
- [Dark-only theme](mem://preferences/dark-only-theme)
- [No-Questions Mode](mem://workflow/no-questions-mode)
- [Webhook fail-fast](mem://constraints/webhook-fail-fast)
- [Workspace move v2](mem://features/workspace-move-membership-endpoint-v2)
- [Timer teardown](mem://standards/timer-and-observer-teardown)
- [Refill priority filter](mem://features/refill-priority-filter)
- [GitHub repo open](mem://features/workspace-github-repo-open)
- [Prompt Macros engine](mem://features/prompt-macros)
- [Prompt Variables](mem://features/prompt-variables)
- [Repeat-loop chat submit](mem://features/macro-controller/repeat-loop-chat-submit)
- [SQL bridge adaptive rawSql](mem://features/sql-bridge-adaptive-rawsql)
- [Prompts import/export user-scope](mem://features/prompts-import-export-user-scope)
- [Read Memory Enhanced v1.7](mem://prompts/read-memory-enhanced)
- [Write Memory Enforcement v3.0](mem://prompts/write-memory-enforcement)

## Specs
- [01-workspace-move-v2](mem://specs/01-workspace-move-v2) - Membership-scoped PUT /workspaces/{wsId}/memberships/{userId}
- [02-token-substitute-patch](mem://specs/02-token-substitute-patch) - Defensive patch for residual {{n}} tokens
- [03-sql-bridge](mem://specs/03-sql-bridge) - Adaptive rawSql bridge for prompt failures

## Workflow
- [21-session-2026-08-06-write-memory-enforcement](mem://workflow/21-session-2026-08-06-write-memory-enforcement) - Maximum enforcement v3.0 implemented.
