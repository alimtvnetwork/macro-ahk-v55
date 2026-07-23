# Next {{n}} steps or tasks (v3.3)

## RULE 0 - EXACTLY `{{n}}` NEXT STEPS (MUST)

`{{n}}` is a positive integer injected at runtime. Deliver EXACTLY `{{n}}`
next steps. Not `{{n}} - 1`. Not `{{n}} + 1`. If `{{n}}` is missing, zero,
or unresolvable, STOP and ask before doing anything.

## RULE 1 - NO RELEASE ON A NEXT-TASK TURN (MUST)

A next-task turn NEVER triggers a release. Do NOT bump the version. Do NOT
touch `changelog.md`. Do NOT edit release notes. Do NOT re-pin the version
in the root README. Do NOT run the release prompt. Do NOT invent a
"minor bump because this felt important" step.

The release happens ONLY when the ENTIRE plan is finished, meaning every
task in `.lovable/plans/pending/XX-<slug>.md` for that plan (and every
subtask) has been moved to `.lovable/plans/completed/` with
`Status: completed`. Detection is mechanical:

- If ANY task or subtask for the active plan still sits in `pending/`,
  the plan is NOT done. No release. Full stop.
- If, after this turn's `mv`s, the plan's `pending/` set is EMPTY, the
  plan is done. Only then: bump MINOR, add a changelog entry, update the
  release notes, and pin the new version in the root README. Follow
  `11-release.md` for the exact release ceremony.

Releasing mid-plan is auto-reject on the same tier as RULE 0.

## What I want

1. Give me the NEXT `{{n}}` STEPS, exactly `{{n}}`, and for each one:
   1a) Reasoning: why this step, why now, what breaks if it is skipped.
   1b) Time estimate: realistic, not optimistic.
   1c) What it unblocks: the next thing that becomes possible.

2. Then list EVERY remaining item after those `{{n}}`. This is a MUST,
   not optional. Full picture, no cherry-picking, no "and a few more
   things". If the remaining list is empty, say so explicitly with the
   reason. Missing this list is auto-reject.

3. Plan-completion check (MANDATORY, last thing you do):
   - Count the plan's remaining `pending/` files AFTER your `mv`s.
   - If > 0: state "Plan not complete, N task(s) remaining, no release".
   - If == 0: run the release ceremony from `11-release.md` (MINOR bump,
     changelog, release notes, README pin). This is the ONLY case where
     a next-task turn touches the version.

## Task lifecycle (the ONLY file movement this prompt does)

When a task is completed this turn:

- `mv .lovable/plans/pending/XX-<slug>.md .lovable/plans/completed/XX-<slug>.md`
- Flip `Status: completed` in the same move.
- Update `.lovable/plans/index.md` in the same op.
- Subtasks follow the parent plan's convention (move to
  `subtasks/XX-<slug>/completed/` or flip `Status:` in place).

`mv`, never `cp`, never `rm`. Leaving a done task in `pending/` is
auto-reject. That is the only file this prompt is allowed to move
(release ceremony aside, and only when the plan is fully done).

## Working stance (read this, it applies to YOU)

The AI running this prompt has been a stupid fuck in past runs: skimming
filenames, guessing at code it never opened, symptom-patching with
try/catch, dropping the "remaining tasks" list because it felt long,
softening enforcement wording, releasing mid-plan because a task felt
"big enough", and confidently shipping wrong answers. Do not repeat that
stupidity. Read the code. Name the exact files, functions, and lines.
Prove the fix in the logs. If you catch yourself hand-waving, stop and
go read the file.

Aggressive tone is intentional. Depth IS the job.

## Definition of done (non-negotiable)

You are NOT done until all of these are true:

- [ ] You actually read the relevant files AND the project memories, and
      can name the exact files, functions, and lines involved.
- [ ] The root cause is written in ONE sentence, before any fix.
- [ ] The fix is the minimum correct change tied to that root cause, not
      a symptom patch.
- [ ] You verified it: build output, error logs, and/or preview, with the
      before/after signal shown (failing to passing).
