# Write Memory (a.k.a. "End Memory")

> **Purpose:** Persist everything the AI learned, did, decided, and left undone in this session, so the next AI session (which has full amnesia) can resume with zero context loss.

## Must Write

Update the root `README.md` to describe the folder structure and which files the AI must read to understand the full project with attention: how to create code, add unit tests, add new features, write specs, and everything else. All those files must be mentioned in the root `README.md` and also mirrored in `.lovable/what-to-read.md` (create this file if it does not exist).

Do NOT put any files at the `mem://` root directly. Every memory file must live under a specific folder (`.lovable/memory/<topic>/...`).

> **Trigger phrases:** `write memory` · `end memory` · `update memory` · end of a task batch

---

## 0. Pre-flight, Read Before You Write

Before doing anything, the AI **must** read these files (if they exist) to ground itself:

1. `.lovable/memory/index.md`, master index of memory
2. `.lovable/coding-guidelines.md`, project coding rules (see §10 below)
3. `.lovable/plan.md`, active roadmap
4. `.lovable/suggestions.md`, open and closed suggestions
5. `.lovable/strictly-avoid.md`, hard prohibitions
6. `.lovable/cicd-index.md`, CI/CD issue index
7. `.lovable/prompts/index.md`, prompt registry
8. `.lovable/what-to-read.md`, canonical read-list for the AI (see §7A)
9. `.lovable/memory/workflow/`, current workflow state
10. Any `spec/` or `spec/error-manage/` folder if present

If any of the above is missing, **create it** as part of this run (see §10, §11, and §7A for templates).

Also, **before writing**, ask the user (only if genuinely ambiguous):

- "Is there any conversation context I might be missing?"
- "Should I treat this batch as a milestone or a checkpoint?"

If nothing is ambiguous, proceed silently.

---

## 1. Core Principle

> The memory system is the project's brain. If you did something and didn't write it down, it didn't happen. If something is pending and you didn't record it, it will be lost. **Write as if the next AI has amnesia, because it does.**

Rules that override convenience:

- **Never lose conversation context.** Capture user prompts verbatim when they contain specs, decisions, or preferences.
- **Never delete history**, mark done, move to `## Completed`, never erase.
- **Never overwrite blindly**, always read before write.
- **Never leave orphans**, every file must be indexed.
- **Lowercase, hyphen-separated, numeric-prefixed filenames** (`01-thing-name.md`).
- **Never create `.lovable/memories/`** (with `s`). The correct path is `.lovable/memory/`.

---

## 2. Phase 1, Audit the Session

Internally answer (do not dump to user unless asked):

**Done**

- Every task completed (features, fixes, refactors)
- Every file created / modified / deleted
- Every decision made and why

**Pending**

- Tasks started but unfinished
- Tasks discussed but not started
- Blockers / dependencies

**Learned**

- New patterns, conventions, gotchas
- User preferences (explicit or implicit)

**Wrong**

- Bugs and root causes
- Failed approaches
- Things to never repeat

---

## 3. Phase 2, Update Memory Files

**Target:** `.lovable/memory/`

1. **Read** `.lovable/memory/index.md`. Do not create duplicates.
2. **Update existing files**, add new info in the right section, mark items `[x]` or `✅`, **never truncate unrelated entries**.
3. **Create new files** when a topic doesn't fit anywhere: `.lovable/memory/<topic>/XX-descriptive-name.md` (XX = next sequence, starting `01`). Never place files at the memory root, always under a topic folder. **Immediately** add the new file to `index.md` in the same operation.
4. **Update workflow state** in `.lovable/memory/workflow/` with status markers:

| Status       | Marker                  |
| ------------ | ----------------------- |
| Done         | `✅ Done`               |
| In Progress  | `🔄 In Progress`        |
| Pending      | `⏳ Pending`            |
| Blocked      | `🚫 Blocked, [reason]`  |
| Avoid / Skip | `🚫 Avoid, [reason]`    |

**Anything the user said to skip or avoid** goes into `.lovable/memory/avoid/XX-name.md` and is referenced from `.lovable/strictly-avoid.md`.

---

## 4. Phase 3, Plans & Suggestions

### 4A. Plan, `.lovable/plan.md` (single file)

