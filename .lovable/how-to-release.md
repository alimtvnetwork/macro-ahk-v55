# How To Release

> Canonical, must-follow checklist for every release of this repo.
> Every time the user says `release`, `bump version`, `major bump`, `major release`, or any typo variant, follow this file end to end without asking for confirmation and without opening plan mode.

Authoritative sources this file consolidates (read them if anything here is ambiguous):

- `.lovable/memory/workflow/release-ceremony.md` (canonical flow, prompt maintenance rule, never-do list)
- `.lovable/memory/workflow/19-release-runbook-and-failure-modes.md` (failure modes, do-not-re-add checkers)
- `.lovable/prompts/14-release.md` (release trigger prompt body)
- `.lovable/release/issues/` (log of failed or skipped release steps)
- Root `version.json`

## Defaults

- Default bump is MINOR unless the user explicitly says MAJOR or PATCH.
- MINOR: `X.Y.Z` becomes `X.(Y+1).0`; patch always resets to `0`.
- MAJOR: `X.Y.Z` becomes `(X+1).0.0`.
- PATCH: `X.Y.Z` becomes `X.Y.(Z+1)`.
- Never ask "minor or patch?". Never ask for approval. Never open plan mode.
- The only human-edited release version file is root `version.json`.

## Pre-release checklist (REQUIRED before every release)

Run this checklist first, in the same turn as the release, before touching `version.json`. If any item fails, fix it before bumping. Do not skip, do not defer, do not ask for approval.

1. Working tree sanity: confirm no unrelated in-progress edits are staged for this release turn.
2. Typecheck clean: run the project typecheck (`tsc --noEmit` across all tsconfigs) and confirm 0 errors.
3. Lint clean: run ESLint and confirm 0 errors (warnings allowed only if already in baseline).
4. Tests green: run `pnpm run test:quiet` (or the project equivalent) and confirm all suites pass.
5. Strict-flag fallout: run `check-strict-flag-fallout` and confirm exit 0 (within baseline).
6. Canonical logger imports: run `scripts/check-canonical-logger-imports.mjs` and confirm 0 violations.
7. Unresolved-import guard: confirm `import/no-unresolved` passes (no TS2307-class breakage).
8. Prompt bundle parity: confirm bundled prompt artifacts are regenerated only if prompt source changed this session.
9. Filename hygiene: confirm no uppercase markdown filenames were introduced this session.
10. Version automation audit: confirm the extension build path reads `version.json` for manifest generation and that no manual downstream propagation is required.
11. Release scope audit: confirm the release turn updates only `version.json` unless the user explicitly requested publishing or extra documentation changes.

Only after all 11 items pass, proceed to Required steps below.

## Required steps (in order, single turn)

1. Run the Pre-release checklist above and confirm all 11 items pass. Then read the current version from `version.json` and state previous and new version before editing.
2. Update `version.json` only: set `version` to the new version and `releaseDate` to today's UTC date.
3. Do not edit `manifest.json`, `readme.md`, `changelog.md`, constants, instruction files, fallback copies, or generated bundles only to propagate the version.
4. If publishing is explicitly requested, create the matching `v<version>` tag after the `version.json` change is present on the target branch.
5. If any required step is skipped or fails, create a numbered file under `.lovable/release/issues/`.
6. Do not publish, deploy, ship, or go live unless the user explicitly says so.

## Prompt maintenance rule

If the release prompt text is supplied or corrected in the same turn, update both `standalone-scripts/prompts/22-release/prompt.md` and `.lovable/prompts/14-release.md` byte-identically, then regenerate bundled prompts.

## Never

- Never do a version-only release when the user asked for the full ceremony.
- Never manually propagate a release version into `manifest.json`.
- Never edit `readme.md` or `changelog.md` only because the version changed.
- Never leave uppercase markdown filenames.
- Never hide a skipped commit or tag step; log it under `.lovable/release/issues/`.
- Never auto-publish.
- Never use em dashes in changelog entries, release issue files, or user-facing output.
- Never re-add release checkers that were removed (see `19-release-runbook-and-failure-modes.md`).
- Never skip the Pre-release checklist. A release without all 11 checklist items passing is invalid and must be logged under `.lovable/release/issues/`.

## Reporting back

After the release, report in chat:

- Previous and new version.
- Bump tier (MAJOR / MINOR / PATCH).
- Files updated. For a normal release this should be `version.json` only.
- Any issue file created under `.lovable/release/issues/`.
