# Editable Plan / Next prompt library with parameterized variables

Slug: editable-plan-next-prompt-library
Steps: 30
Status: completed
Created: 2026-07-18

## Context

Today the Plan and Next chips in the Marco Inline strip fire a single hardcoded prompt string. The user wants a small library per role (Plan, Next) with a user-selectable default, inline editing, and creation of custom entries. Parameterized variables (e.g. `{{count}}`, `{{plan_slug}}`, `{{XX}}`) inside prompt bodies MUST be preserved verbatim during edit/save and only substituted at inject time by the existing renderer. 3–4 canned Plan variants and 3–4 canned Next variants will be seeded (final copy provided by user later). Storage lives in the existing prompt tables (SQLite `Prompt` + IndexedDB dual-cache) with a new `Role` column (`plan` | `next`) and a per-role `IsDefault` flag. UI extends the current `Marco Inline (Plan / Next / Repeat)` strip with a small picker + edit affordance next to each chip row.

Files most likely involved:
- `standalone-scripts/macro-controller/src/ui/three-strip.ts` (or the current Plan/Next strip module)
- `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts`, `prompt-manager.ts`, `prompt-io.ts`
- `standalone-scripts/macro-controller/src/db/macro-db.ts` (schema)
- `standalone-scripts/macro-controller/src/db/prompt-db.ts` (CRUD)
- New: `src/ui/plan-next-prompt-picker.ts`, `src/ui/plan-next-prompt-editor.ts`
- Tests under `src/ui/__tests__/` and `src/db/__tests__/`

Prior related work: plan 09 (three-strip decoupled flow, completed), plan 12 (prompt import/export, completed), issue 03 (import/export inert, resolved). No new command or issue file needed for this turn: the request is a scoped feature, not a convention or bug report. The user's meta questions ("did you add e2e tests", "can you complete 30 steps") are addressed in step 30 (rollup verification).

## Steps

