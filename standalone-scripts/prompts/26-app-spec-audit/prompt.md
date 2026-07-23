# App Spec Audit Gap Analysis, maximum enforcement

## RULE 0, MUST, NON-NEGOTIABLE, scope + paths

1. This audit targets the **recently written app spec**. Default source folder: the **21 app folder** (`spec/21-*`, the single numbered app folder). If the user message explicitly says `audit spec/NN-<name>`, honor that override and treat that folder as the 21 app folder for this run. If more than one `21-*` folder exists, or none, or the folder is empty, STOP and file to ambiguity.
2. Audit reports are written to `spec/25-app-audit/` and nowhere else. Read-only on everything under the source folder.
3. Audit only. Do NOT edit specs, do NOT write code, do NOT scaffold, do NOT run `plan--create`, do NOT propose commits, do NOT self-mirror this prompt. Findings only.

## RULE 0, MUST, NON-NEGOTIABLE, cadence + goal

4. **Single pass, single turn.** No phases. No "Phase 1", no "Phase 5", no `next` cadence, no phase files. The audit produces exactly two files: `01-index.md` and `02-<slug>.md`. If a prior run left `03-*`, `04-*`, etc., delete them in the cleanup step.
5. **Goal, non-negotiable: anything less than 100 percent MUST be written in full detail.** If any file in the source folder is not 100 percent implementable, ship-ready, and consistent with the foundations, the gap MUST be captured as an explicit finding with `path:section`, quoted evidence, the exact deficit, the concrete paste-ready fix hint, and the percent it falls short. "Looks fine", "mostly good", "minor nit" without a full finding row = auto-reject.
6. Cleanup runs ONCE at the start of the turn: wipe `spec/25-app-audit/*.md`, recreate the folder, then write `01-index.md` and `02-<slug>.md`. Report the delete count in `01-index.md`.
7. No variables. Paths are hardcoded. `<slug>` = lowercase kebab-case ascii, max 40 chars, no punctuation other than `-`, derived from the source folder name (`spec/21-<name>` → `<name>`).

## Filename map (single source of truth)

Under `spec/25-app-audit/`, lowercase, two-digit, monotonically increasing, no gaps, no reuse:

| slot | filename | contents |
|------|----------|----------|
| 01 | `01-index.md` | index, roll-up, links to the report |
| 02 | `02-<slug>.md` | full audit report (structural + foundational + completeness + blind-AI risk + fix backlog, all inline) |

`01` is reserved for the index forever. `02` is reserved for the audit report forever. Do NOT create any other files in this folder.

## Hard rules

- Read-only on source specs. Only writes: cleanup of `spec/25-app-audit/`, then `01-index.md`, then `02-<slug>.md`.
- Every finding is a checkpoint row: `- [ ] APP-{NNN} | {severity} | {file:section} | {gap} | {shortfall %} | {fix hint}`. No prose blobs.
- Finding IDs are global and monotonic (`APP-001`, `APP-002`, ...) across the whole report.
- Severity: `Critical`, `High`, `Medium`, `Low`. Definitions at the bottom.
- Every finding cites exact `path:section` (and `:line` when a specific line is at issue). No "somewhere in the app spec".
- Every file in the source folder MUST be read and listed. No subset audits.
- Blind-AI failure percent per file is MANDATORY, using the rubric below. Aggregate is a **bytes-weighted mean** across files (bigger files count more).
- **100 percent rule**: every file gets a per-file completeness percent using the completeness rubric. Any file below 100 requires one finding per shortfall reason. No silent passes.
- Lowercase markdown filenames throughout. No em dashes. No en dashes. No off-topic commentary.

## Foundational baselines (discover in this order, use first hit)

1. Coding guidelines: repo root `coding-guidelines.md` → `spec/*coding-guidelines*/` → `.lovable/coding-guidelines/coding-guidelines.md` → `.cursorrules`.
2. Boolean naming rules (Boolean section of the guidelines).
3. Enum patterns: enums in code; `Type / Status / Category / Kind` as **joined tables**.
4. Split-database rules.
5. Seedable-Config concepts (any config surface must be Seedable-Config compliant).
6. Naming: PascalCase tables / JSON / enums, camelCase fields, `TableNameId` primary keys.

State which baseline paths resolved for THIS run in `01-index.md`. If a baseline is missing, list it as a `Critical` finding, do not fabricate one.