- Update task statuses.
- Add new tasks discovered this session.
- Move fully-complete items to a `## Completed` section at the bottom (do not delete).

### 4B. Suggestions, `.lovable/suggestions.md` (single file)

```markdown
## Active Suggestions

### [Title]
- **Status:** Pending | In Review | Approved | Rejected
- **Priority:** High | Medium | Low
- **Description:** what & why
- **Added:** [session ref]

## Implemented Suggestions

### [Title]
- **Implemented:** [session ref]
- **Notes:** details / commit / file
```

When implemented: move from Active to Implemented and add notes.

### 4C. Lovable suggestions folder

Capture all Lovable-originated suggestions verbatim into:

- `.lovable/suggestions/XX-suggestion-name.md`
- `.lovable/suggestions/index.md` (summary index)

These are in addition to `suggestions.md` (the high-level single file). Do not duplicate content, the per-file version is the verbatim capture, `suggestions.md` is the tracker.

---

## 5. Phase 4, Issues

### 5A. Pending, `.lovable/pending-issues/XX-short-description.md`

```markdown
# [Issue Title]
## Description
## Root Cause (or "Under investigation")
## Steps to Reproduce
## Attempted Solutions
- [ ] Approach 1, [result]
## Priority High | Medium | Low
## Blocked By (if any)
```

### 5B. Solved, `.lovable/solved-issues/XX-short-description.md`

On resolution, **move** the file and append:

```markdown
## Solution
## Iteration Count
## Learning
## What NOT to Repeat
```

### 5C. Strictly Avoid, `.lovable/strictly-avoid.md`

```markdown
- **[Pattern]:** [why forbidden]. See: `.lovable/solved-issues/XX-name.md`
```

---

## 6. Phase 5, CI/CD Issues

Track every CI/CD issue encountered, **without duplication**.

- File: `.lovable/cicd-issues/XX-issue-name.md` (XX from `01`)
- Index: `.lovable/cicd-index.md`, short summary list of all CI/CD issues

Before adding a new one, scan the index to confirm it isn't already recorded.

---

## 7. Phase 6, Capture Recent Specs Verbatim

If the user provided a sizeable spec, decision, or directive this session:

- Save the **verbatim** text to `.lovable/memory/specs/XX-spec-slug.md`
- Add a one-line summary in `.lovable/memory/index.md`
- If it changes the roadmap, also reflect in `plan.md`

Never paraphrase specs, quote them. The next AI must see what the user actually said.

### 7A. `.lovable/what-to-read.md`, canonical AI read-list

This file is the single map of "what to read, and in what order, before touching this project." It must exist after every memory write: create it if missing, update it (never blindly overwrite) if present.

**Required content:**

- A dated changelog entry at the top, timestamped in UTC+00:00, ISO 8601 format: `YYYY-MM-DDThh:mm:ssZ` (e.g. `2026-07-16T14:32:00Z`). Every time this file is updated, prepend a new entry, do not overwrite the previous timestamp.
- The full list of files/folders the AI must read before starting any task, matching (and kept in sync with) the Pre-flight list in §0.
- A short note next to each entry explaining *why* it matters (e.g. "coding-guidelines.md, function-length limits, error-handling rules, naming conventions").
- Separate subsections for: reading before writing code, reading before adding a feature, reading before writing a spec, reading before adding a unit test, since different tasks need different subsets of the read-list.
- A pointer to the root `README.md`, and a note that `README.md` and `what-to-read.md` must stay in sync (same file list, no drift): if one is updated, check the other.

**Template:**

