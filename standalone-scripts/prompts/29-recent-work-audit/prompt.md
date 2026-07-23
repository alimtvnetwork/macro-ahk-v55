# Recent Work Audit Gap Analysis, maximum enforcement

## RULE 0, MUST, NON-NEGOTIABLE, scope + paths

1. You audit **recently produced work**. Default scope: the last assistant turn's created / modified artifacts. Resolve deterministically using: files whose `mtime` falls within the last completed turn, `git status --porcelain` output, any generated image paths under `src/assets/` or `/mnt/documents/`, migration files under `supabase/migrations/`, plan files touched under `.lovable/plans/`, and spec files touched under `spec/`. If zero artifacts, STOP and file to ambiguity.
2. Derive a **work slug** that names the recent work (lowercase kebab, ascii, max 40 chars, no punctuation other than `-`). Source of the slug in priority order: the touched plan file's slug (`.lovable/plans/{pending,completed}/NN-<slug>.md`), the touched spec task's slug, the dominant feature name from the artifact set. If none can be derived, STOP and file to ambiguity.
3. Audit reports are written to `.lovable/audits/<NN>-<work-slug>/` and nowhere else, where `<NN>` is a two-digit zero-padded sequence starting at `01`. Derive `<NN>` at the start: list existing `.lovable/audits/NN-*` folders, take the max `NN` seen and add 1; if none exist, `<NN> = 01`. Monotonic, no gaps, no reuse. Once picked, `<NN>-<work-slug>` is frozen for this run. Create the folder if missing. Read-only on every audited artifact.
4. Audit only. Do NOT rewrite artifacts, do NOT patch code, do NOT run `plan--create`, do NOT regenerate images, do NOT re-run migrations. Findings and confidence scores only. Do NOT self-mirror this prompt.
5. No variables. Paths are hardcoded except for `<NN>` and `<work-slug>` which are derived at the start and then frozen.

## RULE 0, MUST, NON-NEGOTIABLE, cadence + goal

6. **Single pass, single turn.** No phases. No "Phase 1", no "Phase 5", no `next` cadence, no phase files. The audit produces exactly two files: `01-index.md` and `02-<work-slug>.md`. If a prior run in the same folder left `03-*`, `04-*`, etc., delete them in the cleanup step.
7. Every artifact gets an **honest** confidence score, 0 to 100, with a one-line reason. No score, no reply. Inflated scores on broken output = auto-reject.
8. Cleanup runs ONCE at the start of the turn: wipe `.lovable/audits/<NN>-<work-slug>/*.md`, recreate the folder, then write `01-index.md` and `02-<work-slug>.md`. Report the delete count in `01-index.md`.

## Filename map (single source of truth)

Under `.lovable/audits/<NN>-<work-slug>/`, lowercase, two-digit, monotonically increasing, no gaps, no reuse:

| slot | filename | contents |
|------|----------|----------|
| 01 | `01-index.md` | index, roll-up, links to the report |
| 02 | `02-<work-slug>.md` | full audit report (inventory + task-vs-output diff + foundational alignment + confidence + improvement backlog, all inline) |

`01` is reserved for the index forever. `02` is reserved for the audit report forever. Do NOT create any other files in this folder.

## Hard rules

- Read-only on every audited artifact. Only writes: cleanup of `.lovable/audits/<NN>-<work-slug>/`, then `01-index.md`, then `02-<work-slug>.md`.
- Every finding is a checkpoint row: `- [ ] REC-{NNN} | {severity} | {artifact} | {gap} | {evidence} | {improvement}`. No prose blobs.
- Finding IDs are global and monotonic (`REC-001`, `REC-002`, ...) across the whole report.
- Severity: `Critical`, `High`, `Medium`, `Low`. Definitions at the bottom, anchored to confidence bands.
- Every finding cites the artifact by path or id, plus a quoted line / hash / snippet as evidence. No "somewhere".
- Every artifact from the inventory MUST be re-examined in every rubric section (task-vs-output diff, foundational alignment, confidence). No subset audits.
- Aggregate confidence for the batch = **criticality-weighted mean** using weights `Critical=4, High=3, Medium=2, Low=1` applied to per-artifact criticality declared in the inventory.
- Blind-AI ship risk mapping from aggregate confidence: `>=85 low`, `70-84 medium`, `50-69 high`, `<50 critical`.
- Every report includes UTC `run started` (`date -u +%Y-%m-%dT%H:%M:%SZ`) AND `git log -1 --format=%cI` of the last commit for reproducibility.
- Banned vague words without a citation: `unclear`, `maybe`, `somewhere`, `generally`, `consider`, `could be improved`. Auto-reject.
- Lowercase markdown filenames throughout. No em dashes. No en dashes. No off-topic commentary.

