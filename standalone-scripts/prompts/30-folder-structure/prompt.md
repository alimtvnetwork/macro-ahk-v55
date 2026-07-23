# Canonical `.lovable/` folder structure (source of truth)

Every prompt in this set writes into this tree. No invented folders, no alternate paths. If a prompt seems to want a folder not listed here, the prompt is wrong, not the tree.

All dates are UTC. All filenames are lowercase kebab-case with a two-digit zero-padded `XX` prefix where sequencing applies. `XX` is monotonic within its folder scope (see per-folder rules below).

```
.lovable/
  what-to-read.md                      # priority reading list for read-memory
  coding-guidelines.md                 # mirror of spec source of truth
  prompts/                             # ONLY when a prompt body itself changes
    XX-<slug>.md
  spec/                                # canonical app specs (source of truth)
    21-<area>/                         # foundational app spec areas
    25-app-audit/                      # output of app-spec audit
      01-index.md
      02-<slug>.md
    commands/                          # command conventions
    17-consolidated-guidelines/
      31-compiled-simple-coding-guidelines.md   # coding-guidelines source of truth
  plans/
    index.md                           # roll-up of every plan, status, links
    pending/
      XX-<slug>.md                     # active plans
    completed/
      XX-<slug>.md                     # finished plans (moved, not copied)
  issues/                              # app-level bugs and blockers
    XX-<slug>.md
  cicd-issues/                         # CI / CD failures
    XX-<slug>.md
  audits/
    XX-<work-slug>/                    # one folder per recent-work audit run
      01-index.md
      02-<work-slug>.md
  release/
    issues/
      XX-<version>-<slug>.md          # release-time failures and flags
  ambiguous-questions/                 # see 14-ambiguity-prompt.md
    01-new-ambiguity/
      XX-<slug>.md
    02-ambiguity-resolved/
      XX-<slug>.md
  assets/                              # attachments referenced by specs / plans / audits
    <category>/
      XX-<slug>.<ext>
```

## Numbering rules (`XX`)

- Two-digit zero-padded, monotonic per folder scope.
- Next `XX` = max existing `XX` in that folder scope + 1. Never reuse.
- Ambiguous questions: `XX` is monotonic across BOTH `01-new-ambiguity/` and `02-ambiguity-resolved/` combined (see `14-ambiguity-prompt.md`).
- Audits: `XX` in `.lovable/audits/XX-<work-slug>/` is monotonic across all audit folders combined.
- Release issues: `XX` monotonic within `.lovable/release/issues/` regardless of version.
- Plans: `XX` monotonic across `pending/` and `completed/` combined; filename does not change when moving between them.

## Movement rules

- `mv`, never `cp`. Files carry their filename when their lifecycle changes folders (plan pending -> completed, ambiguity open -> resolved).
- Never leave a copy behind in the origin folder.
- Never rename on move.

## What each folder is for

- `spec/` - source-of-truth application spec. Only `improve-spec-from-audit` and explicit spec work edit `spec/21-*`. `app-spec-audit` only writes to `spec/25-app-audit/`.
- `plans/` - every plan built by `01-plan-prompt.md`. `04-next-tasks-prompt.md` moves finished plans to `completed/` and updates `index.md`.
- `issues/` and `cicd-issues/` - runtime bugs and pipeline failures. Not the same as ambiguities and not the same as release issues.
- `audits/` - one folder per `10-recent-work-audit.md` run. Never mutated after write.
- `release/issues/` - only issues discovered during `11-release.md`.
- `ambiguous-questions/` - open questions raised by any prompt. Canonical shape in `14-ambiguity-prompt.md`.
- `assets/` - any binary or image referenced by a spec, plan, audit, or task. Reference by relative path with a caption.
- `prompts/` - only touched when a prompt body itself changes. Never a per-invocation archive.

## Hard bans

- No `ambiguities/`, `questions/`, `blockers/`, `todo/`, `notes/`, or any folder name not listed above.
- No per-turn mirror files under `.lovable/prompts/`.
- No renaming a file when moving it between lifecycle folders.
- No writing outside `.lovable/` except `spec/` (which the app owns).
- No guessing when the folder is unclear. File an ambiguity per `14-ambiguity-prompt.md`.
