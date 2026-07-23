# Ambiguity handling (canonical, applies to every prompt)

Ambiguity is not a license to guess. It is a file to write. Every prompt in this set (plan, plan-v2, next-task, read-memory, write-memory, any-pending-tasks, proofread, app-spec audit, recent-work audit, improve-spec, improve-work, release) MUST use this exact folder structure and file shape. No invented folders, no alternate paths, no shortcuts.

## Folder structure

```
.lovable/
  ambiguous-questions/
    01-new-ambiguity/          # open questions live here
      XX-<slug>.md
    02-ambiguity-resolved/     # answered questions move here
      XX-<slug>.md
```

Rules:
- `XX` is a two-digit zero-padded sequence (`01`, `02`, ...), monotonic across BOTH subfolders combined. Next number = highest existing `XX` in either folder + 1.
- `<slug>` is lowercase kebab-case, short, derived from the question.
- Filename never changes when moving between folders. Only the folder changes.
- Never duplicate a file. `mv`, do not `cp`.

## Open question file shape (write verbatim, fill each field)

Path: `.lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md`

```
# <one-line question>
Slug: <slug>
Status: open
Raised: <YYYY-MM-DD>
Blocking: <what this blocks, e.g. plan slug(s), audit run id, step number, or "none">

## Question
## Options considered
## Impact if guessed wrong
```

## Resolution flow (when the user answers)

1. `mv .lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md .lovable/ambiguous-questions/02-ambiguity-resolved/XX-<slug>.md`
2. Flip the header: `Status: resolved`.
3. Append a `## Resolution` block at the bottom:

```
## Resolution
Answered: <YYYY-MM-DD>
Answer: <user answer>
Applied solution: <what changed / where>
```

4. Never leave a copy in `01-new-ambiguity/`.

## Blocked runs

If the current turn is blocked by an open ambiguity, still emit the primary artifact for that prompt (plan file, audit report, task list, etc.), set `Status: blocked-by-ambiguity` in the artifact's context / notes, and link the question file path(s). Do not silently skip. Do not guess.

## Per-prompt `Blocking:` values (use verbatim)

- plan / plan-v2: `Blocking: <plan slug(s) or "none">`
- next-task: `Blocking: next-task (step <i>)`
- app-spec audit: `Blocking: app-spec audit (source folder <path>)`
- recent-work audit: `Blocking: recent-work audit <NN>-<work-slug>`
- improve-spec from audit: `Blocking: improve-spec from audit (step <i>)`
- improve-work from audit: `Blocking: improve-work from audit <work-slug> (step <i>)`
- release: `Blocking: release <version>`
- read-memory / write-memory / any-pending-tasks / proofread: `Blocking: <prompt name>`

## Hard bans

- No `ambiguities/`, `questions/`, `open-questions/`, `blockers/`, or any other folder name.
- No nested per-topic subfolders inside `01-new-ambiguity/` or `02-ambiguity-resolved/`.
- No renaming files on resolution.
- No copying instead of moving.
- No leaving a resolved file in `01-new-ambiguity/`.
- No guessing when an input is unclear. File the question, then proceed with what is unblocked.
