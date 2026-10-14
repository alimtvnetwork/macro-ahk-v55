# CI/CD Failure Investigation and Recorder Functionality

## slug
Cicd-Failure-Investigation-And-Recorder-Functionality

## User Request (Verbatim)

# CI/CD Failure Investigation and Recorder Functionality: high priority instruction, non-negotiable task

Can you please read the code base and also try to find the root cause of the CI/CD failure? Try to fix the CI/CD. Make sure everything is green in the CI/CD. Also, make sure the recorder works, and we can create custom recording and custom changes on the fly. The recorder is not working with the browser, so make sure you do the end-to-end testing, create many tests, run it locally, check that it works on any website. Check the programming and CSV upload works. Try to read the specs properly. Check difference between the spec and the implementation where missing. Can you please do all these things?

## slug: cicd-failure-investigation-and-recorder-functionality

# Actionable Items Must Follow Non-Negotiable

1. Write spec under 02-spec/21-app/cicd-failure-investigation-and-recorder-functionality/ and enqueue plan task in .ai-memory/plans/cicd-failure-investigation-and-recorder-functionality.md (subtasks in .ai-memory/plans/subtasks/cicd-failure-investigation-and-recorder-functionality/) first
2. Search codebase exclusively via GitMap (gitmap aum search, gitmap find, gitmap cat, gitmap ps, gitmap py, gitmap llm train); TOTAL BAN on rg, ripgrep, grep, git grep, Select-String
3. Strictly use relative Git paths (02-spec/..., .ai-memory/..., cmd/...); only add the relative paths, never add the absolute path during your work, and ensure this is respected on the release page and in release notes as well
4. Use `gitmap` AI agents to enter data
5. Task completion includes committing and pushing to Git
6. Investigate and resolve the root cause of the CI/CD failure
7. Ensure all CI/CD processes are passing and green
8. Verify and fix the recorder functionality, ensuring it works with the browser
9. Implement end-to-end testing for the recorder, ensuring it works on any website
10. Validate programming and CSV upload functionality
11. Compare specs with implementation and address any discrepancies

## Must follow and spawn agent using

execute-parent-task-with-n-steps-v6

## Additional Instructions

- [/plan](slashCommand;plan) first before doing the work to reduce the credits.
- [/learn](slashCommand;learn) from gitmap skill to leverage GitMap high-speed search, toolchain discovery, and caching.
- Only add the relative paths, never add the absolute path during your work; this should be respected on the release page and in release notes as well.

## Confirmed Task Breakdown

### Task-01: CI/CD Root Cause Investigation
- **Understood:** [YES] — CI Build, spec-gates, and spec-audit are all FAILING on main (latest push `chore(git): ignore gitmap db artifacts in .gitignore`, 2026-10-11). The exact failing step, job, and root cause must be identified from the live workflow logs, not guessed.
- **Actionable Scope:** Inspect failing runs, extract failing steps, identify root cause, document it, and produce a minimal fix.
- **Target Files / Area:** `.github/workflows/ci.yml`, `.github/workflows/spec-gates.yml`, `.github/workflows/spec-audit.yml`, plus whatever source the failing steps point at.

### Task-02: Fix CI/CD to Fully Green
- **Understood:** [YES] — The user demands everything green: repair the root cause (code, config, or workflow), push, and verify all required checks pass on the resulting commit.
- **Actionable Scope:** Apply minimal diff fixes; re-verify with `gitmap pipeline-ai status --json` after push; iterate until green.
- **Target Files / Area:** files identified by Task-01.

### Task-03: Recorder Functionality Audit and Repair
- **Understood:** [YES] — The XPath/macro recorder does not work with the browser; it must record interactions, allow custom recordings and on-the-fly changes, and work on any website.
- **Actionable Scope:** Audit `src/content-scripts/xpath-recorder.ts`, recorder hooks/components, content-script injection chain, and message relay; fix defects; prove with tests.
- **Target Files / Area:** `src/content-scripts/`, `src/components/recorder/`, `src/hooks/use-recording-session.ts` and siblings, `standalone-scripts/xpath/`.

### Task-04: Recorder End-to-End Testing
- **Understood:** [YES] — The user explicitly commanded E2E testing: many tests, run locally, verified across multiple websites, not just one.
- **Actionable Scope:** Author Playwright/Vitest E2E coverage for record → replay → custom edit → re-record flows; run the E2E suite locally (user-authorized exception to the no-test-run rule for this task only); fix failures until green.
- **Target Files / Area:** `tests/e2e/`, recorder modules.

### Task-05: Programming and CSV Upload Validation
- **Understood:** [YES] — The script/programming surface and CSV upload path must be exercised end to end: valid CSV, invalid CSV, custom code edits, and their persistence/replay.
- **Actionable Scope:** Locate CSV import/export (`keyword-events-sqlite-import.ts` and siblings), test happy + failure paths, fix defects.
- **Target Files / Area:** `src/lib/keyword-events-sqlite-import.ts`, related CSV/project import UI.

### Task-06: Spec-vs-Implementation Gap Analysis
- **Understood:** [YES] — Read the recorder + CI specs properly (02-spec/31-macro-recorder, 02-spec/12-cicd-pipeline-workflows, pipeline/ docs), diff against implementation, and close real gaps or log them as follow-ups.
- **Actionable Scope:** Documented gap list; fix in-scope gaps; park out-of-scope gaps under `Follow-ups:` in the plan.
- **Target Files / Area:** `02-spec/31-macro-recorder/`, `02-spec/12-cicd-pipeline-workflows/`, implementation files.

## Acceptance Criteria

1. `gh run list` (or `gitmap pipeline-ai status --json`) shows CI Build, spec-gates, and spec-audit green on the pushed commit.
2. Recorder starts, captures interactions, stops, saves, and replays on multiple real websites via E2E tests run locally and passing.
3. Custom recording edits on the fly (steps insert/edit/delete/reorder) verified by tests.
4. CSV upload validated: valid import succeeds, invalid import fails with a clear error, round-trip export/import preserves data.
5. Spec-vs-implementation gap report written; in-scope gaps fixed or logged as `Follow-ups:`.
6. One atomic GitMap commit + push at the end covering spec, plan, fixes, tests. No secrets, no absolute paths, no version bumps.

## Non-Goals

- No releases or version bumps (R10 — user did not request a release).
- No new features beyond what the acceptance criteria require.
- No workflow-file redesign beyond the minimal fix needed for green CI; report structural workflow issues to the user if found (no-workflow-changes constraint analog: flag, don't redesign unilaterally).

## Constraints

- GitMap search primacy: `gitmap aum search`, `gitmap find`, `gitmap cat`, `gitmap ps`, `gitmap py`, `gitmap llm train` only. TOTAL BAN on rg, ripgrep, grep, git grep, Select-String, Get-ChildItem -Recurse, findstr.
- Strict relative git paths everywhere, including any release notes text. TOTAL BAN on absolute paths and `file:///` URIs.
- All filenames lowercase.
- Boolean conventions: positive `is`/`has` prefixes, implicit evaluation, no mixed polarity.
- Targeted checks only on modified files; full builds/tests reserved for the recorder E2E scope explicitly commanded by the user.
- Workers never run git commands; single atomic `gitmap cpb "marco - <fix summary>"` at the end by lead only (bug-fix task → `cpb`).
- Secrets gate before commit: scan new/changed files for tokens/keys; offload via `gitmap rs` if `repo-secrets` exists, else remove and ask.