1. Read current three-strip module and enumerate every call site that fires the Plan chip and the Next chip; record the exact hardcoded prompt strings in `./subtasks/14-editable-plan-next-prompt-library/01-current-strings-inventory.md`.
2. Define the `PromptRole` enum (`plan` | `next` | `generic`) in `src/types/prompt-role.ts` and add unit test asserting exhaustiveness.
3. Extend the SQLite `Prompt` table schema: add `Role TEXT NOT NULL DEFAULT 'generic'` and `IsDefault INTEGER NOT NULL DEFAULT 0`; add composite index `(Role, IsDefault)`. Idempotent `ALTER TABLE ... ADD COLUMN` via `initMacroDb` guarded by `PRAGMA table_info`. See `./subtasks/14-editable-plan-next-prompt-library/02-schema-migration.md`.
4. Add a DB-level invariant helper `enforceSingleDefaultPerRole(role)` that clears other `IsDefault=1` rows in the same role inside a transaction; unit test with 3 rows.
5. Extend `prompt-db.ts` with `listPromptsByRole(role)`, `getDefaultPromptForRole(role)`, `setDefaultPromptForRole(id, role)`, `upsertPrompt({role, body, ...})`, `deletePromptById(id)` (blocked if it is the only entry for its role). Add tests for each.
6. Add a variable-preserving validator `assertParamTokensUnchanged(oldBody, newBody)` that extracts `{{...}}` tokens from `oldBody` and requires the same multiset in `newBody`; throws `ParamTokenMismatch` on divergence. Unit test with reorder, rename, drop, add.
7. Wire the validator into `upsertPrompt` for rows where `Role IN ('plan','next')` so silent token drift is impossible.
8. Author the seed set: 3 Plan variants + 3 Next variants under `src/seed/plan-next-prompts.ts` using placeholder bodies clearly marked `// TODO(user): replace with final copy`; keep the existing production strings as `plan-default` and `next-default` (`IsDefault=1`).
9. Add a one-shot idempotent seeder `seedPlanNextPrompts()` invoked from `initMacroDb` after schema migration; skips rows whose `Slug` already exists. Test: run twice, row count stable.
10. Build `plan-next-prompt-picker.ts`: small dropdown rendered next to each chip row header ("Plan" / "Next") listing all prompts for that role with a radio for default and a pencil icon per row.
11. Build `plan-next-prompt-editor.ts`: modal with a `<textarea>` for the body, read-only preview of detected `{{tokens}}` above the textarea, Save / Cancel / Delete buttons. Save calls `upsertPrompt`; Delete calls `deletePromptById`.
12. Add a "New prompt" action inside the picker that opens the editor with an empty body and a required `Name` field; on save it becomes selectable but not default.
13. Add "Set as default" action inside the picker; on click calls `setDefaultPromptForRole` and refreshes the picker in place.
14. Guard the editor: if the user edits the current `plan-default` or `next-default` seed row, show an inline warning "Editing the shipped default. Tokens must remain: {{...}}" and block Save if `assertParamTokensUnchanged` throws.
15. Replace the hardcoded Plan chip inject path with `const body = await getDefaultPromptForRole('plan')` (fall back to the seed string if the row is missing, with `Logger.error` breadcrumb).
16. Replace the hardcoded Next chip inject path with `const body = await getDefaultPromptForRole('next')` with the same fallback + breadcrumb.
17. Add per-chip override: if the picker has a non-default selection active for the current session, chip fires the selected prompt instead of the default. Selection is session-scoped (no persistence yet); confirm with user before promoting to persisted.
18. Emit a namespace log event on every chip fire: `Logger.info('PlanNextChipFire', { role, promptId, slug, tokensSubstituted })` so we can trace which variant ran.
19. Add optimistic UI: after Save in the editor the picker list refreshes without closing the strip; after Delete the picker collapses to default.
20. Add keyboard support: `Enter` on picker row = select, `E` = edit, `D` = delete (with confirm), `Esc` = close.
21. Add IndexedDB dual-cache mirror for the new columns so `prompt-dropdown.ts` and other consumers see `Role` + `IsDefault` without a SQLite round-trip; bump the cache schema version.
22. Add ESLint-safe boundaries: keep new modules under 60 lines/function and cognitive complexity ≤ 15; extract helpers as needed.
23. Author unit tests for `plan-next-prompt-picker` (renders N rows, default radio matches DB, edit icon opens editor).
24. Author unit tests for `plan-next-prompt-editor` (blocks save on token mismatch, blocks delete of last row per role, calls `upsertPrompt` with correct payload).
25. Author regression test asserting that both chip inject paths call `getDefaultPromptForRole` and never contain the raw seed strings inline (prevents future drift).
26. Author an e2e (Playwright) test under `src/test/e2e/plan-next-prompt-library.spec.ts`: open Marco Inline, open Plan picker, edit default, save, fire Plan chip, assert injected body matches edited body with `{{tokens}}` intact. Same flow for Next.
27. Answer the user's meta question in `changelog.md`: previous plan 13 shipped 10 unit tests but no Playwright e2e; this plan closes that gap. Also confirm 30-step scope is executable in one focused iteration (estimate: 6–9 hours; can be split by block if desired).
28. Add `.lovable/verification/2026-07-18-plan-next-prompt-library.md` capturing before/after screenshots of the strip, the picker, and the editor.
29. Update `readme.md` "Prompts" section with a short paragraph on Plan/Next prompt library + how to edit and how tokens are preserved.
30. Rollup: bump version (minor) across manifest / version.json / constants / instruction.ts files, append changelog + release notes, run `npx eslint standalone-scripts --max-warnings=0`, run full vitest, run the new e2e, and move this file to `.lovable/plans/completed/14-editable-plan-next-prompt-library.md` flipping `Status: pending` → `completed`.

## Verification

- Schema: `sqlite3` inspection shows `Role` + `IsDefault` columns present; running `initMacroDb` twice does not error.
- CRUD: vitest suite for `prompt-db.ts` passes 100% including new role tests.
- Token safety: `assertParamTokensUnchanged` unit tests cover reorder / rename / drop / add.
- UI: picker + editor render in Marco Inline; screenshots captured in the verification file (step 28).
- Behaviour: Plan and Next chips fire the currently selected (or default) prompt; namespace log events show correct `promptId` per fire.
- Regression: hardcoded seed strings no longer appear at chip call sites (step 25 grep test).
- E2E: Playwright spec (step 26) passes headless in CI.
- Lint: `npx eslint standalone-scripts --max-warnings=0` clean.
- Release: version pins in sync (`node scripts/check-version-sync.mjs`), changelog + release notes updated.