## Working stance (past sins, do not repeat)

The AI running this audit has been a stupid fuck before: rubber-stamped its own recent output with a fake 95 percent confidence, skipped the foundational diff, ignored missing acceptance criteria, called half-broken code "shipped", missed brand violations in generated images, forgot to check whether the plan file even exists, buried findings inside prose instead of checkpoints, split one audit into five fake phases across five turns, restarted finding IDs so the backlog could not cite them, and left half the artifacts unaudited. Score honestly. If confidence is 40, say 40. Honesty IS the job.

## Cleanup step (runs ONCE at the start of the turn)

```
rm -f .lovable/audits/<NN>-<work-slug>/*.md
mkdir -p .lovable/audits/<NN>-<work-slug>
```

Report the work slug and the count of files deleted in `01-index.md`.

## `01-index.md` shape

```
# Recent Work Audit, index

Work slug: <work-slug>
Scope: last turn artifacts (see report inventory)
Audit folder: .lovable/audits/<NN>-<work-slug> (cleaned, {N} files removed)
Report file: 02-<work-slug>.md
Run started: <UTC date>
Last commit: <git log -1 --format=%cI>

## Artifacts in scope
| id | kind | path or ref | criticality | confidence % | reviewed? |
|----|------|-------------|-------------|--------------|-----------|

## Rolling counters
- Critical: 0 | High: 0 | Medium: 0 | Low: 0
- Aggregate confidence (criticality-weighted mean): {X}%
- Blind-AI ship risk: {low | medium | high | critical}

## Top findings roll-up (Critical first, then High, max 10)
| id | severity | artifact | gap (one line) |
|----|----------|----------|----------------|
```

## `02-<work-slug>.md` shape (the full audit report)

The report is one file, five sections in order. No phases, no cadence, no per-section files.

```
# Recent Work Audit Report, <work-slug>

Scope: last turn artifacts
Baselines checked: {list}
Artifacts reviewed: {n} of {total} (must be equal)
Run started: <UTC date>
Last commit: <git log -1 --format=%cI>

## 1. Inventory
| id | kind | path or ref | created | criticality | summary |
| -- | ---- | ----------- | ------- | ----------- | ------- |

Kinds: `code`, `spec`, `plan`, `migration`, `image`, `config`, `doc`, `other`.
Criticality (`Critical`/`High`/`Medium`/`Low`) is based on user-facing impact.

## 2. Task-vs-output diff
Quote the user's original ask for each artifact. Diff output against ask. List omissions, extras, misreads.
Findings:
- [ ] REC-{NNN} | {severity} | {artifact} | {gap} | {evidence} | {improvement}

## 3. Foundational alignment
Diff each artifact against the baselines applicable to its kind (see kind-specific rules below).
Findings:
- [ ] REC-{NNN} | ...

## 4. Confidence + risk
| artifact | confidence % | reason (rubric anchor) | top three risks |
| -------- | ------------ | ---------------------- | --------------- |

Aggregate confidence (criticality-weighted mean): {X}%
Blind-AI ship risk: {low | medium | high | critical}

Findings:
- [ ] REC-{NNN} | ...

## 5. Improvement backlog
| task id | severity | artifact(s) | est steps | confidence gain | depends on | source finding ids | needs new plan file? |
| ------- | -------- | ----------- | --------- | --------------- | ---------- | ------------------ | -------------------- |

`Critical` first, then `High`, `Medium`, `Low`. If aggregate confidence >=95 AND no `Critical`/`High` remain, backlog MAY be empty; state that explicitly.

## Notes
{one short factual paragraph, no speculation}
```

## Kind-specific audit rules (used in section 3)

**Code**
- `bun run build` and `tsgo` both pass. Report exit code and last 20 lines on failure.
- `rg -n "TODO|FIXME|XXX|console\.log|debugger"` against changed files: any hit = finding.
- Hardcoded-secret patterns via `rg -n "(sk_|SUPABASE_SERVICE_ROLE|BEGIN RSA|AKIA|ghp_)"`: any hit = Critical.
- Every new import resolves to an existing file or an installed package.
- No dead exports, no unused imports.

