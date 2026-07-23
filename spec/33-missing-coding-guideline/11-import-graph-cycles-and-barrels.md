# 11. Import-graph Cycles & Barrel-file Audit

Scope: `standalone-scripts/` TypeScript sources. Tool: `madge --circular` and `madge --orphans` against each package's `src/`.

## Headline numbers

| Package              | Files | Circular chains |
| -------------------- | ----- | --------------- |
| lovable-common       | ~30   | 0               |
| lovable-dashboard    | ~40   | 0               |
| lovable-owner-switch | ~70   | 0               |
| lovable-user-add     | ~70   | 0               |
| marco-sdk            | ~20   | 0               |
| **macro-controller** | 498   | **57**          |

All cycles are confined to `macro-controller/src`. Every other standalone package is cycle-clean.

## Cycle hotspots (files appearing in the most chains)

| Rank | File                                        | Cycles touched |
| ---- | ------------------------------------------- | -------------- |
| 1    | `core/MacroController.ts`                   | 18             |
| 2    | `db/macro-db.ts`                            | 11             |
| 3    | `ui/ui-updaters.ts`                         | 10             |
| 3    | `logging.ts`                                | 10             |
| 3    | `api-namespace.ts`                          | 10             |
| 6    | `ui/prompt-utils.ts`                        | 9              |
| 6    | `ui/prompt-loader.ts`                       | 9              |
| 8    | `seed/seed-plan-next.ts`                    | 8              |
| 8    | `loop-engine.ts`, `loop-controls.ts`        | 8 each         |
| 8    | `log-csv-export.ts`                         | 8              |
| 8    | `db/project-chat-submit-db.ts`              | 8              |
| 8    | `credit-fetch.ts`                           | 8              |
| 8    | `capture/chat-submit-{capture,rename-backfill}.ts` | 8 each  |

## Cycle clusters (root causes, not symptoms)

1. **God-module `core/MacroController.ts`** (18 chains). It imports `ui/ui-updaters` which re-imports `loop-engine` -> `loop-controls` -> `loop-cycle` -> `credit-balance` -> back through `api-namespace` -> `MacroController`. Root cause: the controller both *owns* subsystem state and is *consumed* by leaf UI updaters. Fix: extract a `core/controller-state.ts` value module the leaves import; keep `MacroController` at the top of the DAG.
2. **`db/macro-db.ts` <-> `seed/seed-plan-next.ts`** (11 chains). The DB bootstrap calls the seeder, and the seeder pulls schema helpers back out of `macro-db`. Fix: move `seedPlanNextPrompts()` invocation to a bootstrap file that imports both, so `macro-db.ts` stops depending on `seed/`.
3. **`logging.ts` <-> `log-csv-export.ts` <-> `credit-balance-update/*` <-> `auth.ts`** (10 chains). The logger imports CSV export, which imports the credit resolver, which imports auth, which imports auth-recovery, which imports `async-utils` -> `interval-registry` -> `logging`. Fix: `logging.ts` must be a leaf. Move CSV export out of it (`log-csv-export.ts` should import `logging`, not the other way around).
4. **`ui/prompt-loader` <-> `ui/prompt-utils` <-> `capture/chat-submit-*` <-> `db/*` <-> `seed/*` <-> `ui/plan-task-ui.ts`** (9+ chains). Prompt UI imports capture, which imports the same DB used by seed, which imports UI back for defaults. Fix: introduce `db/prompt-defaults.ts` (already partly in place from Plan-15) as the shared leaf; forbid `db/*` -> `ui/*` edges.
5. **`ws-*` cluster: `ws-list-renderer` -> `credit-fetch` -> `api-namespace` -> `MacroController` -> `ws-selection-ui` -> back to `ws-*`** (7 chains). Same god-module pattern as (1).
6. **`toast.ts` <-> `ui/error-overlay.ts` <-> `ui/prompt-loader.ts`** (3 chains). Toast should be a leaf; error overlay owning prompt loader is the inversion.
7. **Small pairwise cycles** (13 chains): `rename-api <-> rename-bulk`, `panel-builder <-> panel-header/sections/controls`, `database-modal-data <-> database-data-filter`, `save-prompt <-> save-prompt-dropdown`, `settings-ui <-> settings-tab-panels`, `section-auth-diag <-> auth-diag-rows`, `database-json-tab <-> database-json-migrate`, `task-next-ui <-> lovable-idle`. Fix per pair: extract the shared type/state into a third leaf module.

## Barrel-file inventory

22 `index.ts` files across `standalone-scripts/`. Only 3 are true re-export barrels (`export *`):

- `standalone-scripts/lovable-owner-switch/src/ui/index.ts`
- `standalone-scripts/lovable-user-add/src/ui/index.ts`
- `standalone-scripts/macro-controller/src/types/index.ts`

The `macro-controller/src/types/index.ts` barrel is the single largest unused-export source (90 dead re-exports; see audit 12). It re-exports every internal type, most consumed only by tests. Recommendation: remove `export *`, add named exports only for the types crossing package boundaries.

The other 19 `index.ts` files are entry points (not barrels), no action.

## Verification signal

```
$ npx madge --circular --extensions ts standalone-scripts/macro-controller/src
Found 57 circular dependencies!
$ for p in lovable-common lovable-dashboard lovable-owner-switch lovable-user-add marco-sdk; do
    npx madge --circular --extensions ts standalone-scripts/$p/src
  done
No circular dependency found!  (x5)
```

## Proposed enforcement (companion rules, see audit 16)

- `eslint-plugin-import/no-cycle` with `maxDepth: 10` on `standalone-scripts/macro-controller/src/**` (currently disabled).
- Ban `export *` under `standalone-scripts/**` via `no-restricted-syntax` (exception list in the rule).
- CI check: `madge --circular` must report **0** for every package; fail build otherwise.

## Priority backlog (rolled up to 99-backlog)

- **P0**: Break cluster (1) `MacroController` god-module and cluster (3) `logging.ts` leaf inversion. These two account for 28 of 57 chains.
- **P1**: Cluster (2) DB<->seed, cluster (4) prompt UI<->DB, cluster (5) `ws-*`.
- **P2**: 13 pairwise cycles (mechanical extraction).
