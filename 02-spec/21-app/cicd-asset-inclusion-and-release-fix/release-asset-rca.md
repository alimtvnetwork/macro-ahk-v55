# Release Asset RCA: Why Releases Shipped With Zero Assets, and How to Never Repeat It

## slug
Cicd-Asset-Inclusion-And-Release-Fix

## What went wrong (plain language)

Twenty releases in a row — v6.100.0 through v6.101.18 — published GitHub Release
pages with **zero assets**. The pages looked fine: version number, release
notes, install instructions pointing at download links. But every download link
was dead, because no files were ever attached. The pipeline reported each
failure loudly in the workflow run, yet the release page itself showed no sign
of trouble.

## The two root causes

**Root cause 1 — a content change, not a pipeline change (v6.100.0).**
Commit `fa5e8ff1` ("docs(prompts): update 14-release.md with latest prompt
body") overwrote the test mirror `.lovable/prompts/14-release.md` with
Antigravity system-injected prompt text instead of the canonical release
prompt. The test `src/__tests__/default-prompt-content.test.ts` enforces
byte-for-byte equality between that mirror and
`standalone-scripts/prompts/22-release/prompt.md`. The equality check failed,
the `Run tests` step failed, the `Setup · Lint · Test` job failed, and the
`needs:` chain skipped every asset-producing job. Meanwhile Job 0
(`create-release-page`) has zero dependencies and publishes the page with
`draft: false` before any build runs. The only guard that counts assets —
`node scripts/check-release-assets.mjs` — runs as the last step of the
`release` job, which never executed. Result: a live, non-draft page with
0 assets.

**Root cause 2 — a filename gate nobody saw coming (v6.101.x).**
The `Enforce markdown filename policy` step
(`node scripts/check-markdown-filenames.mjs`) rejects
`02-spec/06-seedable-config-architecture/02-features/10-config-seed-1.3.0-bump.md`.
The violation is the dots in `1.3.0` (the checker allows only
`^[a-z0-9][a-z0-9-]*$` or `^[A-Z0-9][A-Z0-9_-]*$`), not uppercase letters.
Same structural outcome as root cause 1: setup fails → `needs:` skips →
early non-draft page → silent 0-asset publish.

**The systemic enabler.** The workflow files were innocent: `release.yml` is
byte-identical between the healthy v6.99.0 and the broken v6.100.0. The
pipeline was *designed* to publish the page before building ("the page must
exist even when downstream jobs fail"), and the asset gate was *designed* to
run at the end of the release job. Together, those two design choices mean a
setup-stage failure always produces a silent live 0-asset page. The gate also
asserted only 9 of the 18 assets.

Full evidence: `.ai-memory/cicd/09-release-asset-rca.md`.

## What changed in this fix (v6.102.0)

1. **Draft-first release page** (`.github/workflows/release.yml`): the early
   page is created with `draft: true`, assets upload to the draft, the gate
   runs, and a new final step `Publish release page (undraft)` runs
   `gh release edit "$TAG" --draft=false` only after the gate passes. A
   failed or skipped release job now leaves an invisible draft, never a live
   0-asset page.
2. **Full asset gate** (`scripts/check-release-assets.mjs`): `REQUIRED_ASSETS`
   widened from 9 to 18, grounded on the real v6.99.0 asset sizes. A release
   missing any of the 18 now fails the run and stays a draft.

## The mistake pattern — recognize it anywhere

> A **setup-stage gate failure** + a **`needs:`-skip cascade** + an **early,
> dependency-free publish step** = silent broken artifact, with the loud
> failure visible only in the workflow run, never on the artifact itself.

The pattern is not specific to releases. Any pipeline where an early step
publishes something and a later step is the only validator has this hole:
if the validator is skipped, the published thing is wrong and nobody is told.

## Prevention checklist (run before every release tag)

1. `node scripts/check-markdown-filenames.mjs` — exit 0.
2. `cmp .ai-memory/prompts/14-release.md standalone-scripts/prompts/22-release/prompt.md` — byte-identical.
3. `gh run list --repo alimtvnetwork/macro-ahk-v55 --workflow ci.yml --limit 3` — CI Build green on the commit you will tag. **Never tag from a red or yellow commit.**
4. No release/tag workflow run in flight.
5. All pin sites at the target version (`version.json`, `package.json`,
   root `manifest.json`, `readme.md` one-liner pins — never the historical
   line or doc examples).
6. After the Release workflow finishes: `gh release view vX.Y.Z --json assets,draft`
   shows `draft: false` and all 18 assets. While it is still running,
   `draft: true` with zero or partial assets is correct behavior.

## CI gate recommendation (for the repo's standing rules)

- The byte-equality prompt-mirror test must never be deleted, commented out,
  or bypassed to force a release (AGENTS.md section 2, auto-reject). Fix the
  mirror, never the test.
- Do not add a step that undrafts the release outside the `release` job, and
  do not move the undraft step before the asset gate — either change
  re-opens the hole.
- If the release page is ever seen live with fewer than 18 assets, treat it
  as a pipeline defect, not a content problem: the gate list or the
  draft-first ordering has regressed.

## Lesson for the human (the one-line version)

The pipeline didn't break between v6.99.0 and v6.100.0 — a docs commit broke
a test, and the pipeline's *structure* (publish early, validate late) turned a
loud test failure into a silent empty release. The fix is structural too:
never publish before validating.
