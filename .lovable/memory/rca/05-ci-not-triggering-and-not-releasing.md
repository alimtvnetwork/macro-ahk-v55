---
name: CI not triggering and not releasing
description: Runner queue stalls are account-level; missing v* tags are why release.yml never runs. Fixed with tag-and-release.yml.
type: feature
---

# Why CI looked dead and releases never shipped

1. `Waiting for a runner to pick up this job...` is a GitHub account condition
   (runner minutes, spending limit, Actions disabled). No repo change clears it.
2. `release.yml` only triggers on a pushed `v*` tag. The sandbox cannot push tags,
   so every ceremony ended with a "git tag skipped" issue and no Release run.
   Fix: `.github/workflows/tag-and-release.yml` creates the tag server-side.
3. `-dev` suffix in `version.json` silently disabled `check-remote-tag.mjs`.
   The guard now prints `[BYPASS]` plus a Step Summary warning.
4. `cancel-in-progress: true` on all pushes cancelled main runs, which read as
   "CI never triggered". Now scoped to pull requests only.
5. Canonical repo slug is `alimtvnetwork/macro-ahk-v55`; `aukgit/...` is stale.

## Release procedure now

Land the version commit, then run Actions > Tag and Release with the version.