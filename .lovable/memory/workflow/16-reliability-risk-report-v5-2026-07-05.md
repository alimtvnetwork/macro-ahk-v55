# Reliability & Failure-Chance Report v5

**Date**: 2026-07-05
**Trigger**: "rejog the memory"
**Scope**: Full `.lovable/memory/`, `spec/`, `standalone-scripts/*/spec/`, roadmap in root `plan.md`.
**Predecessors**: v1 (`03-`), v2 (`05-`), v3 (`06-`), v4 (`07-`). This v5 supersedes for hand-off readiness as of today.

---

## 1. Success probability estimates (hand-off to a fresh AI)

| Tier | Example modules | P(success in ≤3 iterations) | Key assumption |
|---|---|---|---|
| Simple | Constant bumps, changelog entries, single-file bug fix, add a test | **0.90** | Fresh AI reads `spec/00-what-to-read-first.md` + `mem://index.md` first. |
| Medium | New popup/options section, add a Logger call site, new SQLite handler | **0.72** | AI respects `no-retry-policy`, `no-supabase`, dark-only, and failure-log shape. |
| Complex (agentic UI flows) | Task Next queue (issue 01), Task Splitter+Queue (subtasks 08), Repeat Loop refactors | **0.55** | AI reads issue file + subtask RCA before editing; reuses `waitForLovableIdle` helper. |
| End-to-end (cross-project + CI + release) | Version bump ritual, tag-triggered release, E2E-24 cross-project sync | **0.45** | AI honours the minimal `version.json` plus optional `v*` tag release contract. |

Confidence in these numbers: **medium**. They are calibrated against the last ~40 sessions in `.lovable/memory/workflow/*.md` and the last 12 completed plans in `.lovable/plans/completed/`.

---

## 2. Failure map

| Where | Why | Symptom |
|---|---|---|
| Version bump ritual | Version drift risk when agents hand-edit downstream pins instead of root `version.json` | Release metadata becomes confusing |
| Failure logging | Fresh AI writes `console.error` or omits `SelectorAttempts[]`/`VariableContext[]` | Recorder/replay diagnostics unusable; violates `mem://standards/verbose-logging-and-failure-diagnostics` |
| Retry loops | Fresh AI adds exponential backoff "to be safe" | Violates `mem://constraints/no-retry-policy`; regressions in webhook + credit refresh |
| Storage rewrites | Fresh AI tries to PascalCase `StoredProject` keys in `chrome.storage.local` | Breaks ~50 consumers; violates `mem://constraints/no-storage-pascalcase-migration` |
| Supabase temptation | Fresh AI proposes Supabase for a new feature ("since Lovable Cloud is available") | Violates `mem://constraints/no-supabase`; entire project uses sql.js + OPFS + chrome.storage |
| Skipped/ archive edits | Fresh AI greps and finds AHK files under `skipped/` | Wasted work; CI `readonly-paths-guard` fails |
| Task Next queue (issue 01) | Sequential runner not yet wired; submenu count silently ignored | Only one paste occurs regardless of "Next 5" pick |
| Task Splitter + Next queue (subtasks 08) | No persistent task queue produced by splitter step | Cannot "split into 10 then press Next 10 times"; splitter+next disconnected |
| readme.txt writes | Fresh AI adds timestamps/git-stamps to `readme.txt` | Violates SP-1..SP-7 in `mem://constraints/readme-txt-prohibitions` |
| No-Questions Mode ignored | Fresh AI calls `ask_questions` for ambiguity | User-marked repeated correction; must log to `.lovable/question-and-ambiguity/` instead |
| CI push filter regression | Someone edits `.github/workflows/ci.yml` and re-adds `branches:` filter | Lovable branch commits silently skipped; regression has recurred 3× |

---

## 3. Corrective actions (priority order)

| # | Fix | Where | Expected gain |
|---|---|---|---|
| 1 | Add one-page **"Fresh-AI first 5 minutes"** card at top of `spec/00-what-to-read-first.md` listing the 7 hard bans (Supabase, retry, unknown, skipped/, storage rewrite, readme.txt stamps, ask_questions in No-Questions Mode). | `spec/00-what-to-read-first.md` | +0.10 on all tiers |
| 2 | Complete **issue 01 — Task Next queue sequential** (SS-01 idle helper extract, SS-02 runner, Vitest). | `standalone-scripts/macro-controller/src/ui/lovable-idle.ts` (new), `task-next-ui.ts` | Unblocks user-visible feature |
| 3 | Complete **subtasks 08 — Task Splitter + Next Queue** (IndexedDB `task_queue` section, splitter parse-back, Next consumes queue). | `standalone-scripts/macro-controller/src/queue-control/` (new) | Unblocks issue 131 spec |
| 4 | Add release-ritual acceptance test: enumerate every unified-version site and assert equality. | `scripts/__tests__/unified-version-sites.test.mjs` | Prevents most-common CI red |
| 5 | Rename `.lovable/plan.md` to `.lovable/plan-pointer.md` (or delete) to remove the "which plan is authoritative?" trap the audit S81 flagged. | `.lovable/` | Removes ambiguity for fresh AI |
| 6 | Add lint rule / CI check that flags `console.error` outside `src/test/**` and `standalone-scripts/*/test/**`. | `scripts/audit/logger-compliance.mjs` (exists — extend) | Enforces namespace Logger contract |
| 7 | Publish the "release trigger phrase" recognition rule (`bump version + add changelog + pin that version to root readme`) into `spec/00-what-to-read-first.md` so a fresh AI doesn't split it into three separate tasks. | `spec/` + `mem://workflow/release-trigger-phrase` | Prevents partial releases |

---

## 4. Readiness decision

**Ready for hand-off: YES, with the two follow-ups below required before starting Tier-3/4 work.**

- Simple + Medium work: hand off immediately. The memory index, `spec/00-what-to-read-first.md`, and `spec/01-quickstart-for-blind-ai.md` are sufficient.
- Complex + E2E work: apply corrective actions **#1 and #4** first (both are ≤1 hour). Everything else in §3 is nice-to-have.

**Blockers (hand-off cannot start until fixed):** none.
**Cautions (hand-off can start, but flag these):** #2, #3, #5.

---

## 5. Suggestions & plan artifacts status

- Suggestions tracker: `.lovable/memory/suggestions/01-suggestions-tracker.md` — active, 1 open entry (installer AC2 fallback).
- Plan file: root `plan.md` — active, 688 lines, up-to-date through 2026-06-04 CI/CD spec closure. `.lovable/plan.md` is a 70-line pointer only (see corrective #5).
- Issues: `.lovable/issues/01-task-next-queue-sequential.md` — open, subtasks staged.
- Pending subtasks: `.lovable/plans/subtasks/01-task-next-queue-sequential/{01,02}-*.md`, `.lovable/plans/subtasks/08-task-splitter-and-next-queue/01-rca.md`.

---

*End of report. Per interaction rule, the user is asked which task to implement next — candidates listed in the chat reply.*
