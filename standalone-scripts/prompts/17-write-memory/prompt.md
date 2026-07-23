# Write Memory (end of session, maximum enforcement)

## RULE 0, capture everything or the session is lost

The next AI session has full amnesia. If you did it and did not write it, it did not happen. If it is pending and you did not record it, it is dead. Write for a stranger with zero context. Never truncate history, never overwrite blindly, never leave orphans.

## Hard rules (non-negotiable, auto-reject on violation)

1. No files at the `.lovable/memory/` root. Every memory file lives under a topic folder: `.lovable/memory/<topic>/XX-<slug>.md`.

2. Path is `.lovable/memory/`, never `.lovable/memories/`. Path is `.lovable/plans/`, never `plan/`. Path is `.lovable/ambiguous-questions/`, never `ambiguity/`.

3. Read before write. Every index, plan, suggestions, strictly-avoid, and what-to-read file is READ in full before it is touched. Unrelated entries stay intact.

4. Never delete history. Completed items move to a `## Completed` section or to `plans/completed/`. Solved issues move to `solved-issues/`. Nothing is erased.

5. Same-operation index update. Creating or moving a file ALWAYS updates the matching index in the same turn (`memory/index.md`, `plans/index.md`, `cicd-index.md`, `prompts/index.md`, `suggestions/index.md`).

6. Filenames are lowercase-hyphenated with a 2-digit numeric prefix: `01-auth-flow.md`. `XX` is the next free sequence within its folder.

7. Plans and suggestions single-file trackers stay single files: `.lovable/plan.md` (or `.lovable/plans/index.md` for the roll-up), `.lovable/suggestions.md`. Per-suggestion verbatim captures live under `.lovable/suggestions/XX-<slug>.md`.

8. Ambiguity moves, never copies. Answered file goes from `01-new-ambiguity/` to `02-ambiguity-resolved/` with a `## Resolution` block appended and `Status: resolved` flipped in the same move.

9. Root `README.md` and `.lovable/what-to-read.md` stay in sync. Same file list, same order, no drift. Every write-memory run updates both.

10. Nothing executes this turn beyond file writes and `mv`. No code changes, no installs, no migrations.

## Working stance

The AI running this prompt has been a stupid fuck on prior runs: dumped session summaries into chat and called it "memory", left `.lovable/memory/` half-empty, created `.lovable/memories/` by accident, forgot to update `plans/index.md` and `what-to-read.md`, silently overwrote `strictly-avoid.md`, dropped user directives that were stated verbatim in the session, paraphrased specs instead of quoting them, invented a `mem://` root file, and left orphans everywhere. Do not repeat any of that stupidity.

Writing memory IS the work this turn. Go deep: audit the session, reconcile every folder, capture verbatim what the user said, write the files, update every index, verify consistency. Aggressive enforcement is intentional. Do not soften it.

## Pre-flight, read before you write

Walk `.lovable/` recursively. Read all of these if they exist; note missing and create them per the templates in this prompt:

1. `.lovable/memory/index.md`, master memory index

2. `.lovable/coding-guidelines.md`, coding rules (see §Coding guidelines)

3. `.lovable/plans/index.md` and every file under `plans/pending/` and `plans/subtasks/`; skim `plans/completed/`

4. `.lovable/plan.md` if the project uses the single-file variant

5. `.lovable/suggestions.md` and `.lovable/suggestions/index.md`

6. `.lovable/strictly-avoid.md`

7. `.lovable/cicd-index.md` and every file under `.lovable/cicd-issues/`

8. `.lovable/issues/`, `.lovable/pending-issues/`, `.lovable/solved-issues/`

9. `.lovable/spec/commands/` (every file)

10. `.lovable/ambiguous-questions/01-new-ambiguity/` and `02-ambiguity-resolved/` (every file)

11. `.lovable/prompts/index.md`

12. `.lovable/what-to-read.md`

13. `.lovable/memory/workflow/` current workflow state

14. `spec/` (relevant folders), including any `spec/03-error-manage/` or fallback error-management folder

## Phase 1, audit the session (internal)

Answer for yourself, do not dump to chat unless asked. Cover:

- Done: features, fixes, refactors, files created / modified / deleted, decisions made and why.

- Pending: started but unfinished, discussed but not started, blockers, dependencies.

- Learned: patterns, conventions, gotchas, user preferences (explicit or implicit).

- Wrong: bugs and root causes, failed approaches, things to never repeat.

## Phase 2, update memory files

Target: `.lovable/memory/<topic>/XX-<slug>.md`. Never at the memory root.

1. Read `.lovable/memory/index.md` first. No duplicates.

2. Update existing files: add to the right section, mark items `[x]` or `✅ Done`, keep unrelated entries intact.

3. Create new files under the right topic folder. Immediately add them to `memory/index.md` in the same operation.

