# Task-04: Release Runbook, v6.102.0

Release target: v6.102.0 (minor bump from 6.101.15).
Owner of execution: the lead. This runbook is read-only guidance; Worker 02 never runs git, tag, bump, or release commands.
Ground truth: `.ai-memory/plans/subtasks/cicd-asset-inclusion-and-release-fix/02-release-readiness-report.json` (pin sites, 18/18 asset to step map, 6-gate checklist, 9-step draft runbook).
Pipeline fixes (Worker 01, Task-03) this runbook depends on:
- Fix A: draft-first release page in `.github/workflows/release.yml`. The page is created as a DRAFT and is published (undrafted) only after the asset gate passes.
- Fix B: `scripts/check-release-assets.mjs` widened to gate all 18 assets, so an incomplete asset set keeps the page a draft and fails the run.

## 1. Pre-flight gates (all must pass, in this order)

Run from the repo root (`~/workspace/repos/macro-ahk`).

### Gate a: Worker 01 fix committed, pushed, and CI Build green

Exact verify:
- `gh run list --repo alimtvnetwork/macro-ahk-v55 --workflow build.yml --limit 5`
- Confirm the run for the fix commit on main is `completed` with conclusion `success`.
- Rule: the tag is cut only from a commit whose own CI Build run is green (v6.100.0 lesson).

### Gate b: markdown filename policy passes

Exact verify:
```
node scripts/check-markdown-filenames.mjs
```
- Expected: exit code 0. This passed on 2026-10-15; re-verify at tag time.

### Gate c: release prompt mirrors are byte-identical

Exact verify:
```
cmp .ai-memory/prompts/14-release.md standalone-scripts/prompts/22-release/prompt.md
```
- Expected: no output (cmp prints nothing when identical). Re-verify at tag time.

### Gate d: no release or tag workflow run in flight

Exact verify:
```
gh run list --repo alimtvnetwork/macro-ahk-v55 --workflow release.yml --limit 5
```
- Expected: no run with status `in_progress` or `queued` for release.yml or tag-and-release.yml. Wait for any in-flight run to finish before cutting the tag; never cut a tag while a release run is active.

### Gate e: all pin sites at 6.102.0

Exact verify:
```
node -e "console.log(require('./package.json').version)"
node -e "console.log(require('./version.json').version)"
node -e "console.log(require('./manifest.json').version)"
```
- Expected: each prints `6.102.0`.
- readme.md one-liner pins (lines 37, 43, 53, 71, 78, 83, 110, 115, 125, 130, 144, 145, 150, 188, 192) show `v6.102.0`.
- Do not touch readme.md line 67 (historical release note header) or example lines 253, 254, 262, 263, 265, 349, 362.
- src/shared/version.ts and standalone-scripts/shared-version.ts need no change (they import version.json).

### Gate f: secrets check clean

Exact verify:
- Review the staged diff before commit; confirm no `.env` files, credentials, plaintext secrets, or minisign private keys are included.
- `git status` should show only the intended bump and pin files.

## 2. Release sequence (lead executes)

### Step 1: land the Worker 01 pipeline fix first

The fix commit for `.github/workflows/release.yml` and `scripts/check-release-assets.mjs` must land and go green BEFORE the bump.
Lead command:
```
gitmap cpb "marco - restore release asset pipeline"
```
Then wait for the CI Build run on that commit to be fully green (see Gate a). Only then proceed to the bump.

### Step 2: re-verify gates b and c now

```
node scripts/check-markdown-filenames.mjs
cmp .ai-memory/prompts/14-release.md standalone-scripts/prompts/22-release/prompt.md
```
Both must pass at this moment, right before the bump.

### Step 3: bump

```
npm run version:minor
```
This writes `version.json` with `version: 6.102.0` and `releaseDate: 2026-10-15` (UTC). The git tag is the single source of truth at build time; `scripts/write-version-from-tag.mjs` regenerates `version.json` from the tag inside every release job.

### Step 4: manual pin-site edits

Edit these files so the version reads 6.102.0:
- `package.json`: version field to `6.102.0` (no automated sync exists; manual edit).
- Root `manifest.json`: version field to `6.102.0` (the release job also self-heals this via `scripts/sync-manifest-version.mjs` during `pnpm run build:extension`, but set it now so the tree is truthful).
- `readme.md`: replace `v6.100.0` with `v6.102.0` on the 15 pinned one-liner lines only (37, 43, 53, 71, 78, 83, 110, 115, 125, 130, 144, 145, 150, 188, 192). Do NOT touch line 67 (historical release note) or example lines 253, 254, 262, 263, 265, 349, 362.
- `changelog.md` is NOT edited on bump (per the 08-minor-bump prompt); release notes are generated from commit history by the `Generate release notes` step.

