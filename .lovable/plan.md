## Release v5.13.0 (MINOR bump)

Per the new rule (`mem://spec/commands/05-tag-is-single-source-of-truth-for-version`), the git tag IS the release version. `version.json` is a build-time artifact regenerated from the tag by `scripts/write-version-from-tag.mjs`. Releasing = create and push a `v*` tag. No repo file edits.

### Current → New
- Previous tag: `v5.12.1`
- New tag: **`v5.13.0`** (default MINOR bump)

### Steps (single turn, in order)

1. Run the pre-release checklist from `.lovable/how-to-release.md` (typecheck, lint, tests, strict-flag, canonical logger, unresolved-import guard, filename hygiene, repo-slug sync, installer contract). Abort and log an issue under `.lovable/release/issues/` if any item fails.
2. Confirm previous version by reading the latest `v*` git tag via `git describe --tags --abbrev=0` (NOT `version.json`).
3. Create the annotated tag `v5.13.0` on the release branch. Do NOT edit `version.json`, `manifest.json`, `readme.md`, `changelog.md`, constants, install scripts, prompt bundles, or any other file to propagate the version.
4. Push the tag: `git push origin v5.13.0`. That triggers `.github/workflows/release.yml`, which:
   - resolves version from the tag,
   - runs `sync-repo-slug.mjs`,
   - regenerates `version.json` in-workflow via `scripts/write-version-from-tag.mjs`,
   - runs `build-sdk`, `build-xpath`, `build-macro-controller`, `build-prompts`,
   - uploads ZIPs, installers, checksums, and generated release notes to the tag's Release page via `softprops/action-gh-release`.
5. If any workflow job fails or a step is skipped, create `.lovable/release/issues/NN-v5-13-0-<slug>.md` with the failing job URL and root cause. Do not retry blindly.

### Not doing (non-negotiable)

- No edits to `version.json` (it stays as the `0.0.0-dev` placeholder in git).
- No changelog/readme/manifest pin edits.
- No new watcher, auditor, readiness, or asset-manifest workflow.
- No PATCH/MAJOR bump (user did not specify; default is MINOR).
- No `preview_ui--publish` call: that publishes the Lovable web preview, which is unrelated to the extension release pipeline.

### Verification after tag push

- Confirm `release.yml` `setup` job passes and `publish_tag=v5.13.0`.
- Confirm all 4 `build-*` jobs succeed and the `release` job uploads assets to `https://github.com/<owner>/<repo>/releases/tag/v5.13.0`.
- Confirm the tag page shows real notes + ZIPs/installers/checksums (not the empty-page failure mode from v5.12.1).
