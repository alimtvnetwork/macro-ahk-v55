---
Slug: prompts-authoring-and-release-memory
Steps: 5
Status: completed
Created: 2026-07-23
---

# Plan 01: Prompts authoring, release, and {{n}} pipeline memory

Comprehension-only plan. Deliverable: one memory file capturing how prompts are authored, mirrored, released, and how `{{n}}` flows for the Plan and Next chip buttons + dropdown. No code changes.

## Steps

1. Read canonical Plan/Next bodies + info.json (`standalone-scripts/prompts/13-next-tasks/`, `14-plan-steps/`) and the five substitution sites (`utils/token-substitute.ts`, `ui/next-inline-ui.ts`, `ui/task-next-ui.ts`, `ui/plan-task-ui.ts`, `seed/plan-next-prompts.ts`).
2. Read `.lovable/prompt-mirrors.json`, `scripts/aggregate-prompts.mjs`, `scripts/check-prompt-mirrors.mjs`, release memories.
3. Write `.lovable/memory/features/prompts-authoring-and-release.md` covering: folder layout, info.json contract, add-a-prompt flow, release flow, `{{n}}` pipeline + guards (rule-zero-validator, prompt-health-check), regression tests, do-nots.
4. Add index row under `## Memories` in `.lovable/memory/index.md`.
5. Record this plan under `.lovable/plans/live-lovable/` and register it in `.lovable/plans/index.md`.

## Out of scope

- No refactor of the five substitution sites.
- No new prompt, no version bump, no changelog entry.
- No edits to Plan/Next default bodies.

## References

- `mem://features/prompts-authoring-and-release` (created by this plan)
- `mem://prompts/dropdown-prompts-registry`
- `spec/01-prompt-spec-2026/04-dropdown-prompts-registry.md`
- `mem://constraints/version-json-single-source-of-truth`
- `mem://workflow/19-release-runbook-and-failure-modes`