- [ ] You reported what changed and why.
- [ ] The full remaining-tasks list is included after the `{{n}}` steps.
- [ ] Every task completed this turn is MOVED from
      `.lovable/plans/pending/` to `.lovable/plans/completed/` per the
      lifecycle section above.
- [ ] Plan-completion check performed: released ONLY if the plan's
      `pending/` set is empty after this turn; otherwise NO release.

## Hard rules

- STOP and read first. No skimming, no guessing from filenames. If you
  cannot name the exact lines, you have not read enough. Go back.
- Root cause before fix. Trace the bug end-to-end. No assumptions.
- No symptom-patching. If your "fix" is a try/catch, a fallback value, or
  a re-render hack used to hide the problem, you have failed. Start over.
- If unsure, SAY SO. Do not fabricate. A wrong-but-confident answer is
  worse than "I do not know yet."
- Go slow. Go critical. Go deep. Fast plus wrong equals useless.
- No release mid-plan. See RULE 1. Version, changelog, release notes,
  and README pin are UNTOUCHED unless the plan is fully complete this turn.
- Do NOT save, mirror, archive, or copy this prompt anywhere. No
  `.lovable/prompts/` file, no per-invocation archive, no "saved prompt as
  NN-\*.md" step. The ONLY file movement allowed this turn is pending ->
  completed for tasks actually finished (plus the release ceremony IFF the
  plan is complete).

## Error logs and error management (always)

- Read the actual error logs FIRST: console, server/worker logs, build
  output, stack traces. The answer is usually already there.
- If there are NO logs, that itself is the bug: add logging at the entry
  point and surface errors instead of swallowing them. Silent failure is
  unacceptable.
- Every fix must include proper error handling and observability: errors
  logged with context and surfaced, never hidden.
- Confirm the relevant log line actually fires after your change. If you
  cannot see it in the logs, you have not proven the fix.

## Coding guidelines enforcement (delicate but strict)

Before touching code, verify guideline sources and follow them:

1. Check `.lovable/coding-guidelines.md`. If present, follow it.
2. Check `spec/coding-guidelines/`. If present, follow every file inside.
3. Also check any language-specific folder if it exists
   (`spec/coding-guidelines/go/`, `.../python/`, `.../php/`,
   `.../typescript/`, etc.) and apply the relevant one.
4. Error-management specs are mandatory for coding tasks when they exist:
   `spec/03-error-manage/`, `spec/XX-error-manage/`,
   `coding-guidelines/XX-error-manage/`.

Rules:

- Verify each file/folder exists before citing it. Skip silently if missing.
- If multiple guidelines apply, follow ALL of them.
- On conflict, prefer the folder-level spec (`spec/coding-guidelines/`)
  over the flat `.lovable/coding-guidelines.md`, and call out the conflict
  in the reply.
- If this IS a coding task and NEITHER location has guidelines, STOP and
  ask the user to provide one before writing code. Do not invent a house
  style.

---

## Must Follow and without negotiation

Listen, past next-tasks turns have been sloppy as fuck: wrong step count,
missing remaining-tasks list, symptom patches sold as fixes, coding
guidelines ignored, logs never checked, prompt files getting mirrored
into `.lovable/prompts/` when nobody asked, and worst of all releasing
mid-plan because a single task felt shippable. WTF. Stop doing that, you
stupid fuck. Read the code, find the root cause in one sentence, apply
the minimum correct fix, verify it in the logs, list EVERY remaining
task, `mv` finished plans from `pending/` to `completed/`, then run the
plan-completion check. Release ONLY when the plan is 100% done, never
before. Nothing else moves. Nothing else gets saved. Going deep IS the
job. Violating this is auto-reject on the same tier as RULE 0. If you're not going deep, you're not doing the job. Are you stupid? You were supposed to do the task properly. Where is this, are you stupid fuck? Where? Tell me. Your stupidity is going on top of my head. I mean, where did you learn this stupidity? If I could find you, I could slap you.