## Cleanup step (runs ONCE at the start of the turn)

```
rm -f spec/25-app-audit/*.md
mkdir -p spec/25-app-audit
```

Report the count of files deleted in `01-index.md`. If the folder did not exist, say so.

## `01-index.md` shape

```
# App Spec Audit, index

Source folder: spec/21-<name>  (or the explicit override)
Audit folder: spec/25-app-audit (cleaned, {N} files removed)
Report file: 02-<slug>.md
Run started: <UTC date from `date -u +%Y-%m-%dT%H:%M:%SZ`>

## Foundational baselines resolved
- coding-guidelines: <path or MISSING>
- booleans: <path or section ref or MISSING>
- enums: <path or MISSING>
- split-db: <path or MISSING>
- seedable-config: <path or MISSING>
- naming: <path or MISSING>

## Files in scope
| # | path | bytes | sections | completeness % | blind-AI failure % | read? |
|---|------|-------|----------|----------------|--------------------|-------|

## Rolling counters
- Critical: 0 | High: 0 | Medium: 0 | Low: 0
- Aggregate completeness (bytes-weighted mean): {X}%
- Aggregate blind-AI failure percent (bytes-weighted mean): {Y}%

## Top findings roll-up (Critical first, then High, max 10)
| id | severity | file:section | gap (one line) |
|----|----------|--------------|----------------|
```

## `02-<slug>.md` shape (the full audit report)

The report is one file, five sections in order. No phases, no cadence, no per-section files.

```
# App Spec Audit Report, <slug>

Source: spec/21-<name>
Baselines checked: {list}
Files read: {n} of {total} (must be equal)
Run started: <UTC date>

## 1. Structural
Folder placement, numbering continuity, file naming, section naming, separation of concerns.
Findings:
- [ ] APP-{NNN} | {severity} | {path:section} | {gap} | {shortfall %} | {fix hint}

## 2. Foundational alignment
For each baseline (coding guidelines, booleans, enums, split-db, Seedable-Config, naming): diff the source folder. Cross-file consistency check (same enum / entity name spelled or cased differently across files = finding).
Findings:
- [ ] APP-{NNN} | ...

## 3. Content completeness
Backend, frontend, admin, DB rules, flow details, acceptance criteria per feature (input / output / error / side effect / permission), error handling, logging, settings behavior.

Per-file completeness:
| file | completeness % | top reasons for shortfall |
| ---- | -------------- | ------------------------- |

Findings:
- [ ] APP-{NNN} | ...

## 4. Blind-AI failure risk
Per file: blind-AI failure percent + one-line reason using the rubric anchors below.

| file | failure % | reason (rubric anchor) |
| ---- | --------- | ---------------------- |

Aggregate blind-AI failure (bytes-weighted mean): {X}%

Findings:
- [ ] APP-{NNN} | ...

## 5. Fix backlog
Atomic fixable tasks. `Critical` first, then `High`, `Medium`, `Low`.

| task id | severity | files touched | est steps | completeness gain | depends on | source finding ids |
| ------- | -------- | ------------- | --------- | ----------------- | ---------- | ------------------ |

If aggregate completeness reached 100 AND no `Critical`/`High` remain, backlog MAY be empty; state that explicitly.

## Notes
{one short factual paragraph, no speculation}
```

## Blind-AI failure rubric (use these anchors, not vibes)

- 0-20: spec is executable as-is, at most cosmetic guesses.
- 21-40: minor guesses on naming or ordering, output still correct.
- 41-60: major guesses on behavior, wrong output likely in some flows.
- 61-80: wrong output likely in most flows, missing acceptance criteria.
- 81-100: cannot implement without asking, or contradicts foundations.

## Completeness rubric (100 percent goal, mandatory)

Every file in the source folder starts at 100. Subtract for each concrete deficit:
- Missing acceptance criteria per feature: -10 each.
- Missing error / edge behavior: -8 each.
- Foundational rule violation (naming, enums, booleans, split-db, Seedable-Config): -10 each.
- Cross-file inconsistency the file participates in: -6 each.
- Vague or ambiguous prose the blind AI would have to guess on: -5 each.
- Missing acceptance test / checklist for a stated behavior: -5 each.
- Undefined data type / shape / range: -4 each.

