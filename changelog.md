# Changelog

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