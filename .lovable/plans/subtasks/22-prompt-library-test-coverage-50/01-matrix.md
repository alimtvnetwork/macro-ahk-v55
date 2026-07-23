# Plan 22 - Target Test Matrix (reconciled to actual file layout)

Created: 2026-07-19
Version pinned when authored: v4.278.0

## File-layout reconciliation vs the Plan 22 body

The original plan text referenced a `db/` subfolder split (`db/schema.ts`, `db/role-scope.ts`, `db/prompt-crud.ts`, `db/token-parity.ts`). The actual code lives flat under `standalone-scripts/macro-controller/src/db/`:

| Plan-22 file (as written) | Actual file on disk |
| --- | --- |
| `db/schema.ts` | `db/macro-db.ts` (schema init lives here) + `db/prompt-db.ts` (Prompt table DDL) |
| `db/role-scope.ts` | `db/prompt-role-db.ts` (role-scoped CRUD lives here) |
| `db/prompt-crud.ts` | `db/prompt-db.ts` (single CRUD surface) |
| `db/token-parity.ts` | `db/prompt-token-guard.ts` + `db/rule-zero-validator.ts` |

The remaining top-level targets (`prompt-defaults.ts`, `token-substitute.ts`, `prompt-io.ts`, `prompt-io-db-bridge.ts`, `seed-plan-next.ts`) exist as named in the plan.

## Existing coverage inventory

Under `standalone-scripts/macro-controller/src/db/__tests__/`:

- `prompt-db.test.ts` (baseline CRUD)
- `prompt-db-crud-boundary.test.ts` (boundary/negative)
- `prompt-db-rename.test.ts` (rename flow)
- `prompt-role-db.test.ts` (role-scoped CRUD, positive)
- `prompt-role-scope-validation.test.ts` (role-scope negative)
- `prompt-schema-migration.test.ts` (schema migrations)
- `prompt-defaults.test.ts` (defaults)
- `prompt-revision-db.test.ts` (revision history)
- `prompt-token-guard.test.ts` (token parity)
- `rule-zero-validator.test.ts` (Rule 0)
- `project-chat-submit-db.test.ts` (unrelated to Plan 22 scope)

## Gap matrix (method x {positive, negative, integration})

Legend: `+` present, `-` missing, `~` partial.

| Target                                    | positive | negative | integration |
| ----------------------------------------- | :------: | :------: | :---------: |
| `db/prompt-db.create`                     |    +     |    +     |      +      |
| `db/prompt-db.update`                     |    +     |    ~     |      -      |
| `db/prompt-db.deleteBySlug`               |    +     |    -     |      -      |
| `db/prompt-role-db.getForRole`            |    +     |    +     |      ~      |
| `db/prompt-role-db.upsertForRole`         |    +     |    -     |      -      |
| `db/prompt-token-guard.assertTokens`      |    +     |    +     |      -      |
| `db/rule-zero-validator.validate`         |    +     |    +     |      ~      |
| `prompt-defaults.getDefaultBody`          |    ~     |    -     |      -      |
| `prompt-defaults.upgradeLegacyBodyForRow` |    +     |    ~     |      +      |
| `token-substitute.substituteTokens`       |    +     |    ~     |      -      |
| `prompt-io.exportBundle`                  |    +     |    -     |      -      |
| `prompt-io.importBundle`                  |    +     |    +     |      ~      |
| `prompt-io-db-bridge.applyBundle`         |    ~     |    -     |      -      |
| `seed-plan-next.seedPlanNextPrompts`      |    +     |    ~     |      +      |
| `ui/plan-task-ui.render`                  |    +     |    -     |      -      |
| `ui/task-next-ui.render`                  |    +     |    -     |      -      |

## Priority-ordered gap list (drives steps 6-50)

1. `update` negative-path (duplicate slug on rename, invalid role, row missing).
2. `deleteBySlug` negative (unknown slug) + integration (default row is restored by seed on next boot).
3. `upsertForRole` negative (bad role, token-parity failure blocks write).
4. `token-guard` integration (guard fires during upsert, not only at read time).
5. `rule-zero-validator` integration (invalid `{{n}}` count surfaces via UI toast, not silently).
6. `prompt-defaults.getDefaultBody` negative (unknown role/slug -> DiagnosticError, not empty string).
7. `substituteTokens` negative (`{{n}}` missing/zero/non-integer -> DiagnosticError).
8. `exportBundle` negative (empty DB emits empty-but-valid bundle, not throw).
9. `importBundle` integration (bundle -> DB -> UI reflect within same tick).
10. `applyBundle` positive + negative (schema-version mismatch, unknown entry field).
11. `seed-plan-next` negative (audit row still written when insert throws mid-batch).
12. UI negative paths for `plan-task-ui` and `task-next-ui`: DB empty, DB row corrupt, DB unavailable.

## Vitest pickup (Plan 22 step 5)

`vitest.config.ts` glob covers `standalone-scripts/**/__tests__/**/*.test.ts` -- confirmed via `grep -n "include" vitest.config.ts`. New test files added under `standalone-scripts/macro-controller/src/**/__tests__/` will be discovered automatically; no config change required.

## Estimated per-gap cost

12 gaps x average 2 test cases + fixtures = ~24-30 new `it()` blocks, ~800-1000 LOC across 8-10 new test files. Fits inside the remaining 45 Plan-22 steps without inflation.
