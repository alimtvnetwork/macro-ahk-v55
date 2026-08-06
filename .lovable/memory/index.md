# Project Memory Index

## Topic Index
- [Architecture](.lovable/memory/architecture/)
- [Audit](.lovable/memory/audit/)
- [Auth](.lovable/memory/auth/)
- [Constraints](.lovable/memory/constraints/)
- [Development](.lovable/memory/development/)
- [Features](.lovable/memory/features/)
- [Localization](.lovable/memory/localization/)
- [Performance](.lovable/memory/performance/)
- [Preferences](.lovable/memory/preferences/)
- [Project](.lovable/memory/project/)
- [Prompts](.lovable/memory/prompts/)
- [RCA](.lovable/memory/rca/index.md)
- [Security](.lovable/memory/security/)
- [Specs](.lovable/memory/specs/)
- [Standards](.lovable/memory/standards/)
- [Style](.lovable/memory/style/)
- [Suggestions](.lovable/memory/suggestions/)
- [Testing](.lovable/memory/testing/)
- [UI](.lovable/memory/ui/)
- [Workflow](.lovable/memory/workflow/)

## Core Rules
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
- **Em dashes banned**: Never use em dashes (-) in any output. Use commas, colons, or parentheses.

## Recent Workflow
- [24-session-2026-08-06-release-v5-19-0](.lovable/memory/workflow/24-session-2026-08-06-release-v5-19-0.md) - Release ceremony v5.19.0 performed with remote-tag hardening.
- [21-session-2026-08-06-write-memory-enforcement](.lovable/memory/workflow/21-session-2026-08-06-write-memory-enforcement.md) - Maximum enforcement v3.0 implemented.
- [22-session-2026-08-06-memory-restructure](.lovable/memory/workflow/22-session-2026-08-06-memory-restructure.md) - Global .lovable folder restructure and audit.