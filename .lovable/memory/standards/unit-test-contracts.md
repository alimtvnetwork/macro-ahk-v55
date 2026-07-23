---
name: Unit test contract alignment
description: Tests must assert current canonical source contracts, not retired literals from older migrations
type: standards
---

# Unit test contract alignment

When a prompt, seed, migration, or generated artifact changes identity fields such as `Slug`, `Id`, `Version`, or category, update tests to assert the current canonical contract across all synced sources.

Do not patch a failing test by changing one hardcoded expected value in isolation. First identify the source of truth, then verify the canonical file, mirror manifest, generated JSON, and UI or database-facing seed agree.

For Read Memory, the canonical slug is `read-memory-enhanced`. The retired `read-memory` slug is legacy data that migrations disable or remove, not an active default prompt slug.

The prompt dropdown must show exactly one Read Memory prompt: `read-memory-enhanced`. Legacy IDs or slugs such as `default-read-memory`, `read-memory`, `read-memory-imported`, `read-memory-old`, `read-memory-v1`, and `read-memory-v2` must be deleted, disabled, or hidden, never shown beside the canonical prompt.

Default dropdown ordering must end with `read-memory-enhanced`, `write-memory`, and `release` in that exact order. No other prompt belongs after Read Memory once the default order is reset or exported/imported.

Regression tests for prompt identity must compare all relevant synced sources in the same test file so stale legacy assumptions fail with a clear mismatch.

When a test fails after a feature change, first decide whether the failure exposes real product behavior drift. If it does, fix the source behavior and add or update coverage for that behavior. Only update expectations when the source contract intentionally changed and all canonical sources agree.

Quiet CI test output must keep passing-test logs hidden. On failure it must print a red, focused failure block with the failed exit code, Vitest failure details when available, and the last active test when a worker aborts before Vitest emits a failure block.