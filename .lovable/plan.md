## New non-negotiable rule

Git tag `vX.Y.Z` is the ONLY source of truth for release version. `version.json` must not carry the release version. Everything that needs the version at build/runtime reads the tag (via `GITHUB_REF_NAME` in CI, `git describe --tags` at build time, or the `VERSION` env the workflow injects).

This overrides `.lovable/spec/commands/05-version-json-single-source-of-truth.md` and every memory that pointed at `version.json` as the version pin. The command file gets rewritten to reflect the new rule; nothing gets to keep the old contract.

## Fix

### A. Rip version.json out of the release-version role

1. `version.json`: remove the `version` field entirely. Keep only non-version metadata (`timezonePolicy`) or delete the file if nothing else needs it. Do not "align" it to 5.12.1: that reintroduces the drift class.
2. `.github/workflows/release.yml → setup`:
   - Delete the "Read version from version.json" step. Replace it with a "Resolve version from tag" step that sets `VERSION="${TARGET_TAG#v}"` and exports `version`/`publish_tag` outputs from the tag alone.
   - Keep the tag-format regex validation (`^v[0-9]+\.[0-9]+\.[0-9]+([.-].+)?$`).
   - Wire `node scripts/sync-repo-slug.mjs` right after "Checkout resolved ref" (still missing; delivers on the v5.12.0 memory promise).
3. Every build script that currently reads `version.json` for the version reads `$VERSION` (env, set by the workflow from the tag) instead. Concrete callers to convert:
   - `scripts/sync-manifest-version.mjs`, `scripts/bump-version.mjs`, `scripts/cached-build.mjs`, `scripts/check-built-manifest-csp.mjs`
   - `vite.config.extension.ts` and every `tsconfig.*.json` that references `version.json` as an input
   - `standalone-scripts/shared-version.ts`, `src/shared/version.ts`, `src/platform/preview-adapter.ts`
   - `src/background/default-project-seeder.ts`
   - Fallback for local dev (no tag present): `git describe --tags --abbrev=0` -> strip leading `v`. If neither env nor git tag is available, fall back to a static `0.0.0-dev` so IDE/type-check runs don't break. Never read `version.json` for version.
4. `scripts/bump-version.mjs`: retire it or repurpose it to create the tag directly (`git tag vX.Y.Z`). No more `version.json` writes.

### B. Prevent the empty-page failure class regardless

5. Do NOT rely on `version.json` alignment. Since the version now comes from the tag, `setup` cannot mismatch by construction. Delete the `PUBLISH_TAG != TARGET_TAG` check entirely (there is only one source now).
6. Keep / add the `sync-repo-slug` step in `setup` for the repo-rename failure class.
7. Confirm the existing `on-failure` step in `release.yml` edits the release body with failing job URLs; complete it if partial.

### C. Recover v5.12.1's empty page

8. Re-trigger `release.yml` via `workflow_dispatch` with `version=v5.12.1`. With version now derived from the tag, `setup` passes, `build-*` and `release` run, and `softprops/action-gh-release` overwrites the placeholder body and uploads the ZIPs / installers / checksums / notes to the existing tag page.
9. No new tag, no v5.12.2 bump.

### D. Documentation + memory (rewritten to match the new rule)

10. Rewrite `.lovable/spec/commands/05-version-json-single-source-of-truth.md` -> new title `05-tag-is-single-source-of-truth-for-version.md` (or in-place rewrite with a redirect note). Rules become: "Git tag is the only version pin. version.json must not carry the release version. Bumping = creating the tag. CI derives everything from the tag."
11. Update these memories/docs the same way, in one pass:
    - `.lovable/memory/features/release-pipeline-repo-url-agnostic.md` -> update the "Known failure modes" section: primary cause of v5.12.1 empty page was version.json vs tag drift; fixed by removing version.json from the release-version role, not by self-healing it.
    - `.lovable/memory/workflow/release-ceremony.md`, `.lovable/memory/workflow/19-release-runbook-and-failure-modes.md`, `.lovable/how-to-release.md` -> rewrite the flow: "bump = create tag `vX.Y.Z`; the tag triggers `release.yml` which reads the version from itself."
    - `pipeline/06-versioning.md`, `pipeline/03-release-workflow.md`, `pipeline/04-validation-scripts.md` -> same.
    - `.lovable/prompts/08-bump-version.md`, `standalone-scripts/prompts/08-minor-bump/prompt.md`, `09-major-bump`, `10-patch-bump`, `22-release/prompt.md` -> rewrite: bumping is `git tag vX.Y.(Z+1) && git push origin vX.Y.(Z+1)`. No file edits.
    - `.lovable/cicd/issues/03-release-page-empty-v5-12-1-version-json-drift.md` -> rewrite so the "Fix" section describes tag-as-source-of-truth, not version.json alignment.
    - Root `readme.md` "Repo rename & release pipeline" note -> replace the version-drift self-heal paragraph with a "Version comes from the tag" paragraph.
12. Update `.lovable/what-to-read.md` to point at the rewritten spec command.
13. Sweep every remaining reference to "edit version.json" / "version.json is the source of truth" and rewrite it. Files list above from a live rg. Anything under `spec/99-archive/` and `.gitmap/` is left alone (historical).

### E. Verification before I say done

14. Re-view `release.yml`: no `version.json` read; `sync-repo-slug` runs first; version derived from `TARGET_TAG`.
15. `node scripts/sync-repo-slug.mjs` -> exit 0.
16. `node scripts/check-installer-contract.mjs` -> exit 0.
17. Local dev build with no tag / no env: builds against `0.0.0-dev` and doesn't crash any `version.json` reader (because those readers are gone).
18. Grep confirms no remaining `require('./version.json').version` / `readFileSync('version.json')` / `import version from '../../version.json'` in shipping code paths.

## Not doing

- No new tag, no v5.12.2. Recovery is a re-run of `release.yml` on the existing `v5.12.1` tag.
- No new watcher / auditor / readiness workflow (blocked by `mem://constraints/release-assets-publish-contract`).
- No changelog rewrite beyond the developer-note update in root readme.
- No touching `spec/99-archive/**` or `.gitmap/**`.

## Confirm before I execute (one question, then plan is final)

Is deleting the `version` field from `version.json` acceptable, or do you want the file kept (just no longer read for the release version)? Either works; the tag stays authoritative either way. I'll default to deleting the field if you don't answer.
