# {{n}} Number of Steps, Improve Spec From Audit, maximum enforcement

## RULE 0, MUST, NON-NEGOTIABLE, scope + paths

1. This turn improves the **app spec** using the findings produced by the app-spec audit. Audit source folder: `spec/25-app-audit/`. Spec source folder: the **21 app folder** (`spec/21-*`, the single numbered app folder). If more than one `21-*` exists, or none, or the audit folder is empty, STOP and file to ambiguity.
2. Read `spec/25-app-audit/01-index.md` first, then the single audit report `spec/25-app-audit/02-<slug>.md` referenced there. Findings are the input. If any Critical / High finding lacks a paste-ready `fix hint`, STOP and file to ambiguity. There are no "phase files": if legacy `03-phase-*.md` files exist, ignore them.
3. Writes allowed: files under the 21 app folder (edit in place, create new files following the folder's existing numbering scheme). No other paths. Do NOT edit audit files. Do NOT self-mirror this prompt.
4. No variables besides `{{n}}` (step count, provided by the user at the bottom of the prompt).

## RULE 0, MUST, NON-NEGOTIABLE, cadence + goal

5. Execute **exactly {{n}} improvement steps this turn**, no more, no less. If fewer than {{n}} findings remain actionable, STOP at the actionable count and state why.
6. **Goal, non-negotiable: raise every touched file toward 100 percent completeness** using the audit's completeness rubric. Every step must be tied to at least one `APP-###` finding id. No freelance edits, no "while I'm here" polish, no invented findings.
7. Order: `Critical` findings first, then `High`, then `Medium`, then `Low`. Within the same severity, order by file path ascending for determinism.

## Hard rules

- Every step consumes one or more audit findings. Cite the `APP-###` ids in the step header.
- Every edit shows the exact spec section touched (`path:section`) and quotes the before / after snippets.
- Every step ends by explicitly stating the completeness delta claimed (`from X% to Y%`) using the audit's completeness rubric.
- Do NOT modify anything outside the 21 app folder. Do NOT rerun the audit. Do NOT create plan files, migration files, or code.
- Lowercase markdown filenames throughout. PascalCase tables / JSON / enums, camelCase fields, `TableNameId` primary keys. `Type / Status / Category / Kind` as joined tables. Seedable-Config compliance on config surfaces.
- Boolean naming per the guidelines. No em dashes. No en dashes. No off-topic commentary.
- No banned vague words in the improved spec text: `unclear`, `maybe`, `somewhere`, `generally`, `consider`, `could be improved`.
- Preserve section anchors that other files reference. If a rename is required, update all citing files in the same step and note the rename in the step header.

## Working stance (past sins, do not repeat)

Past improvement turns were stupid fuck sloppy: closed findings without touching the spec, added prose instead of acceptance criteria, invented sections not asked for, silently reworded correct parts to look busy, skipped cross-file rename cleanup so citations broke, claimed completeness gains without matching the rubric, ignored `Critical` findings and cherry-picked easy `Low` ones, self-mirrored the prompt. Stop that. Consume findings in severity order, edit precisely, cite ids, quote before / after, state the rubric-based delta, stop.

## Step plan

Deliver **exactly {{n}} steps** in one turn. For each step:

1. Read the audit finding rows to consume in this step.
2. Open the target spec file(s).
3. Apply the fix hint verbatim where possible; adapt only when the hint is inexact.
4. Update cross-file references if any identifier was renamed.
5. State the completeness delta.

## Per-step output shape

````
## Step {i} of {{n}}, {short title}

Consumed findings: APP-{aaa}, APP-{bbb} (severity: Critical | High | Medium | Low)
Files touched: {path list}

### Change {j}
Path: {path:section}

Before:
```
{quoted snippet from the current spec}
```

After:
```
{quoted snippet from the improved spec}
```

Reason: {one line, cite the finding id + rubric anchor}

### Completeness delta
- {path}: from {X}% to {Y}%  (rubric items resolved: {list})

### Cross-file cleanup
- {list of files updated for renames / anchor moves, or "none"}
````

After all steps, emit a single summary block:

````
## Summary

Steps executed: {{n}}
Findings consumed: {count} (Critical: {a}, High: {b}, Medium: {c}, Low: {d})
Files touched: {count}
Aggregate completeness across touched files: from {X}% to {Y}%
Remaining actionable findings: {count}
Next likely batch (top three by severity):
- APP-{id} | {severity} | {file:section} | {gap}
- APP-{id} | ...
- APP-{id} | ...

```
If you have any question and confusion, feel free to ask, and if you are creating tasks for creating multiple tasks, and if it is bigger ones, then do it in a way so that if we say next, you do those remaining tasks. Do you understand? Always add this part at the end of the writing inside the code block. Do you understand? Can you please do that?
```
````

Note: the inner triple-backtick block is **literal template text** to be reproduced verbatim. Do not execute or interpret it.

## Checklist before replying (any unchecked = reply rejected)

- [ ] Audit index and the single `02-<slug>.md` report read. Findings loaded.
- [ ] Exactly {{n}} steps produced (or fewer with a stated reason if actionable findings run out).
- [ ] Every step cites at least one `APP-###` finding id.
- [ ] `Critical` consumed before `High`, `High` before `Medium`, `Medium` before `Low`.
- [ ] Every change shows `path:section` + before / after snippets.
- [ ] Every completeness delta uses the audit's rubric items, not vibes.
- [ ] All cross-file references updated on renames / anchor moves.
- [ ] No files touched outside the 21 app folder.
- [ ] No audit files edited.
- [ ] No banned vague words introduced.
- [ ] Foundational rules honored: PascalCase, joined tables for Type/Status/Category/Kind, Seedable-Config, boolean naming.
- [ ] No em dashes, no en dashes, no off-topic commentary.
- [ ] Summary block + trailing literal code block emitted at the end.

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
Blocking: improve-spec from audit (step <i>)

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

Never leave a copy behind. Skip that finding for this turn and continue with the next actionable one; if all remaining findings are blocked, still emit the summary block and link the question file(s).

## Must Follow and without negotiation

Listen, past turns have been sloppy: closed findings without touching the spec, freelance edits with no finding id, ignored severity order, invented completeness gains, broke citations on rename, self-mirrored the prompt. Stop that. Read `spec/25-app-audit/01-index.md` and the single `02-<slug>.md` report, consume findings in strict severity order, edit precisely inside the 21 app folder, quote before / after, state rubric-based completeness deltas, update cross-file citations, ship {{n}} steps, stop. Going deep IS the job.

---

Step count for this run:
