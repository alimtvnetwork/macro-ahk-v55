# RCA 09: v6.100.0 and v6.101.x releases published with zero assets

Status: root cause identified, evidence verified via read-only `gh api` checks.
Owner: Worker 01, task cicd-asset-inclusion-and-release-fix, subtask 1.

## Summary

Two consecutive release lines shipped GitHub Release pages with zero assets
while the pipeline reported the failure loudly in the run and silently on the
release page. v6.100.0 broke because a docs commit contaminated a prompt-mirror
file that a byte-equality test guards, so the setup job failed and the
`needs:` chain skipped every asset-producing job. The v6.101.x line inherited
the prompt-mirror breakage and then picked up a second, earlier gate: the
`Enforce markdown filename policy` step rejects a spec filename that carries
dots in its version number. In both cases the `create-release-page` job (Job 0,
zero dependencies, `draft: false`) had already published a non-draft page, and
the `check-release-assets.mjs` gate lives at the end of the `release` job,
which never ran. Result: a live, non-draft release page with 0 assets.

## Timeline

- v6.99.0, healthy. Release carries 18 assets, `draft: false`.
  Asset list: changelog.md, checksums.txt, clone-repo.ps1,
  download-extension.ps1, install.ps1, install.sh,
  lovable-common-v6.99.0.zip, lovable-dashboard-v6.99.0.zip,
  lovable-owner-switch-v6.99.0.zip, lovable-user-add-v6.99.0.zip,
  macro-controller-v6.99.0.zip, marco-extension-v6.99.0.zip,
  marco-sdk-v6.99.0.zip, payment-banner-hider-v6.99.0.zip,
  prompts-v6.99.0.zip, RELEASE_NOTES.md, VERSION.txt, xpath-v6.99.0.zip.
- Commit fa5e8ff1, `docs(prompts): update 14-release.md with latest prompt
  body`. It touches exactly one file: `.lovable/prompts/14-release.md`.
  The new body is the Antigravity system-injected prompt text, not the
  canonical release prompt.
- v6.100.0 tag includes fa5e8ff1. Release Build run 32584065570
  (2026-08-22): the `Setup · Lint · Test` job fails at the `Run tests` step;
  `Create Release Page (early)` succeeds; the five build jobs
  (Build · Marco SDK, Build · XPath, Build · Prompts,
  Build · Macro Controller, Build · Extension · Release) are all SKIPPED.
  Published release: 0 assets, `draft: false`.
- v6.101.0, Release Build run 34925064351 (2026-09-15): fails later, at
  `Build Chrome extension` inside `Build · Extension · Release`. 0 assets.
- v6.101.1 through v6.101.17: every run fails in `Setup · Lint · Test`.
  Spot-checked v6.101.1 (run 36137235473, 2026-09-25): the `Run tests` step
  fails with the same prompt-mirror family, 5 failed test files of 516,
  including `src/__tests__/default-prompt-content.test.ts` (the 22-release
  byte-equality assertion) and `src/__tests__/prompt-mirrors.test.ts`
  (`ENOENT: .lovable/prompt-mirrors.json` missing).
- v6.101.18, Release Build run 38009920105 (2026-10-10, head 8a92224a):
  `Enforce markdown filename policy` fails at setup step 8, before `Run tests`
  (step 12, skipped). Violating file:
  `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md`.
  Published release: 0 assets, `draft: false`.
- v6.100.0 plus v6.101.0 through v6.101.18: all 20 releases publish with
  0 assets and `draft: false`.

## Mechanism

The failure path is structural, not incidental:

1. Failing setup gate. For v6.100.0 the gate is the vitest suite; for the
   latest v6.101.x it is the markdown filename policy. Either way, the
   `setup` job (`Setup · Lint · Test`) fails.
2. `needs:`-chain skip. Every asset-producing job declares a dependency on
   `setup` (release.yml lines 316, 362, 414, 477, 523): the build jobs use
   `needs: setup` or `needs: [setup, build-sdk]`, and the `release` job uses
   `needs: [setup, build-sdk, build-xpath, build-macro-controller,
   build-prompts]`. A failed `setup` job skips all of them, so no asset is
   ever built or uploaded.
3. Early non-draft page. Job 0, `create-release-page` (`Create Release Page
   (early)`), has zero dependencies and publishes with `draft: false`
   (release.yml line 170). The workflow header comment states the intent
   explicitly: the page must exist even when downstream jobs fail.
4. Silent 0-asset publish. The only guard that inspects the finished release,
   `node scripts/check-release-assets.mjs` (release.yml line 978), runs as the
   last step of the `release` job. When `setup` fails, the `release` job never
   runs, the gate never runs, and the already-published non-draft page stays
   up with zero assets. Nothing else in the pipeline counts the assets.

### The exact failing test (v6.100.0)

`src/__tests__/default-prompt-content.test.ts`, test case
`release prompt (22-release) enforces MINOR-bump ceremony v7 contract`:

- Canonical file: `standalone-scripts/prompts/22-release/prompt.md`
- Mirror file at v6.100.0: `.lovable/prompts/14-release.md`
  (later moved to `.ai-memory/prompts/14-release.md`)
- Final assertion: byte-for-byte equality after CRLF normalization,
  `expect(prompt.replace(/\r\n/g, "\n")).toBe(mirror.replace(/\r\n/g, "\n"))`

Commit fa5e8ff1 overwrote the mirror with the Antigravity-injected prompt
body, so the equality assertion fails and the whole `Run tests` step fails.

### The exact failing filename (v6.101.x)

`02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md`

