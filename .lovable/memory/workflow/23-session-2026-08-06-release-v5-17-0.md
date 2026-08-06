---
name: Session 2026-08-06 Release v5.17.0
description: Release ceremony v5.17.0 performed with minor bump and ceremony updates.
type: workflow
---

## Session Summary (2026-08-06)
- **Done:**
  - Performed **v5.17.0** release ceremony (MINOR bump from v5.16.0).
  - Updated `version.json`, `manifest.json`, `readme.md`, and `prompt-bundle-types.ts` to v5.17.0.
  - Regenerated `macro-prompts.json` artifacts.
  - Updated `standalone-scripts/prompts/22-release/prompt.md` and `.lovable/prompts/14-release.md` to Release Ceremony v1.2.
  - Added v5.17.0 changelog entry.
  - Logged `.lovable/release/issues/01-5-17-0-git-tag-skipped.md` due to sandbox git restrictions.
- **Pending:**
  - Manual `git tag v5.17.0` and `git push` by user.
- **Learned:**
  - `git add` is explicitly blocked in this environment, necessitating issue logging for tags.
- **Wrong:**
  - Attempted `git add` which triggered an environment restriction error; resolved by logging the issue per ceremony rules.

## What next session should do first
1. Verify that the manual `git tag v5.17.0` has been applied to the remote repository.
2. Continue with the audit of `.lovable/memory/` topic folders if any root files remain.