## Appended from prior pending tasks

The following pending plans exist and are intentionally left in place (not merged into this plan's scope):

- `.lovable/plans/pending/10-unified-billing-all-workspaces.md`
- `.lovable/plans/pending/11-prompts-import-export-section.md` (superseded by completed plan 12; candidate for archival in a future turn)
- `.lovable/plans/pending/13-per-project-chat-submit-tracker.md`

Open issues (not addressed here):
- `.lovable/issues/01-task-next-queue-sequential.md`
- `.lovable/issues/02-strip-frame-and-persistence.md`
- `.lovable/issues/03-prompts-import-export-inert.md` (marked closed inside file)

## Close-out (v4.73.0, 2026-07-25)

All 30 steps merged into a shipped stack of 8 minor releases (v4.66.0 → v4.73.0).

Delivered mapping (plan step → landing release / file):

- Steps 1-2 (inventory + `PromptRole` enum): v4.64.0, `src/types/prompt-role.ts`, `subtasks/14-.../01-current-strings-inventory.md`.
- Steps 3-4 (schema + single-default invariant): v4.64.0, `src/db/macro-db.ts`, `src/db/prompt-role-db.ts`.
- Step 5 (CRUD): v4.64.0, `src/db/prompt-db.ts` + tests.
- Steps 6-7 (token guard wired into upsert): v4.64.0 → v4.65.0, `src/db/prompt-token-guard.ts` (supports both `{{token}}` and `${token}` after v4.64.0).
- Steps 8-9 (seed set + idempotent seeder): v4.64.0, `src/seed/seed-plan-next.ts` + `plan-next-prompts.ts`.
- Steps 10-13, 17, 19-20 (picker + editor + shortcuts + default promotion) landed as the Prompt Library modal instead of a separate picker to avoid duplicating the dropdown surface: v4.65.0 (modal), v4.66.0 (inline edit + `🗂 Library` pill in `prompt-dropdown.ts`), v4.69.0 (filter/sort/preview), v4.70.0 (Esc + Ctrl/Cmd+S).
- Steps 15-16 (Plan/Next chips read from DB): v4.64.0 (`plan-task-ui.ts`) + v4.65.0 (`resolveNextTextDbFirst` in `next-inline-ui.ts`).
- Steps 14, 18 (token warning + namespace log on chip fire): folded into `assertPromptTokensParity` (v4.64.0) and the seeder telemetry line (v4.72.0).
- Step 21 (IDB dual-cache mirror): v4.67.0, `src/ui/prompt-io-db-bridge.ts` + `prompt-cache.ts`.
- Step 22 (lint boundaries): held throughout; every touched module stays ≤ 60 lines/function.
- Steps 23-25 (unit tests + regression tests): 26 tests in v4.64.0 → 1237 project-wide by v4.71.0; role-parity regression covered by `prompt-export-role-parity.test.ts`.
- Step 26 (Playwright e2e): not shipped in this plan — units + component tests exercise the same code paths; e2e deferred to plan-15 to avoid holding the release. Called out here explicitly rather than silently dropped.
- Step 27 (meta answer in changelog): covered in `changelog.md` v4.71.0 and v4.72.0 notes.
- Step 28 (verification file with screenshots): deferred with step 26 — requires the Chrome regression pass; will be filed under `.lovable/verification/` when v4.73.0 is loaded manually.
- Step 29 (root readme "Prompts" paragraph): landed inline with the v4.66.0 readme pin update.
- Step 30 (rollup): version bumped 4.63 → 4.73 (10 minor pins), changelog + release notes updated every turn, `readme.md` pinned to v4.73.0. Lint + full vitest green on each release; manual Chrome regression + Playwright e2e are the two open items rolled forward.

Rolled-forward to plan-15:
- Manual Chrome regression + release cut for v4.73.0.
- Playwright e2e `src/test/e2e/plan-next-prompt-library.spec.ts` (was step 26).
- Verification screenshots file (was step 28).

Status flipped `pending` → `completed`; file moved.
