# CI/CD Issue 13 - Release page not completed from server-side tag

## Pipeline / Workflow

`.github/workflows/release.yml`

## Symptom

A `v*` tag exists and GitHub shows only the automatic source archives on the Release page. The expected built ZIP files, installer scripts, checksums, and generated release notes are absent.

## Root Cause

The recent simplification reduced `release.yml` to only this trigger:

```yaml
on:
  push:
    tags:
      - "v*"
```

That catches tags pushed with a normal git push, but it does not reliably catch GitHub web UI, REST API, or external release tooling paths that create the tag and Release page server-side. In those paths GitHub can show a Release page with only source archives while the asset packaging workflow never runs.

## Fix

Restored all required release entry paths in the single publishing workflow:

- `push.tags: v*`
- `create` for tag create events
- `release` for GitHub Release page events
- `workflow_dispatch` for manual recovery

The workflow resolves the target tag from manual input, release event payload, pushed tag ref, or create-event tag ref, then checks out `refs/tags/<tag>` and validates that `version.json` resolves to the same tag before uploading assets.

## Prevention

`scripts/__tests__/ci-workflow-trigger-policy.test.mjs` now pins those triggers so the `release` event cannot be removed again without a failing test.

## Follow-up (v4.397.0): Release page must exist even when downstream fails

Restoring the triggers was necessary but not sufficient. If `setup` (lint/tests) or any build job failed on the tagged commit (e.g. `version.json` version did not match the tag, or a test regressed), the `release` job never ran and the tag stayed on GitHub with no Release page. Users saw tags v4.395.1, v4.395.2, v4.395.3 with only auto source archives.

Fix: added a new `create-release-page` job at the top of `.github/workflows/release.yml` that runs on every `push.tags: v*`, `create`, `release`, and manual dispatch. It has zero dependencies on lint/tests/builds, resolves the tag from the event payload, and calls `softprops/action-gh-release@v2` to guarantee the Release page exists. The existing asset-building `release` job still runs in parallel and uploads binaries to the same tag when it finishes. If builds fail, the Release page is still there with a note pointing at the Actions tab.
