# Finish Plan 27 (Legacy Throw Migration) and Ship Release

Slug: plan-27-finish-and-release
Steps: 10 (5 shipped, 1 rescoped as N/A, 4 remaining)
Status: in-progress
Created: 2026-07-19
Reconciled: 2026-07-19 at v4.277.0

## Status log
- Steps 1, 2 shipped at v4.276.0 (bare-throw checker + CI wiring).
- Steps 4 (logDiagnostic helper), 5 (toast surface with code+hint), 6 (Vitest coverage: diagnostic-error/format/log-diagnostic/per-area-migration-coverage/error-codes-registry/error-utils-reexports, 829 LOC of tests) shipped earlier under Plan 26 and its follow-ups; verified present in `standalone-scripts/macro-controller/src/errors/` at v4.277.0. No new work required.
- Step 3 rescoped to N/A: `scripts/check-bare-throw.mjs` excludes `__tests__/`, `*.test.ts`, `*.spec.ts` by design; the remaining bare `throw new Error(...)` in fixtures are intentional test doubles simulating third-party failures (fetch reject, bridge down, boom sentinels). Migrating them to `DiagnosticError` would obscure the sentinel intent without any observability gain.
- Steps 7-10 (release ceremony) tracked below.

## Context

Plan 27 (`27-legacy-throw-migration.md`) has 7 steps pending (14-20): CI bare-throw checks, test fixture migrations, logging wiring, and user-visible diagnostics surface. Recent prompt updates (`17-write-memory` v2.0.0, `20-proof-read` v2.0.0, `24-pending-tasks` v1.0.0, `25-jokes-ideas-generate` v1.1.0) still need a MINOR release bundle. This plan closes both threads.

Related:
- `.lovable/plans/pending/27-legacy-throw-migration.md`
- `standalone-scripts/macro-controller/src/errors/error-codes.ts`
- `standalone-scripts/prompts/` (recently updated bodies)

No new commands or issues captured this turn.

## Steps

1. Add `scripts/check-bare-throw.mjs` that scans `standalone-scripts/macro-controller/src/**` for `throw new Error(` outside the `errors/` module and fails CI with file:line context. See ./subtasks/28-plan-27-finish-and-release/01-bare-throw-checker.md
2. Wire `check-bare-throw.mjs` into `pnpm lint:ci` and the CI workflow so regressions block merges.
3. Migrate remaining test fixtures under `standalone-scripts/macro-controller/src/**/__tests__/` that still construct raw `Error(...)` for expected diagnostics to use `DiagnosticError` codes.
4. Add a `logDiagnosticError(err, ctx)` helper in `errors/diagnostic-logger.ts` that formats `code`, `variables`, and `hint` into the namespace logger, and route the top 5 catch sites through it.
5. Surface diagnostic codes to the user by rendering `err.code` and `err.hint` in the existing toast helper used by Plan/Next editor and Repair action.
6. Add Vitest coverage for the new logger helper and toast surface (mock `Logger.error`, assert code + hint + variables serialized).
7. Update `changelog.md` with entries for prompt updates (17, 20, 24, 25) and Plan 27 completion under a new MINOR heading.
8. Bump `version.json` MINOR (v4.246.0), run `scripts/update-stale-version-refs.mjs`, then `scripts/check-version-sync.mjs`.
9. Run release preflight: `scripts/check-release-readiness.mjs` and `scripts/verify-release-manifest.mjs`; resolve any diff before tagging.
10. Move `27-legacy-throw-migration.md` and this plan to `.lovable/plans/completed/` with `Status: completed`, then post release summary.

## Verification

- CI: `pnpm lint:ci` green, new bare-throw check reports 0 hits.
- Tests: `pnpm test` green including new logger + toast coverage.
- Release: `check-version-sync.mjs` and `verify-release-manifest.mjs` both exit 0; `changelog.md` diff shows v4.246.0 entry.
- Runtime: Trigger a Plan editor validation failure in preview and confirm toast shows `code` + `hint`.
- Filesystem: `.lovable/plans/completed/27-*.md` and `.lovable/plans/completed/28-*.md` exist; no duplicates in `pending/`.

## Appended from prior pending tasks

- Plan 27 steps 14-20 (rolled into steps 1-6 above).
- No other unresolved pending plans require merging; open issues (`.lovable/issues/open/01-08`) are tracked separately and out of scope for this MINOR.
