# Legacy `throw new Error(...)` → DiagnosticError migration (Plan 27)

Slug: legacy-throw-migration
Steps: 20
Status: completed
Created: 2026-07-19
Completed: 2026-07-19 (verified 0 bare throws across 631 macro-controller .ts files at v4.276.0)

## Context

Plan 26 (completed at v4.264.0) shipped the DiagnosticError taxonomy, error-code registry, CI gates, and per-area migration coverage. It intentionally allowlisted a set of legacy `throw new Error(...)` sites in `standalone-scripts/macro-controller/src/` so the taxonomy could ship without a giant blast-radius refactor. That allowlist now has to be drained: ~26 production files (plus a handful of test/adapter files that must stay `throw new Error` because they simulate failures) still bypass the registry, meaning some runtime failures still surface without codes, interpolation, or the professional diagnostic format enforced by `.lovable/spec/commands/04-professional-diagnostic-error-messages.md`.

The migration must land area-by-area, extending the registry with new codes where a call site has no matching entry, and updating `per-area-migration-coverage.test.ts` + `check-error-codes-unique.mjs` allowlists each time a file leaves the exemption list.

Related:
- `.lovable/plans/completed/26-professional-diagnostic-errors-20-step.md` (parent taxonomy)
- `.lovable/spec/commands/04-professional-diagnostic-error-messages.md` (contract)
- `standalone-scripts/macro-controller/src/errors/error-codes.ts` (registry)
- `standalone-scripts/macro-controller/scripts/check-error-codes-unique.mjs` (CI gate)
- `standalone-scripts/macro-controller/src/errors/__tests__/per-area-migration-coverage.test.ts`

No new commands or issues captured this turn (this is a planning turn on an existing backlog item).

## Steps

1. Enumerate the current allowlist of legacy `throw new Error(...)` files in `per-area-migration-coverage.test.ts` and cross-reference against `rg "throw new Error" standalone-scripts/macro-controller/src/` to produce an authoritative migration manifest at `.lovable/plans/subtasks/27-legacy-throw-migration/01-migration-manifest.md`. See ./subtasks/27-legacy-throw-migration/01-migration-manifest.md.
2. Classify each manifest entry into one of: PROD (must migrate), TEST-SIMULATION (permanent exemption, document why), REEXPORT (delegates to a migrated module, mark resolved). Update the manifest with the classification column.
3. For each PROD file, list every distinct failure mode and either map it to an existing registry code or reserve a new `AREA_VERB_ENNN` code. Land the reservations in `error-codes.ts` in one commit, no call-site edits yet.
4. Migrate `credit-fetch.ts`: swap every `throw new Error(...)` for `throwDiagnosticFromCode('CREDIT_FETCH_EXXX', {...})`, preserving cause chaining. Remove from allowlist.
5. Migrate `credit-api.ts` (paired with step 4 — same functional area). Remove from allowlist.
6. Migrate `remix-fetch.ts` + `remix-bulk.ts` + `remix-name-resolver.ts` as a batch (single functional area, shared codes). Remove all three from allowlist.
7. Migrate `ws-members-fetch.ts` + `ws-members-mutations.ts` + `ws-adjacent.ts` as a workspace-mutations batch. Remove from allowlist.
8. Migrate `rename-api.ts` and `settings-store.ts` (config + rename surface). Remove from allowlist.
9. Migrate `settings-modal.ts` and any other UI-layer thrower on the allowlist. Remove from allowlist.
10. Migrate `queue-control/task-queue.ts` and `loop-cycle-fallback.ts` (queue + loop area). Remove from allowlist.
11. Migrate `gitsync/progress-probe.ts` (gitsync area). Remove from allowlist.
12. Migrate `pro-zero/pro-zero-sdk-adapter.ts` (pro-zero adapter area). Remove from allowlist.
13. Migrate `async-utils.ts` last — it is shared infrastructure. Codes here belong to a new `ASYNC_*` area; add the area to the registry area list and update `check-error-codes-unique.mjs` accordingly.
14. Confirm `errors/format.ts` and `errors/diagnostic-error.ts` self-throws stay exempt (they are the taxonomy itself); document the exemption in `per-area-migration-coverage.test.ts` with an inline comment linking back to this plan.
15. Extend `per-area-migration-coverage.test.ts` with a new invariant: "the migrated-directories set equals `src/` minus the documented permanent exemptions", so a new `throw new Error` regressing into a migrated file fails CI immediately.
16. Tighten `eslint.config.js` `no-restricted-syntax` for bare `throw new Error(...)` from the current allowlisted scope to all of `standalone-scripts/macro-controller/src/**` except the documented permanent-exemption globs. See ./subtasks/27-legacy-throw-migration/02-eslint-tightening.md.
17. Run `bunx vitest run` for `errors/`, `credit*`, `remix*`, `ws-*`, `queue-control`, `gitsync`, `pro-zero`, `seed/` and confirm zero regressions; capture the green baseline in the subtask log.
18. Update `readme.md` (root) diagnostic-error section: refresh the code table generator against the extended registry so every new code from steps 3–13 is documented for end-users.
19. Update `standalone-scripts/macro-controller/readme.md` developer section: replace the "26 allowlisted legacy files" language with "permanent exemptions only" and link the exemption list.
20. Close-out: bump MINOR, add changelog entry, run `update-stale-version-refs.mjs` + `check-version-sync.mjs`, pin root readme version, then `mv .lovable/plans/pending/27-legacy-throw-migration.md .lovable/plans/completed/27-legacy-throw-migration.md` and flip `Status:` to `completed` with the shipping version range.

## Verification

- Each PROD step is verifiable by: (a) `rg "throw new Error" <migrated-file>` returns zero prod hits, (b) `bunx vitest run` for that area stays green, (c) `check-error-codes-unique.mjs` reports no duplicates and no unregistered placeholders, (d) `per-area-migration-coverage.test.ts` accepts the migrated directory without an explicit allowlist entry.
- Steps 15–16 are verified by writing a deliberately-broken commit locally (revert one migration) and confirming CI fails with a clear message; then restoring.
- Step 17 signal: full test-suite pass count matches the pre-migration baseline (currently 12/12 for `seed-plan-next*`; area-specific suites captured in the subtask log).
- Step 18–19 signal: rendered readme tables include every new code with correct placeholders.
- Step 20 signal: `check-version-sync.mjs` prints `✅ All versions in sync: <new>` and the plan file only exists in `completed/`.

## Appended from prior pending tasks

None re-scoped into this plan. The following existing pending plans remain independent and are NOT absorbed here:
- `.lovable/plans/pending/10-unified-billing-all-workspaces.md`
- `.lovable/plans/pending/11-prompts-import-export-section.md`
- `.lovable/plans/pending/13-per-project-chat-submit-tracker.md`
- `.lovable/plans/pending/22-prompt-library-test-coverage-50.md`
- `.lovable/plans/pending/23-prompt-library-relocate-and-light-mode.md`
- `.lovable/plans/pending/24-eslint-warnings-cleanup-30.md`
- `.lovable/plans/pending/25-eslint-cleanup-continuation-30.md`