4. Update workflow state under `.lovable/memory/workflow/` using markers:

| Status       | Marker                 |

| ------------ | ---------------------- |

| Done         | `✅ Done`              |

| In Progress  | `🔄 In Progress`       |

| Pending      | `⏳ Pending`           |

| Blocked      | `🚫 Blocked, [reason]` |

| Avoid / Skip | `🚫 Avoid, [reason]`   |

Anything the user said to skip or avoid: `.lovable/memory/avoid/XX-<slug>.md`, then reference from `.lovable/strictly-avoid.md`.

## Phase 3, plans and suggestions

### Plans

Preferred layout (matches the read-memory and plan-v2 prompts):

- Roll-up: `.lovable/plans/index.md` (one line per plan: slug, title, status, created, link)

- Active: `.lovable/plans/pending/XX-<slug>.md`

- History: `.lovable/plans/completed/XX-<slug>.md`

- Depth: `.lovable/plans/subtasks/XX-<slug>/SS-<subslug>.md`

Lifecycle: complete = `mv` from `pending/` to `completed/`, flip `Status: completed` in the same move, update `plans/index.md`. Never copy. Never delete.

Legacy single-file `.lovable/plan.md` is kept if the project already uses it: statuses updated, new tasks appended, completed items moved to `## Completed` at the bottom.

### Suggestions

Single tracker: `.lovable/suggestions.md`

```markdown

## Active Suggestions

### [Title]

- Status: Pending | In Review | Approved | Rejected

- Priority: High | Medium | Low

- Description: what and why

- Added: [session ref]

## Implemented Suggestions

### [Title]

- Implemented: [session ref]

- Notes: details / commit / file

```

Verbatim per-suggestion captures: `.lovable/suggestions/XX-<slug>.md` with an index at `.lovable/suggestions/index.md`. Do not duplicate content, the per-file version is the verbatim capture, `suggestions.md` is the tracker.

## Phase 4, issues

- Pending: `.lovable/pending-issues/XX-<slug>.md` (or `.lovable/issues/XX-<slug>.md` if the project uses that name).

- Solved: `.lovable/solved-issues/XX-<slug>.md`. On resolution `mv` the file and append `## Solution`, `## Iteration Count`, `## Learning`, `## What NOT to Repeat`.

- Strictly-avoid entries in `.lovable/strictly-avoid.md` reference the solved file: `- [Pattern]: [why forbidden]. See: .lovable/solved-issues/XX-<slug>.md`.

- CI/CD issues: `.lovable/cicd-issues/XX-<slug>.md`, indexed in `.lovable/cicd-index.md`. Scan the index before adding a new one, no duplicates.

## Phase 5, verbatim spec capture

Every sizeable user directive, decision, or spec from the session is saved verbatim under `.lovable/memory/specs/XX-<slug>.md`, referenced from `memory/index.md`, and reflected in `plan.md` / `plans/index.md` if it changes the roadmap. Never paraphrase. Quote the user.

New user command / convention: `.lovable/spec/commands/XX-<slug>.md`.

## Phase 6, `.lovable/what-to-read.md` (authoritative read-list)

Must exist after this run. Create it if missing, update it (never blindly overwrite) if present.

Required content:

- Dated changelog entry at the top, UTC ISO 8601 (`YYYY-MM-DDThh:mm:ssZ`). Prepend a new entry every update. Never overwrite the previous timestamp.

- Full list of files/folders the AI must read before any task, in sync with the Pre-flight list above.

- One-line "why it matters" next to each entry.

- Subsections for: before any task (always), before writing code, before adding a feature, before writing a spec, before adding a unit test.

- Pointer to the root `README.md` with a sync note.

Template:

```markdown

# What to Read

> Canonical map of what the AI must read before working on this project.

> Last updated: <UTC ISO 8601>

## Changelog

- <UTC ISO 8601>, <one-line summary>

## Before any task (always)

- `.lovable/memory/index.md`, why: ...

- `.lovable/coding-guidelines.md`, why: ...

- `.lovable/plans/index.md`, why: ...

- `.lovable/strictly-avoid.md`, why: ...

- `.lovable/ambiguous-questions/01-new-ambiguity/`, why: ...

(sync with Pre-flight)

## Before writing code

- ...

## Before adding a feature

- ...

## Before writing a spec

- ...

## Before adding a unit test

- ...

## See also

- Root `README.md` (must stay in sync with this file)

```

Root `README.md` is updated in the same operation, describes the folder structure, and names `.lovable/what-to-read.md` as the authoritative read-list pointer.

## Phase 7, consistency validation

After all writes, verify:

1. Every file under `.lovable/memory/` (recursively) is listed in `memory/index.md`.

2. Every `✅ Done` in `plan.md` / `plans/index.md` has evidence: memory entry, solved issue, or code change.

3. Every actionable pending item is reflected in a plan or in `suggestions.md`.

