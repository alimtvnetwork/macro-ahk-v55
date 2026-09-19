# Consolidate .lovable/ folder for lower-token AI comprehension

Slug: lovable-folder-consolidation
Steps: 30
Status: Completed
Created: 2026-07-17

## Context

`.lovable/` has grown to ~30 top-level entries (audits, checklists, cicd-*, docs, issues, memory, pasted-prompts, pending-issues, plans, prompts, reports, solved-issues, spec, suggestions, templates, verification, plus loose plan-26, loop-leak-plan, spec-reorganization-plan, prompt-mirrors.json, strictly-avoid.md, what-to-read.md, overview.md). Redundant/legacy structure inflates token cost every time the AI reads the tree. Goal: consolidate into a small, predictable, token-efficient layout while preserving history and links. No behavior change to code; docs/memory only.

Prior pending plans carried forward (not superseded by this plan, remain in `.lovable/plans/pending/`):
- 10-unified-billing-all-workspaces.md
- 11-prompts-import-export-section.md
- 13-per-project-chat-submit-tracker.md

Related captured inputs:
- `.lovable/spec/commands/` (existing three command files remain authoritative)
- `.lovable/issues/` (existing three issue files remain authoritative)

## Steps

1. Inventory `.lovable/` recursively: file count, byte size, and last-modified per top-level entry. Write result to `.lovable/audits/2026-07-17-lovable-inventory.md`.
2. Classify each top-level entry as KEEP / MERGE / ARCHIVE / DELETE-CANDIDATE with rationale. Append to the same inventory file.
3. Define the target layout (single source of truth). See ./subtasks/18-lovable-folder-consolidation/01-target-layout.md.
4. Draft `.lovable/README.md` as the single entry index the AI reads first (replaces `overview.md` + `what-to-read.md` + `prompt.md` + `prompts.md` top-level hints).
5. Merge `overview.md`, `what-to-read.md`, `prompt.md`, `prompts.md` content into `.lovable/README.md`; move originals to `.lovable/archive/2026-07-17/`.
6. Consolidate `strictly-avoid.md` + relevant constraints from `memory/` into a single `.lovable/rules.md` (short, bulleted, deduped).
7. Fold loose top-level plans (`plan-26-chrome-extension-generic.md`, `loop-leak-plan.md`, `spec-reorganization-plan-2026-04-22.md`) into `.lovable/plans/completed/` with proper XX prefix if closed, else `pending/`.
8. Merge `pending-issues/` into `issues/` (open only) and `solved-issues/` into `issues/closed/`. Delete now-empty folders.
9. Merge `cicd-index.md` + `cicd-profile.md` + `cicd-issues/` into `.lovable/cicd/` with `README.md`, `profile.md`, `issues/`.
10. Consolidate `pasted-prompts/` into `prompts/pasted/`; keep only canonical mirrors per user memory (no per-invocation archives).
11. Merge `suggestions.md` into `memory/suggestions/` index; delete top-level file after link update.
12. Deduplicate `checklists/` against `spec/` (spec wins); move unique checklists into `spec/checklists/`.
13. Reorganize `reports/` and `verification/` under `audits/` with dated subfolders; keep `audits/` as the single audit root.
14. Collapse `docs/` into `spec/docs/` if content is spec-adjacent; else keep at root with a short README.
15. Move `templates/` under `spec/templates/`. Update any references.
16. Compact `memory/` index: split into `memory/core.md` (always-in-context rules) and `memory/refs/` (topic files). Prune duplicates already in `mem://index.md`.
17. Introduce `.lovable/MAP.md`: a 40-line max, machine-friendly map (path → 1-line purpose) that the AI can read instead of `ls`-ing everything.
18. Add `.lovable/plans/README.md` describing lifecycle (pending → completed) and XX numbering (matches existing convention).
19. Add `.lovable/issues/README.md` describing open/closed layout + status frontmatter.
20. Add `.lovable/spec/commands/README.md` describing command capture rules (mirrors prior command files).
21. Normalize frontmatter across all plans/issues/commands (`Slug`, `Status`, `Created`, `Parent` where applicable). See ./subtasks/18-lovable-folder-consolidation/02-frontmatter-normalize.md.
22. Add `scripts/check-lovable-layout.mjs` CI script: fails if unknown top-level entries appear or required indexes are missing.
23. Wire `check-lovable-layout` into the existing preflight chain (non-strict warn first, strict later).
24. Update `mem://index.md` Core to point at `.lovable/README.md` and `.lovable/MAP.md`; remove references to deleted paths.
25. Update `readme.md` (root) links that point into `.lovable/` old paths.
26. Grep the repo for stale `.lovable/<oldpath>` references (code, docs, tests). Fix or record in `audits/2026-07-17-stale-refs.md`.
27. Create `.lovable/archive/2026-07-17/` and move DELETE-CANDIDATE files there instead of deleting, preserving history one turn.
28. Verify token footprint: `find .lovable -type f -name '*.md' | xargs wc -c` before/after; record delta in inventory audit. Target: >=30% reduction in aggregate bytes of top-level+README-tier files.
29. Version bump (patch) + changelog entry "Consolidated .lovable/ layout; no runtime change." Pin new version in root readme.
30. Move this plan file to `.lovable/plans/completed/18-lovable-folder-consolidation.md` and flip `Status: completed`.

## Verification

- `.lovable/README.md` + `.lovable/MAP.md` exist and are <200 lines combined.
- No files remain at `.lovable/` root except: `README.md`, `MAP.md`, `rules.md`, and the canonical folders (`plans/`, `issues/`, `spec/`, `memory/`, `audits/`, `cicd/`, `prompts/`, `archive/`).
- `scripts/check-lovable-layout.mjs` exits 0.
- Aggregate byte count of `.lovable/**/*.md` drops >=30% (recorded in inventory audit).
- All prior pending plans (10, 11, 13) still present in `plans/pending/`.
- `git grep` for old paths returns 0 uncaught references (or all logged in stale-refs audit).
- Version bump present in `manifest.json`, `src/shared/constants.ts`, changelog, and root readme.

## Appended from prior pending tasks

- 10-unified-billing-all-workspaces (untouched, remains pending)
- 11-prompts-import-export-section (untouched, remains pending)
- 13-per-project-chat-submit-tracker (untouched, remains pending)