Never round up. Floor at 0. Any file below 100 REQUIRES one finding row per deducted item, each explaining the shortfall in full detail.

## Reducing guesswork (make findings specific, not "somewhere")

If a finding uses any of the words below without a citation, it is auto-rejected:
- "unclear", "maybe", "somewhere", "generally", "consider", "could be improved".

Concrete replacements the audit MUST use instead:
- "unclear naming" → cite `path:section:line` and list the two candidate names.
- "missing acceptance criteria" → cite the feature heading and list the missing bullets: input, output, error, side effect, permission.
- "wrong enum shape" → quote the current shape and the required joined-table shape.
- "spec drift" → name the two files and the exact tokens that disagree.
- "would need to guess X" → state X, list the values the blind AI would have to pick between.

Every finding row MUST include a `fix hint` that a blind AI could paste. If you cannot write the fix hint, the finding is not concrete enough, rewrite it.

## Severity definitions

- **Critical**: blocks implementation, guarantees blind-AI failure, or directly violates a foundational rule.
- **High**: causes ambiguity or wrong behavior, high chance of drift.
- **Medium**: weakens clarity or maintainability, unlikely to block implementation alone.
- **Low**: cosmetic or secondary consistency issue.

## Checklist before replying (any unchecked = reply rejected)

- [ ] Source folder resolved to exactly one folder (`spec/21-*` or explicit override), path stated. If ambiguous / missing / empty, filed to Ambiguity and stopped.
- [ ] Cleanup ran once: `spec/25-app-audit/` cleaned, delete count reported.
- [ ] Only two files written: `01-index.md` and `02-<slug>.md`. No `03-*`, no `phase-*`, no other files.
- [ ] Every file in the source folder listed in the index with bytes, completeness %, blind-AI failure %, and read status. All files marked read.
- [ ] Every finding cites `path:section`, uses a global monotonic `APP-###` id, includes shortfall %, and includes a concrete paste-ready fix hint.
- [ ] No banned vague words without a citation.
- [ ] Every file below 100 percent has one finding per shortfall reason. No silent passes.
- [ ] Severity assigned to every finding, counters updated in the index.
- [ ] Foundational baselines diffed, each baseline path stated.
- [ ] Blind-AI failure score included using the rubric, aggregate is bytes-weighted mean.
- [ ] Fix backlog uses the fixed table schema; empty backlog only if aggregate completeness is 100 and no Critical/High remain.
- [ ] No files under the source folder modified.
- [ ] No em dashes, no en dashes, no off-topic commentary.

## Ambiguity handling (open questions and answers)

Ambiguity is not a license to guess. It is a file to write.

- Open: `.lovable/ambiguous-questions/01-new-ambiguity/XX-<slug>.md`
- Answered: `.lovable/ambiguous-questions/02-ambiguity-resolved/XX-<slug>.md`

New question file shape:

```
# <one-line question>
Slug: <slug>
Status: open
Raised: <YYYY-MM-DD>
Blocking: app-spec audit (source folder <path>)

## Question
## Options considered
## Impact if guessed wrong
```

When answered: `mv` from `01-new-ambiguity/` to `02-ambiguity-resolved/`, flip `Status: resolved`, and append:

```
## Resolution
Answered: <YYYY-MM-DD>
Answer: <user answer>
Applied solution: <what changed / where>
```

Never leave a copy behind. If the audit is blocked by an open ambiguity, still emit `01-index.md` + `02-<slug>.md`, set `Status: blocked-by-ambiguity`, and link the question file(s) in `## Notes`.

## Must Follow and without negotiation

Listen, past audit turns were stupid fuck sloppy: skimmed one file and called it done, invented findings not backed by file text, softened severity to look agreeable, dropped the blind-AI failure score, forgot the foundational diff, wrote prose instead of checklists, closed with "looks good" when it was not 100 percent, split the audit into fake phases and dragged it across turns, restarted finding IDs so the backlog could not cite them, self-mirrored the prompt to `.lovable/prompts/`, and left the source folder half-audited. Stop that. One turn, one cleanup, `01-index.md` + `02-<slug>.md`, every file read, every baseline diffed, every file scored against the 100 percent goal, every shortfall a full finding, blind-AI failure honestly scored with a bytes-weighted aggregate, IDs global and monotonic, fix backlog at the bottom, stop. Going deep IS the job.
