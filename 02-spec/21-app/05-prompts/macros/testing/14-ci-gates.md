# CI Gates

Every PR MUST pass all gates below. Workflow: `.github/workflows/ci.yml` (bare `on: push:` per `mem://constraints/ci-push-trigger-unfiltered`).

| Gate | Command | Pass criteria |
|---|---|---|
| `lint` | `npm run lint` | zero ESLint warnings/errors |
| `typecheck` | `npm run typecheck` | zero TS errors |
| `schemas:lint` | `node scripts/validate-schemas.mjs` | all 5 schemas valid draft-2020-12 |
| `tests:unit:macros` | `npx vitest run tests/unit/macros` | 24 passed |
| `tests:component:macros` | `npx vitest run tests/component/macros` | 12 passed |
| `tests:e2e:macros` | `npx playwright test tests/e2e/macros` | 10 passed |
| `audit:spec-compliance` | `node scripts/audit-spec-compliance.mjs` | zero violations of guards/10 matrix |
| `audit:error-swallow` | `node scripts/audit-error-swallow.mjs` | zero P0, P1≤5 |
| `audit:no-supabase` | `rg -i "supabase" src/ \| wc -l` | output = 0 |
| `audit:dark-only` | `rg "light-mode\|themeToggle" src/` | no matches |
| `version:sync` | `node scripts/check-version-sync.mjs` | manifest = constants = scripts |

## Failure behavior

- Any gate failure blocks merge.
- No retry on flake — flakes are bugs (`mem://constraints/no-retry-policy`).
- No CI notifications on success or failure (`mem://constraints/no-ci-notifications`).
