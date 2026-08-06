# Changelog

## [v5.21.0] 2026-08-06 CI Trigger and Release Path Repair

### Added
- `.github/workflows/tag-and-release.yml`: a `workflow_dispatch` job that validates the version input, refuses to overwrite an existing tag, and creates plus pushes `v<version>` server-side with `GITHUB_TOKEN`. `release.yml` then triggers from that tag push, so a release no longer depends on a local `git tag` the sandbox cannot create.

### Fixed
- Repository slug drift: `scripts/clone-ahk.mjs` now resolves the slug at runtime through `resolveRepoSlug()` with `alimtvnetwork/macro-ahk-v55` as the compiled-in fallback, and treats `aukgit/macro-ahk-v55` as the stale owner. `scripts/prompt-creator-cli/{install.sh,install.ps1,readme.md}` and `scripts/print-quality-badges.mjs` were still pinned to the `aukgit` slug and are now unified.
- `scripts/check-remote-tag.mjs` no longer skips silently on a `-dev` version. It logs `[BYPASS]` and writes a GitHub Step Summary warning stating that release readiness was not verified.

### Changed
- `.github/workflows/ci.yml` concurrency: `cancel-in-progress` is now scoped to pull requests. Pushes to `main` always run to completion instead of being cancelled by the next commit, which was being misread as "CI never triggered".
- `scripts/__tests__/ci-workflow-trigger-policy.test.mjs` asserts the corrected canonical/stale owners and the runtime slug resolution.
- `pipeline/03-release-workflow.md` Companion Workflows table lists `tag-and-release.yml`.

### Notes
- A job stuck at `Waiting for a runner to pick up this job...` is a GitHub account condition (runner minutes, spending limit, or Actions disabled), not a repository defect. No workflow change can clear it.

## [v5.20.0] 2026-08-06 Action Download Surface Reduction

### Changed
- Replaced all 21 `pnpm/action-setup@v4` steps in `.github/workflows/ci.yml` and `.github/workflows/release.yml` with native `corepack enable && corepack prepare pnpm@9 --activate` shell steps, removing 21 action-resolution calls per pipeline run.
- Replaced `oven-sh/setup-bun@v2` in `.github/workflows/ci.yml` with the official `curl | bash` install plus a `GITHUB_PATH` append.

### Fixed
- `scripts/clone-ahk.mjs`: `CANONICAL_REPO` equalled `STALE_REPO` (`alimtvnetwork/macro-ahk-v55`), which failed `scripts/__tests__/ci-workflow-trigger-policy.test.mjs`. Set to `aukgit/macro-ahk-v55`; the suite is now 6/6 green.

### Added
- `.lovable/memory/rca/04-action-download-resolution-hardening.md` documenting the `Failed to resolve action download info` failure class, the mitigation, and the residual risk.

### Issues
- [01-5-20-0-git-tag-skipped](.lovable/release/issues/01-5-20-0-git-tag-skipped.md) git tag and commit cannot be created from the sandbox; apply manually.

## [v5.19.0] 2026-08-06 CI/CD Recovery and Remote Tag Hardening

### Fixed
- Hardened `scripts/check-remote-tag.mjs` to be remote-agnostic: it now auto-resolves the repository slug and uses the full GitHub URL for `ls-remote` checks, preventing failures when the 'origin' remote is missing or misconfigured in limited CI environments.
- Synchronized all version pin sites in `readme.md` to v5.19.0.
- Regenerated `macro-prompts.json` and updated `manifest.json` version.
- Verified coding guidelines and root README compliance.

### Added
- Performed **v5.19.0** MINOR bump ceremony.
- Logged `.lovable/release/issues/01-5-19-0-git-tag-skipped.md` for manual git tag requirement.

## [v5.18.0] 2026-08-06 fix cicd for E2E · Playwright
...keep existing content...