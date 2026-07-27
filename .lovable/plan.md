# Release page empty (v5.11.0) — root cause + repo-URL-agnostic hardening

## What is broken

`v5.11.0` on GitHub (`alimtvnetwork/macro-ahk-v53`) shows only 2 GitHub-generated source archives, a plain "Release v5.11.0" body, and no built ZIPs / installers / checksums / rich notes. Previous releases (e.g. `v4.404.0` under `macro-ahk-v55`) had the full asset set + rich body.

## Root cause (three compounding defects)

1. **Hardcoded owner/repo in installer contract and downstream artifacts.** `scripts/installer-contract.json → repo.default` is pinned to `alimtvnetwork/macro-ahk-v55`, but the current active repo is `alimtvnetwork/macro-ahk-v53`. `check-installer-contract.mjs` runs in `setup` (lint/test). On a repo rename it fails, so `setup` fails, so `build-*` + `release` jobs never run, so only the early `create-release-page` job succeeds, producing the empty page we see.
2. **Placeholder body is what wins when the build job fails.** `create-release-page` writes a terse body; `Force rich release notes` (which uses `body_path`) lives inside the `release` job that never ran. On any setup/build failure the placeholder is the final body — exactly what the screenshot shows (actually even less: a bare "Release v5.11.0", meaning create-release-page itself may also have short-circuited on this tag).
3. **No tag was pushed for `v5.11.0` through the actions pipeline.** `.gitmap/release/v5.11.0.json` was created (metadata-only release), but `release.yml` only fires on `push: tags: v*` / `workflow_dispatch` / `release: created`. The `.gitmap`-driven release created a tag+release page out-of-band without triggering `release.yml`. Combined with (1), even a manual re-run fails at `setup`.

**Why a repo rename breaks this:** every place that hardcodes `owner/repo` (installer contract, install scripts, badges, docs) becomes wrong the moment the repo is renamed or forked. CI gates that assert these values against the live repo (`GITHUB_REPOSITORY`) start failing and cascade-kill the release job. `github.repository` in the workflow is fine; the hardcoded JSON/scripts/docs are not.

## Fix

### 1. Make the pipeline auto-heal on repo rename

- **`scripts/installer-contract.json`**: change `repo.default` to a sentinel `"__GITHUB_REPOSITORY__"`. Add `repo.autoResolve: true` so `check-installer-contract.mjs` reads `process.env.GITHUB_REPOSITORY` (falling back to `git remote get-url origin` parse) instead of comparing to a hardcoded literal.
- **`scripts/check-installer-contract.mjs`**: when `repo.autoResolve` is true, resolve the expected owner/repo dynamically and stop comparing to a static string. Installer scripts (`install.sh`, `install.ps1`, `installer-constants.{sh,ps1}`) get their default from the same resolver at build time via a new `scripts/resolve-repo-slug.mjs` helper that CI writes into `installer-constants.generated.{sh,ps1}`.
- **New `.github/workflows/release.yml` step** (in `setup`, before lint): `Resolve repo slug` writes `REPO_SLUG=${GITHUB_REPOSITORY}` into `$GITHUB_ENV` and regenerates `installer-constants.generated.*` so no gate can fail on rename.
- **New CI job `verify-no-hardcoded-repo`** in `spec-gates.yml`: greps for `alimtvnetwork/macro-ahk-v` and `aukgit/macro-ahk-v` in tracked files (excluding historical RCA docs) and fails if any appear. Prevents recurrence.

### 2. Guarantee the release page always gets the rich body + assets

- **`release.yml → create-release-page`**: expand the placeholder body to include a visible "⚠️ Build in progress or failed — check Actions" banner and always include the `## Marco Extension {TAG}` header so the empty-title case in the screenshot cannot happen.
- **`release.yml → release job`**: add `needs: [create-release-page, setup, build-extension]` with `if: always() && needs.build-extension.result == 'success'` so a partial failure is loud, and add a final `on-failure` job that edits the release body to append the failing job URLs (so future empty releases are self-explaining on the page itself).
- **New trigger**: add `on: release: types: [created]` handling that also runs the build when the release was created out-of-band (e.g. by `.gitmap`), so metadata-only tag creation still produces assets.

### 3. Documentation + memory

- **New `.lovable/memory/features/release-pipeline-repo-url-agnostic.md`** (developer-oriented): explains the failure chain, the sentinel + `GITHUB_REPOSITORY` resolver contract, the new spec-gate, and the "how to rename this repo safely" checklist.
- **Update `.lovable/what-to-read.md`**: add a "Before touching CI/CD or releases" bullet pointing to the new memory file and to `.lovable/cicd/issues/02-release-page-missing-built-assets.md` + `12-stale-repo-owner-ci-report-links.md`.
- **Update root `readme.md`**: new "Release pipeline" subsection under Contributing that summarizes the repo-URL-agnostic contract for developers (2–3 short paragraphs, no CI internals).

### 4. Minor version bump + changelog + readme pin

- `version.json`: `5.11.0 → 5.12.0`, `releaseDate: 2026-07-27`.
- Root `changelog.md` + `standalone-scripts/macro-controller/changelog.md`: add `## v5.12.0` entry summarizing the fix.
- Root `readme.md`: repin all 14 install snippets, badges, and pinned-version callouts from `v5.11.0` to `v5.12.0`.
- `.gitmap/release/latest.json` + new `.gitmap/release/v5.12.0.json`.

## Technical details

- `check-installer-contract.mjs` change is backwards-compatible: if `repo.autoResolve` is absent, it keeps the old literal check.
- Repo resolver precedence: `GITHUB_REPOSITORY` env → `git config --get remote.origin.url` parse → error with actionable message.
- The generated `installer-constants.generated.{sh,ps1}` files are gitignored; the tracked `installer-constants.{sh,ps1}` source them with a fallback constant equal to the current `GITHUB_REPOSITORY` at commit time (kept fresh by CI's `verify-no-hardcoded-repo` gate).
- Version bump is minor (5.12.0) per the "every code change bumps at least minor" policy in `pipeline/06-versioning.md`.
- No touching of the closed `.gitmap/release/v5.11.0.json`.

## Verification

- `node scripts/check-installer-contract.mjs` under `GITHUB_REPOSITORY=alimtvnetwork/macro-ahk-v53` and `=alimtvnetwork/macro-ahk-v55` both pass.
- Local dry run of `.github/workflows/release.yml` via `act` (or manual `workflow_dispatch` with `version: v5.12.0`) produces all expected assets.
- `bunx vitest run` for existing installer/contract tests stays green.
- New test `scripts/__tests__/installer-contract-repo-autoresolve.test.mjs` asserts the resolver returns the env value.
