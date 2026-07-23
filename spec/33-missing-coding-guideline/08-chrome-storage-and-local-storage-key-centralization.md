# 08 - Storage Key Centralization Audit

**Plan-16 · Task 10 · v4.83.0 · 2026-07-17**

Scope: `standalone-scripts/**` production `.ts` (excludes `**/__tests__/**`, `**/dist/**`, `**/node_modules/**`).

Rule sources:
- `spec/02-coding-guidelines/**` (constant naming): storage identifiers must live in a single, typed, named-constant module (`StorageKey`-style enum) and never be inline string literals at call sites.
- `mem://architecture/constant-naming-convention` - SCREAMING_SNAKE_CASE prefixes, single source of truth.
- `mem://architecture/data-storage-layers` - four storage layers, of which `localStorage` and `chrome.storage.local` are user-tier and MUST be key-namespaced.
- Existing canonical file: `standalone-scripts/macro-controller/src/types/storage-keys.ts` (`enum StorageKey`).

## Methodology (deterministic, re-runnable)

```bash
cd standalone-scripts
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' \
  "chrome\.storage\.local\.(get|set|remove)\("
rg -n --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' \
  "localStorage\.(getItem|setItem|removeItem)\(['\"]"
rg -c --no-heading -g '*.ts' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/node_modules/**' \
  'StorageKey\.'
```

## Denominators

| Signal | Count |
|---|---|
| `chrome.storage.local.(get\|set\|remove)` production call sites | 4 |
| `localStorage.(getItem\|setItem\|removeItem)` production call sites | ~90 (across 21 files) |
| `localStorage.*("…")` inline **string-literal** keys | 15 (across 8 files) |
| Files importing `StorageKey` enum | 12 (30 uses) |
| Keys currently declared in `StorageKey` enum | 19 |

## Finding S-1 - `chrome.storage.local` is compliant (P3, no action)

Only 4 call sites and both consumers use a module-local `STORAGE_KEY` / `COLLAPSED_STORAGE_KEY` constant:

- `macro-controller/src/settings-store.ts:229,252` - `STORAGE_KEY`.
- `macro-controller/src/ui/projects-modal.ts:103,116` - `COLLAPSED_STORAGE_KEY`.

Both constants are declared once per file and never re-inlined. This satisfies the rule, but they are **not** yet in `types/storage-keys.ts`. Recommendation (P2): move the two constants into `StorageKey` for a single source of truth and to make key collision detection possible at review time.

## Finding S-2 - `localStorage` inline string-literal keys (P0)

**15 raw string-literal keys** at 8 files bypass the `StorageKey` enum:

| File | Line | Literal | Suggested `StorageKey` addition |
|---|---|---|---|
| `macro-controller/src/ws-list-renderer.ts` | 121 | `'ml_credit_sort_mode'` | `CreditSortMode` |
| `macro-controller/src/ws-list-renderer.ts` | 153 | `'ml_refill_priority'` | `RefillPriority` |
| `macro-controller/src/ws-list-renderer.ts` | 164 | `'ml_credit_sort_mode'` | (dup of above) |
| `macro-controller/src/auth-resolve.ts` | 351 | `'marco_bearer_token'` | `BearerToken` |
| `macro-controller/src/auth-resolve.ts` | 352 | `'lovable-session-id'` | `LovableSessionId` |
| `macro-controller/src/workspace-cache.ts` | 105 | `'marco_last_workspace_name'` | `LastWorkspaceName` |
| `macro-controller/src/workspace-cache.ts` | 106 | `'marco_last_workspace_id'` | `LastWorkspaceId` |
| `macro-controller/src/workspace-cache.ts` | 112 | `'marco_last_workspace_name'` | (dup) |
| `macro-controller/src/workspace-cache.ts` | 116 | `'marco_last_workspace_id'` | (dup) |
| `macro-controller/src/ui/ws-filter-menu.ts` | 175 | `'ml_compact_mode'` | `CompactMode` |
| `macro-controller/src/shared-state-runtime.ts` | 142 | `'marco_custom_display_name'` | `CustomDisplayName` |
| `macro-controller/src/ui/panel-sections.ts` | 216 | `'ml_collapse_tools_master'` | `CollapseToolsMaster` |
| `macro-controller/src/ui/section-auth-diag.ts` | 130 | `'ml_collapse_auth_diag'` | `CollapseAuthDiag` |
| `macro-controller/src/ui/settings-ui.ts` | 406 | `'marco_custom_display_name'` | (dup of runtime) |
| `macro-controller/src/ui/settings-ui.ts` | 408 | `'marco_custom_display_name'` | (dup) |

Distinct new keys required: **9**.

Impact:
1. **Key-collision risk**: `'marco_custom_display_name'` is declared in three places by string; a typo in one is a silent data loss.
2. **Refactor risk**: renaming the underlying key (e.g. namespace change from `ml_` → `marco_ui_`) requires 15 edits instead of 1.
3. **Test coverage gap**: `check-version-sync.mjs` / `audit-error-swallow.mjs`-style guards cannot enumerate keys without a single manifest.

## Finding S-3 - Two secret-adjacent keys are highest-priority (P0)

`macro-controller/src/auth-resolve.ts:351-352` writes the bearer token AND a session id via raw string literals. Even if the values are ultimately opaque, the **key** is the join point that other modules use to read them back. Any drift here fractures the `mem://auth/unified-auth-contract` guarantee ("single `getBearerToken()` path"). These two keys move first.

## Finding S-4 - Duplication signal (P1)

Five distinct literals are declared 2 or more times by string:

- `'marco_custom_display_name'` × 3 (runtime, settings-ui × 2).
- `'ml_credit_sort_mode'` × 2.
- `'marco_last_workspace_name'` × 2.
- `'marco_last_workspace_id'` × 2.

Duplication ratio for raw literals: 15 sites / 9 distinct keys = **1.67 sites per key**. Compliance target after remediation: 1.0 (every key referenced exactly once through the enum).

## Finding S-5 - `StorageKey` enum coverage vs. usage (P2)

Enum currently declares 19 keys and is referenced 30 times. Post-remediation projection:
- +9 new keys → 28 enum entries.
- +2 chrome.storage.local constants folded in → 30 entries.
- Total call sites migrated to enum: 30 → ~50.

At that point the enum becomes the **complete** manifest of user-tier storage keys, unlocking:
- A test that greps the codebase for any `localStorage.[a-z]+(['"]` and fails CI (i.e. lint rule this audit enables).
- A dev-tools panel that lists all keys + values without hard-coding them.
- A safe migration path if key naming convention changes (`ml_` vs `marco_`).

## Backlog rollup

| ID | Severity | Where | Effort |
|---|---|---|---|
| S-3 | P0 | `auth-resolve.ts:351-352` (2 keys, auth surface) | 15 min |
| S-2 | P0 | Remaining 13 inline literals (7 files, 7 new keys) | 45 min |
| S-4 | P1 | Deduplicate 5 keys with multiple call sites | folds into S-2 |
| S-1 | P2 | Move `settings-store.ts` + `projects-modal.ts` constants into enum | 15 min |
| S-5 | P2 | Add ESLint `no-restricted-syntax` rule banning inline `localStorage.*('literal')` outside `types/storage-keys.ts` | 30 min |

No source-code changes in this release. Follow-up commits handle S-3 → S-2 → S-4 → S-1 → S-5 in that order (auth-first).
