# 20 - E2E user-scope export seed invariant

**Opened:** 2026-07-27
**Severity:** Low (test authoring guardrail)

## Rule

Any Playwright/Vitest test that exercises `exportPromptsToJson` (or code paths that go through `filterUserAddedEntries`) MUST seed entries with `isDefault: false`. Default-flagged rows are filtered out by the v5.9.0 user-scope export refactor, so the download blob never fires and `page.waitForEvent('download')` times out.

## Background

`tests/e2e/prompt-export-import-roundtrip.spec.ts` regressed in CI after v5.9.0 because both seeded entries had `isDefault: true`. Fixed in v5.11.0 by flipping the flag and adding an inline comment on the seed block.

## Action

- If a similar timeout appears in another export-related suite, first check the `isDefault` flag on the seed rows.
- Consider hoisting a shared helper `seedUserAddedEntries(page, entries)` under `tests/e2e/harness/` that forces `isDefault: false` so future authors cannot regress this.

## References
- `standalone-scripts/macro-controller/src/ui/prompt-io.ts` (`filterUserAddedEntries`)
- `.lovable/memory/features/prompts-import-export-user-scope.md`
- changelog `v5.11.0`