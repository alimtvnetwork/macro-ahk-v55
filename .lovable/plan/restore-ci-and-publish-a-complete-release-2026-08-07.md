# Restore CI and publish a complete release

## Confirmed current state

1. Commits are triggering CI. GitHub recorded a `CI Build` run for commit `2b278fa1` on `main` at 2026-08-07 15:40 UTC, with 40 jobs. The run failed rather than failing to trigger.
2. The latest CI run has two confirmed failures:
   - `Preflight · No Nested Template Literals` failed in `Guard against vi.func`.
   - `Setup · Lint · Test` failed in `pnpm run test:quiet`.
3. The `vi.func` guard failure is reproducible locally. `scripts/check-vi-func.mjs` scans the archived `.old-github/` tree and flags `.old-github/.github/workflows/ci.yml:184`, even though archived workflows are not executable source.
4. The downstream build and E2E jobs were skipped because `Setup · Lint · Test` failed. The workflow job graph is therefore stopping as configured.
5. GitHub has no remote `v5.23.0` tag or release. The newest tag and release are `v5.22.0`, and that release has zero uploaded assets. A release for 5.23.0 cannot start until the tag workflow is dispatched.
6. The current and old `ci.yml` both trigger on every push. The meaningful trigger change is beneficial: the old file cancelled every in-progress run on a new push, while the current file only cancels pull request runs.
7. The current release flow adds `workflow_call` and `tag-and-release.yml`. This is required because a tag pushed with GitHub's built-in token does not emit another workflow push event.
8. The earlier `release.yml` syntax defect has been repaired in the current checkout, and all workflow files now pass the real YAML parser. The old working snapshot does not reveal a simpler missing trigger that should be restored.

## Root cause

The repeated diagnosis mixed three different states:

1. **Not triggered:** This was incorrectly reported in places. Current live evidence shows CI does trigger.
2. **Triggered but failed:** This is the present CI condition. A broad source scanner incorrectly includes `.old-github/`, and the test job also has an independent failure whose exact test output must be captured locally.
3. **No release started:** No `v5.23.0` remote tag exists. Normal commits intentionally do not publish releases. The manual `Tag and Release` workflow must create or safely reuse the immutable tag, then call the release workflow directly.

The main process failure was claiming completion from static workflow checks without verifying the actual GitHub run, failed step, remote tag, and release assets as one end-to-end chain. I apologize for that repeated mistake.

## Implementation tasks

### 1. Fix the confirmed CI scanner regression

- Update `scripts/check-vi-func.mjs` so repository archives such as `.old-github/` are excluded from source scanning.
- Add a regression test proving archived workflow text cannot fail the guard while real source usage still fails.
- Audit sibling whole-repository scanners for the same archive-boundary mistake and adjust only those that can produce the same false positive.

### 2. Reproduce and fix the test failure

- Run `pnpm run test:quiet` using the same CI environment.
- Capture the exact failing tests and fix their underlying code or fixtures, not the reporter and not by adding retries or excessive timeouts.
- Re-run the focused failing tests first, then the complete quiet suite.

### 3. Validate the complete CI path locally

- Run the workflow YAML parser and focused CI policy tests.
- Run all preflight scripts used by the two previously failed jobs.
- Run lint, type checks, full unit tests, standalone builds, extension build, and the Playwright extension suite in workflow order.
- Confirm the build and E2E jobs are no longer blocked by an upstream failure.

### 4. Reconcile release state before dispatch

- Keep Git tags as the version source of truth.
- Confirm the intended release remains `v5.23.0` and that the target commit contains every repair.
- Align contradictory release documentation so operators follow the tag-derived process instead of hand-editing conflicting version sources.
- Keep tag immutability: reuse `v5.23.0` only if it already points to the requested commit; otherwise stop rather than move it.

### 5. Publish through the supported workflow

- Run `Actions > Tag and Release` with version `5.23.0` and the repaired target ref.
- Verify the tag job succeeds and the reusable `release.yml` job is called in the same run.
- Verify setup, all standalone builds, extension build, checksums, attestation, asset upload, and release-note replacement complete.

### 6. Prove completion from GitHub

- Confirm a fresh `CI Build` run for the repair commit completes successfully.
- Confirm the remote `v5.23.0` tag points to the intended commit.
- Confirm the `v5.23.0` release exists with non-empty extension assets, installers, checksums, and release notes.
- Record any external runner, permissions, or billing blocker separately with the exact GitHub status. Do not label an account condition as a repository fix.

## Completion criteria

- `scripts/check-vi-func.mjs` ignores `.old-github/` and still catches real source violations.
- `pnpm run test:quiet` passes.
- Workflow parser and CI policy tests pass.
- Extension build and Playwright suite pass.
- GitHub CI is green for the repair commit.
- `v5.23.0` exists remotely and its release contains the built artifacts, not only GitHub source archives.