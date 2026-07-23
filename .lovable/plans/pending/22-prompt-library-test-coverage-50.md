# Prompt Library Test Coverage (Plan/Next/Defaults) — 50 steps

Slug: prompt-library-test-coverage-50
Steps: 50
Status: pending
Created: 2026-07-17

## Context

Recently landed work (Plan-14 editable prompt library, Plan-15 configurable Replace token + N options) added
DB-backed Plan/Next prompt storage, seeding, IO bridge, token substitution, drift guard, and UI wiring. Test
coverage exists but is uneven: some methods only have happy-path coverage, some have no negative-path tests,
and integration between DB -> substitution -> UI is thin. This plan writes positive, negative, and
integration tests for the main methods only (not every helper), across:

- `standalone-scripts/macro-controller/src/db/` (schema, role-scope, CRUD, token-parity)
- `standalone-scripts/macro-controller/src/prompt-defaults.ts` (ReplaceKey / ReplaceValues / defaults)
- `standalone-scripts/macro-controller/src/token-substitute.ts`
- `standalone-scripts/macro-controller/src/prompt-io.ts` + `prompt-io-db-bridge.ts`
- `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` + `task-next-ui.ts`
- `standalone-scripts/macro-controller/src/seed-plan-next.ts`

Prior commands: `.lovable/spec/commands/01-standalone-scripts-must-follow-coding-guidelines.md`
Prior related plans: completed 14, 15; pending 11 (prompts import-export section) stays independent.

## Steps

1. Inventory public methods in `db/schema.ts`, `db/role-scope.ts`, `db/prompt-crud.ts`, `db/token-parity.ts` and list which already have tests.
2. Inventory public methods in `prompt-defaults.ts`, `token-substitute.ts`, `prompt-io.ts`, `prompt-io-db-bridge.ts`, `seed-plan-next.ts` and list existing test files.
3. Inventory UI entry points in `plan-task-ui.ts`, `task-next-ui.ts`, `prompt-library-modal.ts` and list existing tests.
4. Write the target matrix (method x {positive, negative, integration}) into `.lovable/plans/subtasks/22-prompt-library-test-coverage-50/01-matrix.md`.
5. Confirm vitest config picks up any new `__tests__/*.test.ts` file under `standalone-scripts/macro-controller/src/`.
6. db/schema: positive — creates Prompt table with expected columns and unique (Role, Slug) index.
7. db/schema: negative — second create is idempotent (no throw, no duplicate index).
8. db/schema: integration — after schema init, CRUD insert+read round-trips a row.
9. db/role-scope: positive — accepts `plan`, `next`, `generic`.
10. db/role-scope: negative — rejects unknown role (`foo`) with typed error.
11. db/role-scope: negative — rejects empty string and undefined.
12. db/prompt-crud.create: positive — inserts and returns row with generated Id and timestamps.
13. db/prompt-crud.create: negative — duplicate (Role, Slug) rejected with clear error code.
14. db/prompt-crud.update: positive — updates Body, bumps UpdatedAt, keeps Slug.
15. db/prompt-crud.update: negative — updating non-existent Id returns not-found error, no partial write.
16. db/prompt-crud.delete: positive — deletes row, subsequent read returns null.
17. db/prompt-crud.delete: negative — deleting non-existent Id is a no-op with logged warning.
18. db/prompt-crud.listByRole: positive — filters by role, ordered by Slug.
19. db/prompt-crud.listByRole: negative — unknown role rejected before query.
20. db/token-parity: positive — body preserving all `{{token}}` placeholders passes.
21. db/token-parity: negative — body missing a placeholder from baseline is rejected with the missing token name in the error.
22. db/token-parity: negative — body with an extra placeholder not in baseline is rejected.
23. db/token-parity: integration — CRUD.update rejects when parity check fails, row unchanged.
24. prompt-defaults: positive — `ReplaceKey` default is the documented token; `ReplaceValues` default list non-empty and unique.
25. prompt-defaults: negative — mutating exported defaults at runtime does not affect a second import (frozen or cloned).
26. token-substitute: positive — replaces every `{{ReplaceKey}}` occurrence with the provided value.
27. token-substitute: positive — supports N-way expansion when values list has multiple entries.
28. token-substitute: negative — empty value collapses token to empty string without throwing.
29. token-substitute: negative — missing key in template returns template unchanged.
30. token-substitute: negative — malformed token `{{ unclosed` left as literal, logged once.
31. token-substitute: integration — feeding a DB-loaded Plan prompt through substitute yields the exact string the UI would submit.
32. prompt-io export: positive — exports all Prompt rows into JSON matching the versioned schema.
33. prompt-io export: negative — empty DB exports an envelope with `items: []`, still schema-valid.
34. prompt-io import: positive — imports well-formed JSON, upserts rows, returns counts.
35. prompt-io import: negative — invalid JSON returns typed error, DB untouched.
36. prompt-io import: negative — schema-version mismatch rejected with expected/actual versions in message.
37. prompt-io-db-bridge: positive — maps DB row -> IO record with conditional optional keys (no `undefined` values leaked).
38. prompt-io-db-bridge: negative — row missing a required column surfaces a validation error naming the column.
39. prompt-io-db-bridge: integration — export then re-import yields byte-identical rows (round-trip).
40. seed-plan-next: positive — first boot inserts baseline Plan + Next prompts and sets the `seeded` flag.
41. seed-plan-next: negative — second boot with flag set is a no-op (no writes, no toast).
42. seed-plan-next: integration — after seed, `listByRole('plan')` and `listByRole('next')` return the documented slugs.
43. plan-task-ui: positive — chip click loads Plan prompt from DB, substitutes token, submits.
44. plan-task-ui: negative — DB empty for `plan` role triggers a one-shot logged error and does not submit.
45. task-next-ui: positive — Next chip click loads Next prompt, applies N options, submits once.
46. task-next-ui: negative — teardown on `pagehide` removes listener; second dispatch after teardown is a no-op (regression guard).
47. Integration — full flow: seed on fresh DB, open Plan Library modal, edit body preserving tokens, save, chip submits updated body.
48. Integration — full flow: import external JSON via Prompt Library, chip submits imported body with substitution.
49. Run vitest for the new suites only and confirm all green. Commit test files. Do not touch production source unless a test uncovers a real bug — if so, capture that as a new issue under `.lovable/issues/` and stop.
50. Bump minor version, add changelog entry, update RELEASE_NOTES.md, pin version in root readme.md.

## Verification

- `bunx vitest run` under `standalone-scripts/macro-controller` — all new files green.
- `npx tsc --noEmit -p tsconfig.macro.build.json` clean.
- `npx eslint standalone-scripts --max-warnings=0` clean.
- Coverage delta report shows every method listed in step 4 has >= 1 positive AND >= 1 negative test.
- Integration tests (steps 47, 48) exercise DB + substitution + UI dispatch, not just isolated units.

## Appended from prior pending tasks

- pending/10 unified-billing-all-workspaces — unrelated, remains pending.
- pending/11 prompts-import-export-section — related but scoped to UI section, remains pending.
- pending/13 per-project-chat-submit-tracker — unrelated, remains pending.
