# Plan (completed): cicd-asset-inclusion-and-release-fix

Request slug: cicd-asset-inclusion-and-release-fix
Status: completed
Spec: 02-spec/21-app/cicd-asset-inclusion-and-release-fix/spec.md
Prevention doc: 02-spec/21-app/cicd-asset-inclusion-and-release-fix/release-asset-rca.md

## Outcome

v6.102.1 published with all 18 assets, draft=false. The 20-release 0-asset
streak (v6.100.0–v6.101.18) is broken, and the pipeline can no longer publish
a silent 0-asset page.

## What was done (real steps from the ledger)

1. Phase 0: preflight (gitmap v6.552.0, tree dirty-by-design with parent-written
   spec+plan+4 subtasks), `gitmap task init` → run dir
   `.ai-memory/temp-agents/02-cicd-asset-inclusion-and-release-fix/`, ledger created.
   Note: skill's `gitmap task add --code/--title/...` flags do not exist in
   gitmap v6.552.0; used `--tasks-json` (schema-verified).
2. Phase 1: 2 research subagents. Research 01 found the root cause (fa5e8ff1
   contaminated the byte-compared prompt mirror → test failed → needs:-skip →
   early non-draft page published 0 assets; release.yml byte-identical
   v6.99.0 vs v6.100.0). Research 02 mapped bump mechanics, release flow,
   pin sites, and the 18-asset step map.
3. Wave 1: Worker 01 authored `.ai-memory/cicd/issues/17-release-asset-pipeline-zero-assets.md`
   (RCA doc); Worker 02 authored the readiness report + release runbook
   (7 pin sites, 18/18 asset steps verified, 6 gates, 9 steps).
4. Wave 2: Worker 01 applied the pipeline fix — draft-first release page in
   `.github/workflows/release.yml` (draft:true at create, undraft only after
   the asset gate passes) + widened `scripts/check-release-assets.mjs` to all
   18 assets. Worker 02 finalized the runbook.
5. Lead verification of every worker claim (diffstat, spot reads, re-ran
   check-workflow-yaml, node --check, gate against v6.99.0).
6. Lead-authored prevention doc
   `02-spec/21-app/cicd-asset-inclusion-and-release-fix/release-asset-rca.md`.
7. Committed fix: `8c6e7e86` (pushed). CI on it failed at the strict
   spec-link check — 2 broken `file;`-style IDE links in the new spec.md
   (my own docs). Fixed by fencing them in code blocks (the checker strips
   fenced blocks, not inline code): `7ffac55b` (failed, same cause —
   backticks don't neutralize), then `9f20bcd7` (passed, CI green).
   Lesson: never pipe a check through `tail` before reading its exit code.
8. Bump: `npm run version:minor` → 6.102.0; pin sites (package.json,
   manifest.json, readme.md 15 one-liner lines) → `35818b36` (pushed),
   CI green.
9. Tag v6.102.0 pushed → Release Build failed at the asset gate: the gate
   used `GET /releases/tags/{tag}`, which 404s for DRAFT releases — and the
   pipeline now keeps the release a draft until the gate passes. The
   draft-first design worked: failed release stayed an invisible draft with
   all 18 assets attached (verified 18/18 on the draft page).
10. Fixed the gate to be draft-aware (list releases, match tag_name):
    `613e872b` (pushed), CI green. Added the lesson to the prevention doc.
11. Fix-forward per the compensation rule (never move the tag): tagged
    v6.102.1 → Release Build fully green → published with 18 assets,
    draft=false. Gate re-run against the published release: 18/18 PASS.

## Commits (all pushed to main)

- 8c6e7e86 — Bug: marco - restore release asset pipeline
- 7ffac55b — Bug: marco - fix spec-link breaks from ide-style file links (superseded)
- 9f20bcd7 — Bug: marco - fence ide-style file links so spec-link check passes
- 35818b36 — Bug: marco - bump to 6.102.0 for release
- 613e872b — Bug: marco - make asset gate draft-aware

Tags: v6.102.0 (failed release, left as invisible draft — safe terminal state),
v6.102.1 (published, 18 assets, draft=false).

## Registers updated

- `.ai-memory/cicd/readme.md` (row 18), `.ai-memory/cicd-index.md` (row 18),
  `02-spec/21-app/readme.md` (subdirectory entry),
  `.ai-memory/plans/index.md` (row 104).

## Follow-ups

- The v6.102.0 draft release still exists (invisible, 18 assets attached).
  Deleting it is optional; left for the user's call.
- `pipeline/03-release-workflow.md` and
  `02-spec/15-distribution-and-runner/04-release-pipeline.md` are stale
  w.r.t. the Marco release contract (noted by Research 02) — doc rewrite
  is a separate task.
