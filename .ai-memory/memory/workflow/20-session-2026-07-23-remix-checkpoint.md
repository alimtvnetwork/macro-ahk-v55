---
name: Session 2026-07-23 remix checkpoint
description: Fresh remix of project, no code changes this session; write-memory invoked to snapshot state
type: preference
---

## Session summary (2026-07-23)

- User remixed the project into a new Lovable workspace and asked "what's a good next step".
- Agent recommended running `bun install`, `bunx vitest run`, `bun run build` to verify the remix builds and tests pass, then reading `.lovable/plans/pending/` for the top open item.
- No code, no installs, no migrations executed.
- User then invoked the `write memory` prompt (v3.0, maximum enforcement).

## State snapshot (unchanged from prior session)

- `.lovable/plans/pending/` open: 11, 13, 22, 23, 24, 25, 29, 30, 31, 33-plan-10.
- `.lovable/issues/open/` open: 01..13 (see folder).
- Core rules, restricted identifiers, no-Supabase, dark-only, no readme.txt writes, No-Questions Mode, version.json single-source, loop cap 250: all still in force per `mem://index.md` Core.
- `next` command convention, `plan`/`next` button-body convention, dropdown prompts registry: unchanged.

## What next session should do first

1. Read `mem://index.md` Core.
2. Read `.lovable/plans/index.md` and the top pending plan file.
3. Read `.lovable/spec/commands/` (every active file).
4. Then act on the user's next instruction.

No new rules, no new constraints, no new plans introduced this turn.