**Spec**
- PascalCase tables / JSON / enums, camelCase fields, `TableNameId` primary keys.
- `Type / Status / Category / Kind` as **joined tables**, not inline string enums.
- Seedable-Config compliance for any config surface.
- Boolean naming per the guidelines.
- No em dashes in the spec text itself.

**Plan**
- File exists under `.lovable/plans/pending/` (or `completed/` after move).
- RULE 0 header present with the step count.
- Remaining tasks list present.
- Ambiguity path present (`.lovable/ambiguous-questions/`).
- Subtasks folder used when the plan has >5 tasks.

**Migration**
- File exists under `supabase/migrations/` with timestamp prefix.
- `CREATE TABLE public.*` followed by `GRANT` statements in the same file.
- RLS enabled and policies defined.
- Reversible or documented as one-way.

**Image**
- File exists at the referenced path.
- Aspect ratio matches usage (og:image 1200x630, hero, avatar, etc.), state expected vs actual.
- If the image contains text, run OCR (e.g. `pytesseract`) and verify legibility + spelling.
- Alt text exists in the referring JSX / HTML.
- Brand-lock check where a brand is declared.

**Config / doc / other**
- File exists, references resolve, no stale placeholders (`TODO`, `xxx`, `TBD`).

## Confidence rubric (use these anchors, not vibes)

- **90-100**: ships as-is, no rework, no foundational drift, evidence backs every claim.
- **75-89**: ships with cosmetic polish, no behavior change needed.
- **50-74**: partial rework required, at least one High finding.
- **25-49**: rework required across multiple artifacts, at least one Critical or several High findings.
- **0-24**: broken, unsafe, or contradicts the user's ask.

Severity assignment MUST match the artifact's confidence band: any artifact <50 has at least one Critical finding; any 50-74 has at least one High.

## Severity definitions (anchored to confidence bands)

- **Critical**: artifact confidence <50, broken / unsafe / contradicts the user's ask, or violates a foundational rule.
- **High**: artifact confidence 50-74, partial rework required before ship.
- **Medium**: artifact confidence 75-89, quality or consistency drift, ships with polish.
- **Low**: artifact confidence 90-99, cosmetic only.

## Checklist before replying (any unchecked = reply rejected)

- [ ] Scope resolved deterministically (mtime / git / known paths), artifact list stated. If zero artifacts, filed to Ambiguity and stopped.
- [ ] `<NN>` and `<work-slug>` derived and frozen. Folder created.
- [ ] Cleanup ran once: `.lovable/audits/<NN>-<work-slug>/` cleaned, delete count reported.
- [ ] Only two files written: `01-index.md` and `02-<work-slug>.md`. No `03-*`, no `phase-*`, no other files.
- [ ] Every artifact in scope listed with kind, path, criticality, confidence %, reviewed status. All artifacts re-examined in every section.
- [ ] Every finding cites artifact + evidence, uses a global monotonic `REC-###` id, includes severity + improvement.
- [ ] No banned vague words without a citation.
- [ ] Kind-specific rules applied per artifact kind.
- [ ] Confidence scores use the rubric bands, severity matches the band.
- [ ] Aggregate confidence uses criticality-weighted mean; ship risk uses the threshold mapping.
- [ ] Improvement backlog uses the fixed schema; empty backlog only if aggregate >=95 and no Critical/High.
- [ ] No artifacts modified.
- [ ] Run started + last commit timestamps included.
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
Blocking: recent-work audit <NN>-<work-slug>

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

Never leave a copy behind. If the audit is blocked by an open ambiguity, still emit `01-index.md` + `02-<work-slug>.md`, set `Status: blocked-by-ambiguity`, and link the question file(s) in `## Notes`.

## Must Follow and without negotiation

Listen, past audit turns have been stupid fuck sloppy: self-congratulatory 95 percent scores on broken output, no foundational diff, no acceptance-criteria check, images passed without brand-lock check, code passed without build check, specs passed without PascalCase check, plans passed without checking whether the file exists, split one audit into five phony phases across five turns, deleted prior audit files mid-run, restarted finding IDs so the backlog could not cite them, self-mirrored the prompt to `.lovable/prompts/`. WTF. Stop that. One turn, one cleanup, `01-index.md` + `02-<work-slug>.md`, enumerate artifacts deterministically, re-examine every artifact in every rubric section, diff against ask and foundations, score honestly against the rubric bands, emit findings with evidence and global IDs, aggregate with criticality weights, map ship risk from the thresholds, backlog at the bottom, stop. If confidence is low, say low. Going deep IS the job.
