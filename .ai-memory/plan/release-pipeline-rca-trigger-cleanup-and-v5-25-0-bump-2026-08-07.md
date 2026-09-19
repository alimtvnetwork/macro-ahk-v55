# Release pipeline RCA, trigger cleanup, and v5.25.0 bump

## What I verified against the live repository (not guesses)

Queried the GitHub REST API for `alimtvnetwork/macro-ahk-v55`:

- The `v5.24.0` tag exists on the remote and **Release Build run 31197971381 completed successfully**. Every job passed: Setup, Create Release Page, Build Prompts, Build Marco SDK, Build XPath, Build Macro Controller, Build Extension + Release.
- The `v5.24.0` release page now carries **18 assets**, including `marco-extension-v5.24.0.zip` (2.32 MB), `prompts-v5.24.0.zip` (111 KB), `macro-controller-v5.24.0.zip`, the SDK, XPath, all four lovable plugins, both installers, checksums and release notes.
- Every earlier release from `v5.9.0` through `v5.22.0` has **0 assets**. v5.24.0 is the first release in this repo that actually shipped the built extension and prompts.
- The old `.old-github/.github/workflows/` folder is a **subset** of the current one: the same 10 workflows plus the new `tag-and-release.yml`. The extension build and packaging steps in `release.yml` are equivalent to the old ones (same `pnpm run build:extension`, same `zip -r marco-extension-${VER}.zip`, same prompts zip). Nothing was deleted.

So the build steps were never missing. What was broken was **whether the workflow ran at all**, and that had three separate causes.

## Root causes (confirmed by run history)

1. **Invalid YAML in `release.yml` (v5.22.0 era).** A heredoc of Markdown was indented into the YAML body, so GitHub could not parse the file. Every push produced a run with a startup failure and zero jobs: runs 31124528184 through 31127144064 all show `event=push, branch=main, conclusion=failure` with no jobs at all. That is why tags produced a release page with no assets. Fixed in v5.23.0 by `scripts/check-workflow-yaml.mjs`, which now parses all 11 workflows in CI.
2. **Tags created by `GITHUB_TOKEN` do not emit a push event.** Server-side tagging could never fire `push: tags: v*`. Fixed by `tag-and-release.yml` calling `release.yml` through `workflow_call`.
3. **Trigger fan-out, still live and still wrong.** `release.yml` listens on `push: tags`, a bare `create:`, and `release:` with five types. Tagging `v5.24.0` produced **five** Release Build runs in three seconds; three were cancelled by the `release-${{ github.ref }}` concurrency group, and one was fired by creation of the unrelated `release/v5.24.0` **branch**. Cancelled runs on the Actions tab are exactly what looked like "CI never triggers, nothing releases".

## Why I got this wrong repeatedly

- I diffed workflow files and declared the pipeline fixed instead of reading Actions run history and the release asset list from the API. A clean diff proves nothing about a run.
- A startup failure shows zero jobs, so it is invisible unless the run itself is opened. I never opened one.
- I treated three independent causes as one bug and re-declared victory after fixing only one layer.

## Changes to make

### 1. Tighten `release.yml` triggers
- Remove the bare `create:` trigger, so branch creation never starts a release build.
- Reduce `release:` types to `published` only, dropping `created`, `edited`, `prereleased`, `released`.
- Keep `push: tags: v*`, `workflow_dispatch`, `workflow_call`.

Result: one run per tag instead of five, no cancellation noise.

### 2. Add a post-release asset verification gate
New `scripts/check-release-assets.mjs`, run as the final step of the `release` job: query the release for the tag and fail if `marco-extension-<tag>.zip`, `prompts-<tag>.zip`, `macro-controller-<tag>.zip`, `install.ps1`, `install.sh` or `checksums.txt` is missing or under its size floor. A release that publishes without the extension zip must go red, not silently green.

### 3. Write the RCA into project memory
- `.lovable/memory/rca/05-release-not-publishing-assets.md`: the three causes above, the run IDs as evidence, and the standing rule **verify releases through the Actions API and the release asset list, never through a file diff**.
- `.lovable/memory/constraints/release-workflow-triggers.md`: never add a bare `create:` trigger, never subscribe to multiple `release:` types, one tag equals one run.
- Update `.lovable/memory/rca/index.md` and `.lovable/memory/index.md` to link both.

### 4. Update `.lovable/what-to-read.md`
Add a "Before touching CI/CD or cutting a release" section pointing at the new RCA, the trigger constraint, `.lovable/how-to-release.md` and `pipeline/02-ci-workflow.md`, plus a changelog line for this session.

### 5. v5.25.0 MINOR bump ceremony
- `version.json` to `5.25.0`, `releaseDate` 2026-08-07.
- Sync `manifest.json` via `scripts/sync-manifest-version.mjs`.
- Rewrite every `5.24.0` pin in `readme.md` so `rg "5\.24\.0" readme.md` is empty.
- Add the `## [v5.25.0] 2026-08-07` changelog entry covering the trigger cleanup, the asset gate, and the RCA capture, and record that v5.24.0 was the first release to ship assets.
- Log `.lovable/release/issues/01-5-25-0-git-tag-skipped.md`, since this environment cannot create git tags.

### 6. Verification gates before handing back
`check-workflow-yaml`, `check-markdown-filenames`, `check-readme-compliance`, `test:cicd-spec`, `pnpm run test:quiet`, and a final `rg "5\.24\.0"` that matches only `changelog.md` and `.lovable/`.

## Publishing

Tags cannot be created from here. After this lands on `main`, run **Actions > Tag and Release** with version `5.25.0`.