### Step 5: commit via gitmap

Stage the changed files and push to main through the gitmap flow (the bump/pin changes may ride in the same commit as the fix work or a second atomic commit, per lead judgment). The mandatory ordering is: fix commit green first, then bump.

### Step 6: wait for CI Build green on the bump commit

Watch with ETA-based waits, no rapid polling:
```
gitmap pipeline-ai status --json
```
Re-check on a measured cadence (every 5 to 10 minutes) until the Build run on the bump commit is fully green. Never tag from a red or yellow commit.

### Step 7: cut and push the tag

```
git tag v6.102.0 && git push origin v6.102.0
```
The tag triggers release.yml. Expected flow after the Worker 01 fixes:
1. The release page is created as a DRAFT (draft-first; users do not see it).
2. Setup, build-sdk, build-xpath, build-macro-controller, and build-prompts jobs run.
3. The release job packages the assets, uploads them, forces rich notes, and runs the asset gate (`node scripts/check-release-assets.mjs`, now covering all 18 assets).
4. Only if the gate passes is the page published (undrafted).

### Step 8: watch the release run with ETA-based waits

```
gitmap pipeline-ai status --json
```
Re-check every 5 to 10 minutes until the Release run completes. Do not poll rapidly.

### Step 9: verify the release page, draft-first aware

```
gh release view v6.102.0 --repo alimtvnetwork/macro-ahk-v55 --json assets,draft
```
- While the workflow is still running, expect `draft: true` with zero or partial assets. That is correct behavior under Fix A: the page stays a draft until the asset gate passes.
- Final expected state: `draft: false` and all 18 assets present:
  `marco-extension-v6.102.0.zip`, `prompts-v6.102.0.zip`, `macro-controller-v6.102.0.zip`, `marco-sdk-v6.102.0.zip`, `xpath-v6.102.0.zip`, `payment-banner-hider-v6.102.0.zip`, `lovable-common-v6.102.0.zip`, `lovable-dashboard-v6.102.0.zip`, `lovable-owner-switch-v6.102.0.zip`, `lovable-user-add-v6.102.0.zip`, `install.ps1`, `install.sh`, `clone-repo.ps1`, `download-extension.ps1`, `checksums.txt`, `changelog.md`, `RELEASE_NOTES.md`, `VERSION.txt`.
- Optional 19th asset: `checksums.txt.minisig` appears only when the `MINISIGN_SECRET_KEY` repo secret is configured; it is outside the 18-asset contract and outside the gate.

## 3. Compensation: fix forward, never move the tag

- If the Release workflow fails or the release job is skipped: the page MUST remain a draft. Fix A keeps it unpublished, so a failed release is invisible to users.
- Fix the underlying issue on main (new commit, green CI Build), then cut a new patch tag, for example `v6.102.1`. The recovery tag carries the fix; it cannot reuse a stale tag because the workflow binds to the tag that triggered it.
- NEVER rewrite, move, delete, or force-push the `v6.102.0` tag. The Lovable-connected branch rules and the no-history-rewrite convention apply.

## 4. Rollback and abort criteria

Stop the release (do not cut or push the tag) when any of these hold:
- Gate a, b, c, d, e, or f is red at tag time. Re-verify gates b and c immediately before Step 7; a drift since Step 2 aborts the tag.
- A release.yml or tag-and-release.yml run is in flight (Gate d red): wait for it to finish, then re-run all gates.
- The fix commit for Worker 01's changes is not yet green, or the fix is not yet on main: the bump must not proceed without the draft-first behavior in place.
- CI Build on the bump commit (Step 5) is not green: never tag from a red or yellow commit.
- After the tag is pushed: if the Release run fails, do NOT delete or move the tag; go to Compensation (fix forward with a patch tag). A failed release page left as a draft is the safe terminal state.

## 5. Notes for the lead

- `npm run version:minor` writes `version.json`; `package.json` has no automated sync and needs the manual edit.
- The zero-storage rule holds: release assets travel via `gh release upload` (exempt from the `actions/upload-artifact` ban), and diagnostics go to `$GITHUB_STEP_SUMMARY` or console output.
- Positive-boolean conventions, lowercase filenames, and relative paths apply to any new file created during this release.
- If any tool or command fails twice, reply `STATUS: BLOCKED` with the exact error and stop; the lead takes over.
