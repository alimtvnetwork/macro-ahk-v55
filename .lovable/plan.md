# Why CI/CD is not triggering, not releasing, and how to fix it

## What the evidence shows

1. The screenshot is not a code failure. `Preflight - Spec Links` prints
   `Requested labels: ubuntu-latest` and `Waiting for a runner to pick up this job...`
   for 20m 38s. The job never started. That is runner availability or Actions
   billing/spending limit at the GitHub account level, not a workflow bug.
2. The job is defined at `alimtvnetwork/macro-ahk-v55/.github/workflows/ci.yml@refs/heads/main`,
   while `scripts/clone-ahk.mjs` was recently pointed at `aukgit/macro-ahk-v55`.
   Two slugs are in play, so canonical-repo checks can disagree with the repo that
   actually runs CI.
3. `version.json` is `5.20.0-dev`, but `.gitmap/release/latest.json` says `v5.20.1`.
   The `-dev` suffix is exactly what makes `scripts/check-remote-tag.mjs` skip its
   guard, so preflight passes by opting out rather than by being satisfied.
4. `release.yml` fires only on a pushed `v*` tag (plus `create`, `release`,
   `workflow_dispatch`). This sandbox cannot create or push git tags, so every recent
   release ceremony ended with a logged "git tag skipped" issue. No tag, no release
   run, no assets. That is the "not releasing" symptom.
5. `ci.yml` uses `on: push` with no branch filter plus
   `concurrency: ci-${{ github.workflow }}-${{ github.ref || github.sha }}` with
   `cancel-in-progress: true`. Rapid pushes cancel earlier runs, which reads as
   "CI is not triggering" when the run actually started and was cancelled.

## Root causes, ranked

- Primary: no `v*` tag is ever pushed, so the release pipeline has no trigger.
- Primary: the queued job is blocked at the GitHub account level (runner minutes,
  spending limit, or Actions disabled). Nothing in the repo can unblock that.
- Secondary: repo-slug drift between `alimtvnetwork/...` and `aukgit/...`.
- Secondary: the `-dev` suffix silently disables the remote-tag guard, so release
  readiness is never really verified.
- Cosmetic: aggressive `cancel-in-progress` hides real runs.

## Plan

### 1. One slug, resolved at runtime
Remove hardcoded slugs from `scripts/clone-ahk.mjs`, `installer-contract.json` and
any test pinning one; route everything through `resolveRepoSlug` with a single
fallback constant set to the slug that actually runs CI.

### 2. Release trigger that does not need a local tag
Add `.github/workflows/tag-and-release.yml`: a `workflow_dispatch` job that takes a
version input and creates the `v<version>` tag server-side with `GITHUB_TOKEN`, which
`release.yml` then picks up. This removes the sandbox git limitation from the release
critical path for good.

### 3. Make the guard bypass visible
Change `scripts/check-remote-tag.mjs` so a `-dev` version still writes a Step Summary
line stating the release guard was bypassed, instead of skipping silently.

### 4. Concurrency
Keep `cancel-in-progress` for pull requests, disable it for `main` pushes so every
main commit produces a complete, visible run.

### 5. Release v5.21.0 (MINOR bump)
Full ceremony: `version.json`, `manifest.json` sync, every pin site in `readme.md`,
a new `## [v5.21.0]` changelog entry, regenerate `macro-prompts.json`. Verify with
`check-coding-guidelines-coverage.mjs`, `check-readme-compliance.mjs`,
`check-remote-tag.mjs`, prompt parity tests and `pnpm run test:quiet`. Trigger the
release through the new tag-and-release workflow instead of logging another
"git tag skipped" issue.

## What only you can do

Check the repo's Actions and billing settings. If minutes are exhausted, the spending
limit is zero, or Actions is disabled, jobs keep sitting at "Waiting for a runner"
regardless of anything changed here.