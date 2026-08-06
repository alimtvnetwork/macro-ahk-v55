# What To Read

> Canonical map of what the AI must read before working on this project.

> Last updated: 2026-08-06T09:30:00Z

## Changelog

- 2026-08-06T09:30:00Z, Updated Release prompt to v1.2 with strict Ceremony and MINOR bump enforcement.
- 2026-08-06T09:40:00Z, Implemented Write-Memory v3.0 (Maximum Enforcement) and unified .lovable folder structure.
- 2026-07-27T05:45:00Z, SUPERSEDED: Git tag is now the single source of truth for the release version.
- 2026-07-21T09:15:00Z, Captured chip-gear Re-seed defaults flow.

## Before any task (always)

- `.lovable/memory/index.md`, why: core rules, topic index, and recent workflow state.
- `.lovable/coding-guidelines.md`, why: 15 rules, function size caps, and naming conventions.
- `.lovable/rules.md`, why: consolidated hard prohibitions (banned identifiers, no Supabase, no em dashes).
- `.lovable/plans/index.md`, why: prioritized roadmap and active task status.
- `.lovable/strictly-avoid.md`, why: legacy prohibitions pointer (re-synced to rules.md).
- `.lovable/ambiguous-questions/01-new-ambiguity/`, why: open questions that must be resolved.
- `.lovable/what-to-read.md`, why: this file (read-list synchronization).
- `readme.md`, why: project overview and monorepo structure.

## Before writing code

- `.lovable/coding-guidelines.md`
- `.lovable/rules.md`
- `spec/02-coding-guidelines/`

## Before adding a feature

- `spec/21-app/` or `spec/26-macro-controller/`
- `.lovable/plan.md`

## Before writing a spec

- `spec/01-spec-authoring-guide/`
- `spec/00-overview.md`

## Before adding a unit test

- `vitest.config.ts`
- `src/**/__tests__/`

## See also

- Root `readme.md` (must stay in sync with this file)
