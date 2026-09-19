---
name: Release workflow trigger policy
description: release.yml must fire exactly once per tag. No bare create: trigger, release: types limited to published.
type: constraint
---
# Release workflow trigger policy

`.github/workflows/release.yml` MUST resolve to exactly **one** Release Build run
per tag. Allowed triggers, and nothing else:

- `push: tags: ["v*"]`
- `release: types: [published]`
- `workflow_dispatch` with a `version` input
- `workflow_call` with a `version` input, used by `tag-and-release.yml`

## Forbidden

- **A bare `create:` trigger.** `create` fires on BRANCH creation as well as tag
  creation. Creating a `release/v5.24.0` branch started a full Release Build.
- **Multiple `release:` types** (`created`, `edited`, `prereleased`, `released`).
  The early `create-release-page` job publishes the release, which then emits
  more release events, which start more runs of the same workflow. Tagging
  `v5.24.0` produced five runs in three seconds; the
  `release-${{ github.ref }}` concurrency group cancelled three of them.

## Why it matters

`cancel-in-progress: false` does not queue unlimited runs. GitHub keeps the most
recent pending run in a concurrency group and **cancels** the rest. Those
cancelled runs are what made the Actions tab look like the release pipeline was
never triggering.

Enforced by `scripts/__tests__/ci-workflow-trigger-policy.test.mjs`.
Background: `.lovable/memory/rca/06-release-published-without-assets.md`.