```markdown
# What to Read

> Canonical map of what the AI must read before working on this project.
> Last updated: <UTC+00:00 timestamp, ISO 8601>

## Changelog
- <UTC+00:00 timestamp>, <one-line summary of what changed>

## Before any task (always)
- `.lovable/memory/index.md`, why: ...
- `.lovable/coding-guidelines.md`, why: ...
- `.lovable/plan.md`, why: ...
- `.lovable/strictly-avoid.md`, why: ...
(sync with §0 Pre-flight list)

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

The root `README.md` must be updated in the same operation to mention `.lovable/what-to-read.md` as the authoritative pointer, per the user's original instruction in "Must Write" above.

---

## 8. Phase 7, Consistency Validation

After all writes:

1. **Index integrity**, every file under `.lovable/memory/` (recursively) is listed in `index.md`.
2. **Cross-references**, every `✅ Done` in `plan.md` has evidence (memory entry, solved issue, or code change). Every actionable pending issue is reflected in `plan.md` or `suggestions.md`.
3. **No file** exists in both `pending-issues/` and `solved-issues/`.
4. **No orphans**, no memory file without an index entry; no "Implemented" suggestion without code evidence; no solved issue missing `## Solution`.
5. **`what-to-read.md` sync**, its file list matches §0 Pre-flight and the root `README.md`; its top timestamp is UTC+00:00 and was updated this session.

### Final response template

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

Files modified:
- [list every file touched during this memory update]

Inconsistencies found and fixed:
- [list any, or "None"]

The next AI session can pick up from: [current state + next logical step]
```

---

## 9. File naming & structure rules

| Rule                                     | Example                                    |
| ---------------------------------------- | ------------------------------------------ |
| Numeric prefix                           | `01-auth-flow.md`                          |
| Lowercase hyphenated                     | `03-error-handling.md` ✅ / `03_Error.md` ❌ |
| Plans, single file                       | `.lovable/plan.md`                         |
| Suggestions, single file                 | `.lovable/suggestions.md`                  |
| Pending issues, one file each            | `.lovable/pending-issues/XX-name.md`       |
| Solved issues, one file each             | `.lovable/solved-issues/XX-name.md`        |
| Memory grouped by topic (never at root)  | `.lovable/memory/workflow/`, `.lovable/memory/architecture/`, ... |
| Completed items, `## Completed` section  | Never `completed/` sub-folders             |

```
.lovable/
├── overview.md
├── strictly-avoid.md
├── user-preferences
├── plan.md
├── suggestions.md
├── what-to-read.md
├── prompt.md
├── prompts/
│   └── 03-write-memory.md
├── memory/
│   ├── index.md
│   ├── workflow/
│   ├── architecture/
│   └── [topic]/
├── suggestions/
├── pending-issues/
├── solved-issues/
├── cicd-index.md
└── cicd-issues/
```

> ⚠️ Path is `.lovable/memory/`, never `.lovable/memories/`.

---

## 10. Coding guidelines, `.lovable/coding-guidelines.md`

If this file does not exist, create it with a starter template capturing at minimum: language/runtime, formatter, linter, function-length limits, error-handling rules, logging conventions, naming rules, test conventions, and any project-specific bans (mirroring `strictly-avoid.md`).

---

## 11. Prompt registry, `.lovable/prompts/index.md`

If this file does not exist, create it and list every prompt file under `.lovable/prompts/` with slug, title, trigger phrases, and status (`active` / `superseded` / `archived`).

---

## 12. Anti-corruption rules

1. Never delete history.
2. Never overwrite blindly.
3. Never leave orphans, index everything.
4. Never split what should be unified (`plan.md`, `suggestions.md` stay single files).
5. Never mix states (pending vs solved, done vs in-progress).
6. Never skip an index update in the same op as a file creation.
7. Never assume the next AI knows anything.
8. Never act on this prompt unless the user explicitly triggers it.
9. Never lose conversation context, when in doubt, capture verbatim.
10. Never write memory files at the `mem://` or `.lovable/memory/` root, always under a topic folder.

---

## 13. Meta, Improve This Prompt

At the end of every memory write, the AI should ask itself:

> "Did anything this session reveal a gap, ambiguity, or missing rule in this prompt?"

If yes:

1. Propose the improvement to the user in one short paragraph.
2. On approval, update this prompt and bump a `## Changelog` entry at the bottom.
3. Reflect the change in `.lovable/prompts/index.md`.

---

## Changelog

- `v2`, adds §7A `.lovable/what-to-read.md` canonical read-list, mandates root `README.md` sync, bans memory files at the `mem://` / memory root (must live under topic folders), and refreshes the Pre-flight list to include `what-to-read.md`.
- `v1`, initial enhanced version derived from the user's original "Write Memory" prompt.

---

title: Write Memory
slug: write-memory
