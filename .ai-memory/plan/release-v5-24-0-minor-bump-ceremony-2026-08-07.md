# Release v5.24.0 (MINOR bump ceremony)

Previous version: **5.23.0** (from `version.json`, the canonical version source)
New version: **5.24.0** (MINOR bump, PATCH reset to 0)
Release date: 2026-08-07 (UTC, from `date -u`)

Pre-flight: the canonical file reads 5.23.0 (not already bumped), the v5.23.0 changelog entry has real bullets (no placeholder), date taken from `date -u`.

## Pin sites confirmed on disk

`rg "5\.23\.0"` returns 20 matches across 4 files:

- `version.json` (canonical version plus `releaseDate`)
- `manifest.json` (extension version)
- `readme.md` (badges, install snippets, download URLs, zip filenames)
- `changelog.md` (historic, stays untouched)

## Steps

1. Set `version.json` to `5.24.0` with `releaseDate` 2026-08-07.
2. Sync `manifest.json` to 5.24.0 via `scripts/sync-manifest-version.mjs`.
3. Rewrite every `5.23.0` / `v5.23.0` occurrence in `readme.md` so `rg "5\.23\.0" readme.md` returns nothing.
4. Add the `## [v5.24.0] 2026-08-07` entry at the top of `changelog.md` covering the real unreleased work since v5.23.0:
   - `scripts/check-vi-func.mjs` now skips `.lovable/` and `.old-github/`, so archived workflow snapshots no longer fail the preflight guard.
   - `scripts/__tests__/check-vi-func.test.mjs` regression test for archive exclusion.
   - `.lovable/prompts/14-release.md` re-synced byte-for-byte with `standalone-scripts/prompts/22-release/prompt.md` to fix the `default-prompt-content` contract test.
5. Save this prompt body to `.lovable/prompts/14-release.md` (overwrite in place) and keep the `22-release` source mirror byte-identical, then regenerate aggregated prompt artifacts with `scripts/aggregate-prompts.mjs`.
6. Verification gates, all must pass: `check-markdown-filenames`, `check-workflow-yaml`, `test:cicd-spec`, `pnpm run test:quiet`, and a final `rg "5\.23\.0"` matching only `changelog.md` and `.lovable/release/`.
7. Tagging: the sandbox cannot run git commands, so no commit or `git tag v5.24.0` is created here. Log `.lovable/release/issues/01-5-24-0-git-tag-skipped.md` and link it from an `### Issues` bullet in the changelog. Publishing stays manual via **Actions > Tag and Release** with version `5.24.0`; nothing is auto-published.

## Notes

Git tags remain the source of truth for the released version. `version.json` is the build-time pin that CI's remote-tag preflight compares against, so the tag must be dispatched after this commit lands or that gate reports the missing `v5.24.0` tag.