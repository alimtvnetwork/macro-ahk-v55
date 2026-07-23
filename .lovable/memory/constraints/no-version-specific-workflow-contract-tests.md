---
name: No version-specific workflow contract tests
description: Never add tests or inert workflow markers that require historical version tags, SKIP_TAGS, or removed release-auditor asset lists.
type: constraint
---

# No version-specific workflow contract tests

## Rule

Do not add CI tests, regex assertions, comments, or inert markers that require workflow files to contain historical version tags, `SKIP_TAGS`, superseded release names, or removed auditor asset lists.

## Why

Release auditor and asset validation workflows are removed by policy. Tests that force those removed workflows to preserve fake strings such as `v3.104.1`, `v4.298.0`, `SKIP_TAGS`, `download-extension.ps1`, or `clone-repo.ps1` create brittle version checking without functional value.

## How to apply

- Keep `scripts/__tests__/ci-workflow-trigger-policy.test.mjs` focused on trigger policy and required active workflow behavior.
- Do not assert historical version strings in workflow YAML.
- Do not add placeholder comments just to satisfy regex tests.
- Do not reintroduce auditor requirements for removed workflows.