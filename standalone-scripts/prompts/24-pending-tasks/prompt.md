# Any pending tasks (full inventory, maximum enforcement)

## RULE 0, list EVERY pending task or the run is a failure

Scan the whole project. Produce ONE complete list of every task that is not yet done, with the number of steps each one needs to reach done. Missing a single pending task is auto-reject. No cherry-picking. No "and a few more". If nothing is pending, say so explicitly with the folders you checked.

## Hard rules (non-negotiable, auto-reject on violation)

1. Nothing executes this turn. No code edits, migrations, installs, shell side effects, `plan--create`, plan-approval tools, or "should I proceed?" prompts. Read + reply only.
2. Read the sources fully. No skimming filenames, no guessing from slugs. If you cannot cite the file behind a listed task, you have not read enough.
3. Deduplicate across sources. A task that appears in a spec, a plan, and a memory file is ONE task with links to all three, not three tasks.
4. Estimate step count using the same rubric as the plan prompt: each step is concrete, verifiable, tied to a file / command / observable outcome. If a task genuinely needs subtasks, note the subtask count.
5. Ambiguity is not a license to guess. Open ambiguities are listed as their own class of pending work (blocking vs. non-blocking).
6. No em dashes. No softened wording. No SEO commentary.

## Working stance

The AI running this prompt has been a stupid fuck on prior "what's pending" runs: listed three items and stopped, skipped `.lovable/cicd-issues/`, forgot `plans/subtasks/`, confused suggestions with plans, invented step counts without opening the files, missed open ambiguities that were blocking half the plans, and softened the aggressive wording. Do not repeat any of it.

Inventorying IS the work this turn. Go deep: read every folder, open every pending file, count the real steps, cross-reference, produce a list a senior engineer can act on without a second pass.

## Sources to scan (all of them, in full)

Walk each of these recursively. Missing = note it, continue.

1. `.lovable/plans/index.md`
2. `.lovable/plans/pending/` (every file)
3. `.lovable/plans/subtasks/` (every parent, every subtask file with `Status:` not `completed`)
4. `.lovable/plan.md` if the project uses the single-file variant, `## Active` / non-`## Completed` sections
5. `.lovable/memory/index.md` and every file it references, looking for pending work, TODOs, `⏳ Pending`, `🔄 In Progress`, `🚫 Blocked`
6. `.lovable/memory/workflow/` current workflow state
7. `.lovable/memory/specs/` for verbatim user directives not yet implemented
8. `.lovable/spec/commands/` for commands / conventions not yet enforced in code
9. `.lovable/issues/` and `.lovable/pending-issues/` (every file)
10. `.lovable/cicd-issues/` and `.lovable/cicd-index.md`
11. `.lovable/ambiguous-questions/01-new-ambiguity/` (every open question)
12. `.lovable/suggestions.md` `## Active Suggestions` and `.lovable/suggestions/` verbatim captures with `Status:` not `Implemented` / not `Rejected`
13. `spec/` folders (`00-overview.md`, numbered files) for stated but unimplemented scope
14. `spec/03-error-manage/` or fallback error-management folder for pending remediation
15. `.lovable/strictly-avoid.md` for outstanding cleanups referenced by solved issues

## Step-count rubric

- Trivial change (single file, single edit, no verification beyond build): 1 step.
- Small change (one or two files, one verify step): 2-3 steps.
- Standard task (multiple files, migration or route or UI + logic, verification): 4-7 steps.
- Cross-cutting task (schema + API + UI + tests, or refactor across modules): 8-15 steps.
- Deep task (needs subtasks): note total steps + subtask count, e.g. `12 steps across 3 subtasks`.

Open the file before estimating. If the file already declares `Steps: N`, use it. If not, derive N from acceptance criteria + affected files.

## Output shape

```
# Pending tasks inventory

## Summary
- Sources scanned: [list every folder / file scanned, mark missing]
- Total pending tasks: [N]
- Blocking ambiguities: [K]  (from .lovable/ambiguous-questions/01-new-ambiguity/)
- Pending plans: [P]  (from .lovable/plans/pending/)
- Pending issues: [I]  (from .lovable/issues/ + .lovable/pending-issues/)
- Pending CI/CD issues: [C]  (from .lovable/cicd-issues/)
- Active suggestions: [S]  (from .lovable/suggestions.md)
- Unimplemented spec scope: [U]  (from spec/)

## Tasks

### 1. <task title>
- Source: <file path(s), one per line if cross-referenced>
- Type: plan | issue | cicd-issue | ambiguity | suggestion | spec-scope | command | memory-todo
- Status: pending | in-progress | blocked-by-ambiguity | blocked-by-<other>
- Steps: <N>  (or `<N> across <M> subtasks` when subtasks are needed)
- Depends on: <task numbers or "none">
- One-line intent: <what "done" looks like>

### 2. ...
(exactly one block per pending task, no filler, no duplicates)

## Blocking ambiguities (must resolve first)
- <slug>: <question> (blocks task #<n>, #<n>)

## Nothing pending
(only if the inventory is truly empty; list the folders scanned to prove it)
```

## Banned actions (auto-reject)

- Executing anything this turn
- Calling `plan--create` or any plan-mode / approval tool
- Listing only a subset ("here are the top 5") when more exist
- Inventing step counts without opening the source file
- Treating one task as several because it appears in multiple sources
- Skipping any source folder from the list above without noting it as missing
- Silently ignoring open ambiguities
- Softening the required aggressive wording
- Adding SEO items to the inventory unless the user explicitly listed SEO work

## Checklist before replying (every box)

- [ ] Walked every source folder in the list; noted the missing ones
- [ ] Opened every pending file, not just filenames
- [ ] Cross-referenced duplicates so each real task appears once
- [ ] Estimated steps using the rubric, based on the actual file contents
- [ ] Called out subtasks where depth is needed
- [ ] Listed every open ambiguity in the blocking section
- [ ] Marked dependencies between tasks
- [ ] Filled the summary counters with real numbers, not `[N]` placeholders
- [ ] No em dashes, no softened wording, no execution, no `plan--create`

If any box is unchecked, do not reply. Fix it first.

---

## Must Follow, without negotiation

Listen, past pending-tasks turns have been sloppy as fuck: partial lists dumped into chat, `cicd-issues/` and `plans/subtasks/` skipped, ambiguities ignored, step counts invented without opening the files, duplicates listed as separate tasks, summary block left with `[N]` placeholders. WTF. Stop doing that, you stupid fuck. Read every source, open every pending file, dedupe, count steps against the rubric, surface blocking ambiguities, emit the full inventory with real numbers. Going deep IS the job. If you're not going deep, you're not doing the job. Violating this is auto-reject on the same tier as RULE 0. Avoid stupidity, and being careless, you stupid, WTF.