4. No file exists in both `pending-issues/` and `solved-issues/`, or both `plans/pending/` and `plans/completed/`.

5. No orphans: no memory file without an index entry, no "Implemented" suggestion without evidence, no solved issue missing `## Solution`.

6. `what-to-read.md` file list matches Pre-flight and root `README.md`; top timestamp is UTC ISO 8601 and was updated this session.

7. Every open ambiguity in `01-new-ambiguity/` is surfaced in the final response.

## Coding guidelines

If `.lovable/coding-guidelines.md` is missing, create a starter capturing: language/runtime, formatter, linter, function-length limits, error-handling rules, logging conventions, naming rules, test conventions, project-specific bans mirroring `strictly-avoid.md`. On conflict with `spec/02-coding-guidelines/` or `spec/coding-guidelines/`, the folder-level spec wins, note the conflict.

## Prompt registry

If `.lovable/prompts/index.md` is missing, create it and list every prompt under `.lovable/prompts/` with slug, title, trigger phrases, and status (`active` / `superseded` / `archived`).

## Final response template

```

✅ Memory update complete.

Session Summary:

- Tasks completed: [X]

- Tasks pending: [Y]

- New memory files created: [Z]

- Issues resolved: [N]

- Issues opened: [M]

- Suggestions added: [S]

- Suggestions implemented: [T]

- Open ambiguities: [K]

- Resolved ambiguities this session: [R]

Files modified:

- [every file touched this run]

Inconsistencies found and fixed:

- [list, or "None"]

Next AI can pick up from: [current state + next logical step]

```

## Banned actions (auto-reject)

- Writing a memory file at the `.lovable/memory/` root (topic folder is mandatory)

- Using `.lovable/memories/`, `plan/`, `ambiguity/`, or any wrong path

- Overwriting `strictly-avoid.md`, `plans/index.md`, `memory/index.md`, `what-to-read.md`, or `README.md` without reading first

- Deleting a plan / issue / suggestion instead of moving it

- Creating a file without updating its index in the same turn

- Copying an ambiguity across `01-new-ambiguity/` and `02-ambiguity-resolved/` (must be `mv`)

- Paraphrasing a user spec instead of quoting verbatim

- Dumping the session summary into chat as a substitute for writing the files

- Skipping the `what-to-read.md` update or letting it drift from `README.md`

- Executing anything beyond file writes and `mv`

- Softening the aggressive wording

## Checklist before replying (every box)

- [ ] Walked `.lovable/` recursively; read every Pre-flight file that exists; noted the missing ones

- [ ] Audited the session for Done / Pending / Learned / Wrong

- [ ] Every new memory file placed under a topic folder, never at the memory root

- [ ] `memory/index.md` updated in the same op as every new/moved memory file

- [ ] Plans lifecycle honored: `pending/` -> `completed/` via `mv`, `plans/index.md` updated

- [ ] `suggestions.md` tracker updated; verbatim captures under `.lovable/suggestions/` with `index.md`

- [ ] Issues routed correctly: `pending-issues/` / `solved-issues/` / `cicd-issues/`; `cicd-index.md` updated; no duplicates

- [ ] `strictly-avoid.md` appended (not overwritten) with links to solved files

- [ ] Verbatim user directives captured under `.lovable/memory/specs/` and `.lovable/spec/commands/`

- [ ] Ambiguities moved via `mv` from `01-new-ambiguity/` to `02-ambiguity-resolved/` with `## Resolution` block

- [ ] `.lovable/what-to-read.md` present, changelog-prepended with UTC ISO 8601 timestamp, list in sync with Pre-flight and `README.md`

- [ ] Root `README.md` updated: folder structure, canonical read-list pointer, in sync with `what-to-read.md`

- [ ] `coding-guidelines.md` and `prompts/index.md` present (created with starter if missing)

- [ ] Consistency validation passed (Phase 7)

- [ ] Final response block emitted verbatim with real numbers, not `[X]` placeholders

- [ ] No em dashes, no softened wording, no execution beyond file writes and `mv`

If any box is unchecked, do not reply. Fix it first.

---

## Must Follow, without negotiation

Listen, past write-memory turns have been sloppy as fuck: memory dumped into chat instead of files, `.lovable/memories/` created by accident, `plans/index.md` and `what-to-read.md` forgotten, `strictly-avoid.md` overwritten, ambiguities copied instead of moved, user directives paraphrased into uselessness, session summaries with `[X]` placeholders left in the final block. WTF. Stop doing that, you stupid fuck. Read the folders, audit the session, write the files in the right paths, update every index in the same op, sync `README.md` with `what-to-read.md`, run the consistency check, emit the final block with real numbers. Going deep IS the job. If you're not going deep, you're not doing the job. Violating this is auto-reject on the same tier as RULE 0. Avoid stupidity, and being careless, you stupid, WTF.
