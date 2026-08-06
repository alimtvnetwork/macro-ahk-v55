# Why the tag lands but no release page appears

## What the screenshot actually shows

Commits reach GitHub fine: `Release v5.21.0`, 411 commits, 5 minutes old, 10 tags, 11 branches. `aukgit` there is the commit author, not necessarily the repo owner (the CI job in the earlier run was defined under `alimtvnetwork/macro-ahk-v55`). So pushing works and CI is wired to `on: push` with no branch filter. Two real defects remain, plus one account condition.

## Root cause 1: a tag pushed with GITHUB_TOKEN does not start another workflow

`tag-and-release.yml` creates and pushes `v<version>` using the built-in `GITHUB_TOKEN`. GitHub deliberately suppresses new workflow events for pushes made with that token, to prevent recursive runs. `release.yml` listens only on `push: tags: v*`, so the tag lands and nothing runs. That is exactly the "tag exists, release page empty" symptom, and it is the thing I got wrong last session.

Fix: stop depending on a second event. Add `workflow_call` to `release.yml` and have `tag-and-release.yml` call it directly after creating the tag, so one dispatch produces the tag and the published release in a single run.

## Root cause 2: the canonical repo slug is unverified

The compiled-in fallback slug is `alimtvnetwork/macro-ahk-v55`, while `aukgit/macro-ahk-v55` is treated as stale. In CI `GITHUB_REPOSITORY` overrides both, so builds pass either way, but installer download URLs, badge links, and `check-remote-tag` fall back to the literal. Before changing anything, the first step is to confirm the owner from the repository URL and align every fallback site to it, in one pass, instead of guessing again.

## Root cause 3: the runner queue, which no code change can fix

"Waiting for a runner to pick up this job" for 20+ minutes is an account condition: Actions minutes exhausted, spending limit reached, or Actions restricted. This gets documented in the readme troubleshooting section, not "fixed" in a workflow.

## Changes

1. `.github/workflows/release.yml`: add `workflow_call` to `on:` with an optional `version` input, and make the version-resolution step accept it, so the workflow behaves identically for tag push, manual dispatch, and call.
2. `.github/workflows/tag-and-release.yml`: add a second job that `uses: ./.github/workflows/release.yml` with the created tag, `secrets: inherit`, `permissions: contents: write`. One click yields tag plus release assets.
3. Slug alignment: confirm the owner, then set it consistently in `scripts/installer-contract.json` (`repo.default`, `repo.fallback`), `scripts/clone-ahk.mjs`, `scripts/print-quality-badges.mjs`, `scripts/installer-constants.{sh,ps1}`, `scripts/prompt-creator-cli/{install.sh,install.ps1,readme.md}`, readme and docs, with `scripts/__tests__/ci-workflow-trigger-policy.test.mjs` and `installer-contract-repo-autoresolve.test.mjs` updated to the confirmed canonical/stale pair.
4. `readme.md`: short "release did not appear" troubleshooting entry covering the GITHUB_TOKEN event rule and the runner-queue billing check.
5. `.lovable/memory/rca/05-ci-not-triggering-and-not-releasing.md`: rewrite with the GITHUB_TOKEN finding so this is never misdiagnosed again.

## Release

Run the v5.22.0 MINOR bump ceremony: `version.json`, `manifest.json`, readme pin sites, changelog entry, regenerated prompt bundles, then coding-guidelines and readme compliance checks plus `pnpm run test:quiet`.

Publishing then becomes one action: Actions > Tag and Release, version `5.22.0`, which creates the tag and publishes the release in the same run.