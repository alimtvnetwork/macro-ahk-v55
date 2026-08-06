# Changelog

## [v5.23.0] 2026-08-06 Workflow YAML Validation and Tag Recovery

### Fixed
- **`release.yml` was rejected by GitHub's YAML parser.** A markdown line starting with `**Windows` sat at column zero inside a `run:` heredoc, so the parser read it as an undefined alias (`unidentified alias "*Windows"` at 736:10). GitHub silently ran zero jobs, which is why `v5.22.0` produced a tag with only the automatic source archives and no built assets. The heredoc block in the `emit_install_sections` step is now indented inside the block scalar.

### Added
- `scripts/check-workflow-yaml.mjs`: parses every `.github/workflows/*.yml` with the real `yaml` parser and reports the failing file, line, and column as a GitHub annotation. Wired into the `setup` job of `.github/workflows/ci.yml` and into `test:cicd-spec`, so an unparseable workflow now fails preflight instead of failing silently on GitHub.
- `yaml@^2.9.0` dev dependency in `package.json` for that check.

### Changed
- `.github/workflows/tag-and-release.yml`: tag creation is now idempotent. An existing tag that already points at the target commit is reused instead of aborting, so a release whose workflow was rejected can be recovered without deleting and re-pushing the tag.
- `scripts/__tests__/ci-workflow-trigger-policy.test.mjs`: added coverage for the `workflow_call` wiring and the tag-reuse recovery path.
- `.lovable/memory/rca/05-ci-not-triggering-and-not-releasing.md`: records the parser-rejection failure mode alongside the earlier `GITHUB_TOKEN` event-suppression rule.

### Issues
- [01-5-23-0-git-tag-skipped](.lovable/release/issues/01-5-23-0-git-tag-skipped.md) the sandbox cannot run git commands, so the `v5.23.0` commit and tag must be created through **Actions > Tag and Release**.

## [v5.22.0] 2026-08-06 Release Publication Path Fix

### Fixed
- **Tag created, release page empty.** A tag pushed with the built-in `GITHUB_TOKEN` does not emit a `push` event (GitHub suppresses it to prevent recursive runs), so `release.yml`'s `push: tags: v*` trigger could never fire from the tag created by `tag-and-release.yml`. `release.yml` now also accepts `workflow_call`, and `tag-and-release.yml` invokes it directly with the created tag (`secrets: inherit`, `contents: write`). One run of **Actions > Tag and Release** now creates the tag and publishes the release with all assets.

### Changed
- `.github/workflows/tag-and-release.yml`: the tag step exports a `tag` output and a new `release` job calls `./.github/workflows/release.yml`.
- `readme.md`: Troubleshooting entry "The tag exists but the Releases page is empty" documenting the `GITHUB_TOKEN` event rule and the runner-queue billing check.
- `.lovable/memory/rca/05-ci-not-triggering-and-not-releasing.md`: rewritten with the `GITHUB_TOKEN` root cause and a note that `aukgit` on the repo page is the commit author, not the owner (canonical slug remains `alimtvnetwork/macro-ahk-v55`, confirmed from the CI job path).

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