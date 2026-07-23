---
name: Release runbook and failure modes
description: Release is one version.json edit plus optional v* tag. No stale-ref, readiness, version-sync, changelog, readme-pin, or asset-manifest gates.
type: preference
---

# Release Runbook

## Rule

Release is limited to one repo edit: `version.json` (`version` and `releaseDate`).

If publishing is explicitly requested, the only second action is creating the matching `v<version>` Git tag. The tag triggers `.github/workflows/release.yml`.

`release.yml` must also keep `release` event coverage because GitHub web UI, REST API, and external release tooling can create a Release page and tag server-side without a normal tag-push event.

## Never re-add

- Version propagation workflows.
- Stale-version or stale-reference scripts.
- Release-readiness scripts.
- Readme version pin checkers.
- Changelog entry checkers.
- Release asset manifest generation, diffing, or verification.
- Manifest/version sync lifecycle hooks before build or test.

## Manifest version mismatch rule

If the popup reports extension manifest version versus bundled script version drift, do not fix it by only copying a number into `manifest.json`. Fix the automated path instead: source manifest sync script, Vite `copyManifest()` version injection, and the post-build built-manifest guard must all read root `version.json`.

## Root cause of the repeated failures

The failed releases came from CI/CD trying to validate or propagate derived version artifacts after `version.json` changed. Those derived checks produced false failures, wasted time, and conflicted with the single-source-of-truth policy.

## Current flow

1. Read `version.json`.
2. Compute the requested version. Default release bump is MINOR.
3. Edit only `version.json`.
4. If publishing was requested, create the matching `v<version>` Git tag.
5. Report the new version and tag status only.

## Required release workflow triggers

- `push.tags: v*` for normal pushed tags.
- `create` for tag creation events.
- `release` for GitHub Release page creation, edits, prereleases, and published releases.
- `workflow_dispatch` for manual recovery of an already-existing tag or Release page.

## If a GitHub Release has missing assets

Treat it as a release workflow execution problem for that tag. Do not add historical asset auditors, manifest files, readiness gates, or superseded-tag logic.