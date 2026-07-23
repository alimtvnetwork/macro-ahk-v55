---
Slug: characterisation-tests
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-01 — Characterisation tests (behavior lock)

Purpose: freeze current runtime behavior BEFORE any refactor so every subsequent step can prove parity.

## Surfaces to lock

1. Plan chip resolution — `ui/plan-task-ui.ts::stagePlanPrompt()` — assert DB-first path, fallback path, `{{token}}` substitution result equals byte-for-byte pre-refactor output for 6 canonical bodies (short, long, multi-token, empty, unicode, chip-role).
2. Next chip resolution — `ui/task-next-ui.ts::stageNextPrompt()` — same matrix.
3. Credit totals aggregation — `credit-parser.ts::aggregateCreditTotals()` — snapshot totals for pro_0 + pro_1 workspaces (pinned `mem://features/macro-controller/pro-zero-credit-balance` shape); FREE tier must remain excluded.
4. Workspace move — `ws-move.ts::moveToWorkspace()` — assert `fetchAndPersist(target,force)` is awaited before `fetchAsync()` (regression from `mem://features/macro-controller/post-move-credit-sync`).
5. Prompt library IO — `ui/prompt-io-db-bridge.ts` — round-trip bundle preserves `ReplaceKey` + `ReplaceValues` (regression from Plan-15 v4.74.0).
6. Macro run trigger — `core/MacroController.ts::run()` — event ordering: `RunStarted` -> steps -> `RunFinished`, no re-entry.

## Location

`standalone-scripts/macro-controller/src/__tests__/regression-baseline.test.ts` — one describe block per surface. Marked `@behavior-lock` in the test name so a lint rule can forbid deleting these without an explicit rationale comment.

## Success signal

- 6 describe blocks, each with ≥ 3 assertions.
- Run once at v4.88.0, commit as the golden baseline. Any step 4-30 that alters an assertion must include a diff-justification in its PR description.