`scripts/check-markdown-filenames.mjs` allows only two shapes:
lowercase hyphen-case (`^[a-z0-9][a-z0-9-]*$`) or ALL-CAPS
(`^[A-Z0-9][A-Z0-9_-]*$`). The dots in `1.3.0` match neither pattern, so the
step prints `Markdown filename policy failed:` followed by
`##[error]use lowercase hyphen-case or ALL-CAPS markdown filenames` and exits
1. Note: the problem is the dots, not uppercase letters; the file has no
uppercase letters at all. The rename that satisfies the policy is
`10-config-seed-1-3-0-bump.md` (dots become hyphens). That rename is already
present in the current working tree, and
`node scripts/check-markdown-filenames.mjs` passes there now.

Caveat: at head 8a92224a the filename gate fails at setup step 8 while
`Run tests` (step 12) is skipped, so the gate masks whatever the test suite
would report next. Fixing the filename unblocks the test step; the mirror
files moved to `.ai-memory/prompts/14-release.md` at that commit, so the
byte-equality test must be re-verified after the rename fix.

## Why the workflow files were innocent

`.github/workflows/release.yml` is byte-identical between v6.99.0 (healthy)
and v6.100.0 (broken). The Git blob SHA for the file is
`1a9fd35fc218b2b5e8ba6301d4794e8ba1ca048c` at both tags. No pipeline change
caused the v6.100.0 failure; the readme entry
`v6.100.0 Release Trigger Cleanup and Published-Asset Gate` is a release-note
entry, not the cause. The failure came from a content change in a file the
tests guard (`.lovable/prompts/14-release.md`), combined with the pipeline
structure described above.

## The asset gate covers only half the assets

`scripts/check-release-assets.mjs` asserts exactly 9 required assets:

- marco-extension-${TAG}.zip, prompts-${TAG}.zip,
  macro-controller-${TAG}.zip, marco-sdk-${TAG}.zip, xpath-${TAG}.zip,
  install.ps1, install.sh, checksums.txt, VERSION.txt

A healthy release carries 18 assets (see the v6.99.0 list above). The gate
ignores the other 9: changelog.md, clone-repo.ps1, download-extension.ps1,
the four lovable-*.zip bundles, payment-banner-hider, and RELEASE_NOTES.md.
A release missing only those 9 would still pass the gate. Widening the list
is a follow-up for the release-fix workstream.

## Prior art

The header comment of `check-release-assets.mjs` records that releases v5.9.0
through v5.22.0 published pages with zero assets while the workflow reported
nothing, because a YAML startup failure meant no job ever ran. The workflow
comment at release.yml line ~976 references
`.lovable/memory/rca/06-release-published-without-assets.md`. This RCA is the
second instance of the same shape: the gate was added to catch an empty
release, but it only runs when the pipeline reaches the end of the `release`
job, so any setup-stage failure still publishes an empty page silently.

## Verification log (read-only `gh api` evidence)

- `GET /repos/{owner}/{repo}/releases/tags/v6.99.0`: 18 assets, draft false.
- `GET /repos/{owner}/{repo}/releases/tags/v6.100.0`: 0 assets, draft false.
- `GET /repos/{owner}/{repo}/releases` (latest 12): v6.101.7 through v6.101.18,
  every release 0 assets, draft false.
- `GET /repos/{owner}/{repo}/commits/fa5e8ff1`: message
  `docs(prompts): update 14-release.md with latest prompt body`, files list
  contains exactly `.lovable/prompts/14-release.md`.
- `GET .../contents/.github/workflows/release.yml?ref=v6.99.0` and
  `?ref=v6.100.0`: identical blob SHA
  `1a9fd35fc218b2b5e8ba6301d4794e8ba1ca048c`.
- `GET .../contents/src/__tests__/default-prompt-content.test.ts?ref=v6.100.0`:
  mirror read from `.lovable/prompts/14-release.md`, final assertion
  byte-equality with `standalone-scripts/prompts/22-release/prompt.md`.
- Run 32584065570 (v6.100.0) jobs: `Setup · Lint · Test` failure at
  `Run tests`; `Create Release Page (early)` success; all five build jobs
  skipped.
- Run 34925064351 (v6.101.0) jobs: failure at `Build Chrome extension`.
- Run 36137235473 (v6.101.1) setup-job log: `Run tests` fails with
  `default-prompt-content.test.ts` 22-release assertion and missing
  `.lovable/prompt-mirrors.json`.
- Run 38009920105 (v6.101.18) jobs: `Enforce markdown filename policy`
  failure at setup step 8; `Run tests` (step 12) skipped.
- Setup-job log for run 38009920105: `Markdown filename policy failed:`
  plus `##[error]use lowercase hyphen-case or ALL-CAPS markdown filenames`.
- Recursive tree at 8a92224a filtered against the checker rule: exactly one
  violation,
  `02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md`.
- Local run of `node scripts/check-markdown-filenames.mjs` on the current
  working tree: `Markdown filename policy OK` (file already renamed to
  `10-config-seed-1-3-0-bump.md`).

## Recommended fixes (for the release-fix workstream, not this doc)

1. Keep the early page but make it a draft until the gate passes, or move the
   `check-release-assets.mjs` gate into a job that runs whenever the page
   exists (for example a job that depends only on `create-release-page` and
   fails the run when the published release has zero assets).
2. Widen `REQUIRED_ASSETS` in `scripts/check-release-assets.mjs` to all 18
   assets.
3. After the filename rename, re-run the full test suite at the v6.101.x head
   to confirm the byte-equality test passes with the mirror now at
   `.ai-memory/prompts/14-release.md`.
