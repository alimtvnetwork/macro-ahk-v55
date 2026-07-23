## Pipeline / Workflow

`.github/workflows/ci.yml` + `.github/workflows/ping.yml` (diagnostic)

## Description

After PR #45 ("Fixed namespace test stderr"), Lovable/GitHub branch commits stopped triggering the `CI Build` workflow. No Actions run appeared for subsequent commits even though commits clearly reached GitHub.

## First Seen

2026-05-26 (branch commits post-PR #45).

## Root Cause

Multi-stage drift in `.github/workflows/ci.yml` `on:` triggers across recent edits:

1. Initial state: `on: push: branches: [main]` — only `main` pushes ran CI. Branch commits were ignored.
2. First fix attempt: `branches: "**"` — still a filter; behaved inconsistently for certain ref shapes.
3. Final fix: `on: push:` (null/empty value) which means "every push to every branch", plus `pull_request: branches: [main]`.

`ci.yml` is now syntactically valid (YAML parses, 34 jobs registered) and the trigger contract is correct. If Actions still do not fire on Lovable commits, the remaining cause is **repo-side**, not workflow-side:

- Repo **Settings → Actions → General** has Actions disabled or restricted.
- Lovable GitHub App lacks **Actions: Read & Write** / **Workflows: Write** permission.
- "Require approval for first-time contributors" gate is blocking the app's commits.

## Status

✅ Workflow-side resolved (2026-05-26). Repo-side verification pending via diagnostic `ping.yml`.

## Fix

- `.github/workflows/ci.yml`: `on: push:` (no `branches`/`paths` filters) + `pull_request: branches: [main]`.
- Removed every `github.event_name == 'push' && github.ref == 'refs/heads/main'` job-level guard.
- Added `.github/workflows/ping.yml` — minimal diagnostic that runs on every push to isolate workflow-file issues from repo/app-permission issues.

## Prevention

- `scripts/__tests__/ci-workflow-trigger-policy.test.mjs` asserts:
  1. `ci.yml` push trigger has no `branches` / `branches-ignore` / `paths` / `paths-ignore` filters.
  2. No `main`-only push guards remain on required jobs.
  3. `ping.yml` exists and triggers on every push.
- Run with `node --test scripts/__tests__/ci-workflow-trigger-policy.test.mjs`.

## References

- PR #45 (regression source).
- `.github/workflows/ci.yml`, `.github/workflows/ping.yml`.
- `scripts/__tests__/ci-workflow-trigger-policy.test.mjs`.
