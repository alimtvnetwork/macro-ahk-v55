# Task-03: Release Pipeline Fix

Status: pending
Owner: Worker 01 (Wave 2)
Owned files: the workflow/script files named by Task-01's RCA (Worker 01 owns; no one else touches them).

## Objective

Apply Task-01's minimal fix so the release pipeline produces and attaches the full v6.99.0-equivalent asset manifest again.

## Steps

1. Read Task-01's RCA (`.ai-memory/cicd/issues/cicd-asset-inclusion-and-release-fix.md`) and Task-02's readiness report (`.ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/02-readiness-report.md`).
2. Apply the minimal diff to the identified workflow/script files. Touch nothing else; no reflow of unaffected lines; no pipeline redesign.
3. For each fixed step, re-run it in file-scoped form where possible (e.g. a single packaging/zip script on its real inputs) and record `exit 0` with file counts (>0 files or it is a FAIL).
4. Verify every one of the 18 baseline assets maps to a now-working producing step; list any asset that cannot be restored and why (lead decides whether it blocks the release).
5. Keep `actions/upload-artifact` out — release assets go via `gh release upload` (exempt from zero-storage). Report any `upload-artifact` usage found in the release path.

## Constraints

- Lowercase filenames; relative paths only; positive-boolean conventions; no explicit-`true` checks.
- No full release build locally; no test-suite runs.
- Two-strike retry cap; on second failure reply `STATUS: BLOCKED` with exact error and stop — lead takes over (LEAD_FALLBACK).

## Output contract

Report JSON: `{ "task": "Task-03", "status": "DONE", "filesChanged": [...], "checks": "<cmd> -> exit 0, <n> files", "assetsRestored": ["<asset>", ...], "assetsUnrestorable": [], "assumptions": [], "blockers": [] }`.
