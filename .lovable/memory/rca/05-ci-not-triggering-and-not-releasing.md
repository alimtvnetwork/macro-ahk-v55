---
name: CI not triggering and not releasing
description: GITHUB_TOKEN tag pushes emit no push event, so release.yml never ran; runner queue stalls are account-level. Fixed by workflow_call.
type: feature
---

# Why CI looked dead and releases never shipped

0. **THE tag-lands-but-no-release ROOT CAUSE.** A push made with the built-in
   `GITHUB_TOKEN` does not emit a `push` event; GitHub suppresses it to prevent
   recursive runs. `tag-and-release.yml` creates the tag with `GITHUB_TOKEN`, so
   `release.yml`'s `push: tags: v*` trigger could never fire from it. The tag
   appeared on the remote and the Releases page stayed empty.
   Fix: `release.yml` exposes `workflow_call` and `tag-and-release.yml` calls it
   with the created tag in the same run.
   NEVER "fix" a missing release by relying on an implicit tag-push event from a
   workflow-created tag. It cannot work. Use `workflow_call`, a PAT, or
   `gh workflow run`.

1. `Waiting for a runner to pick up this job...` is a GitHub account condition
   (runner minutes, spending limit, Actions disabled). No repo change clears it.
2. The sandbox cannot push tags, so a ceremony alone never starts a release.
   `.github/workflows/tag-and-release.yml` creates the tag server-side and now
   also runs the release pipeline itself.
3. `-dev` suffix in `version.json` silently disabled `check-remote-tag.mjs`.
   The guard now prints `[BYPASS]` plus a Step Summary warning.
4. `cancel-in-progress: true` on all pushes cancelled main runs, which read as
   "CI never triggered". Now scoped to pull requests only.
5. Canonical repo slug is `alimtvnetwork/macro-ahk-v55` (confirmed from the CI job
   path `alimtvnetwork/macro-ahk-v55/.github/workflows/ci.yml@refs/heads/main`).
   `aukgit` seen on the repo page is the commit author, not the owner. Do not
   flip slugs based on an author avatar. In CI `GITHUB_REPOSITORY` wins anyway.

## Release procedure now

Land the version commit, then run Actions > Tag and Release with the version.
That single run creates `vX.Y.Z` and builds/publishes the release assets.