# {{n}} Number of Steps, Improve Recent Work From Audit, maximum enforcement

## RULE 0, MUST, NON-NEGOTIABLE, scope + paths

1. This turn improves the **recent work artifacts** using the findings produced by the recent-work audit. Audit source folder: `.lovable/audits/<NN>-<work-slug>/`, where `<NN>` is a two-digit zero-padded sequence starting at `01` and `<work-slug>` is the slug the audit froze. Resolve by listing `.lovable/audits/NN-*` folders and picking the one with the highest `<NN>` (ties broken by most recent mtime). If the user names a specific `<NN>-<work-slug>`, use that instead. If zero matching folders exist or the chosen folder is empty, STOP and file to ambiguity. State the resolved `<NN>-<work-slug>` at the top of the reply.
2. Read `.lovable/audits/<NN>-<work-slug>/01-index.md` first, then the single audit report `02-<work-slug>.md` referenced there. The report's `## 1. Inventory` section defines the artifact set. Findings are the input. There are no "phase files": if legacy `03-phase-*.md` exist, ignore them. If any Critical / High finding lacks a concrete `improvement` field, STOP and file to ambiguity.

3. Writes allowed: only the artifact paths listed in the audit inventory (edit / regenerate in place). No other paths. Do NOT edit audit files. Do NOT self-mirror this prompt.
4. No variables besides `{{n}}` (step count, provided by the user at the bottom of the prompt).

## RULE 0, MUST, NON-NEGOTIABLE, cadence + goal

5. Execute **exactly {{n}} improvement steps this turn**, no more, no less. If fewer than {{n}} findings remain actionable, STOP at the actionable count and state why.
6. **Goal, non-negotiable: raise every touched artifact toward the 90+ confidence band** using the audit's confidence rubric. Every step must be tied to at least one `REC-###` finding id. No freelance edits.
7. Order: `Critical` findings first, then `High`, then `Medium`, then `Low`. Within the same severity, order by artifact id ascending for determinism.

## Hard rules

- Every step consumes one or more audit findings. Cite the `REC-###` ids in the step header.
- Every edit shows the exact artifact touched (`path` or id) and quotes / describes the before / after change appropriate to the artifact kind.
- Every step ends by explicitly stating the confidence delta claimed (`from X% to Y%`) using the audit's rubric bands (0-24, 25-49, 50-74, 75-89, 90-100).
- Kind-specific verification MUST run after the edit:
  - **code**: `bun run build` + `tsgo` must pass. Report exit codes.
  - **spec**: PascalCase / joined-table / Seedable-Config / boolean-naming checks pass.
  - **plan**: file exists at `.lovable/plans/pending/` (or moved to `completed/`), RULE 0 header intact, remaining tasks list intact.
  - **migration**: `CREATE TABLE public.*` still followed by `GRANT` and RLS in the same file.
  - **image**: file exists, aspect ratio matches usage, alt text present, OCR passes if the image contains text.
- Do NOT touch artifacts outside the audit inventory. Do NOT rerun the audit. Do NOT create new plan files unless the audit backlog flagged `needs new plan file? = yes` for the consumed task.
- Lowercase markdown filenames throughout. No em dashes. No en dashes. No off-topic commentary.
- No banned vague words in any produced text: `unclear`, `maybe`, `somewhere`, `generally`, `consider`, `could be improved`.
- Preserve references from other artifacts (imports, spec citations, plan links). If a rename is required, update all citing artifacts in the same step and note the rename in the step header.

## Working stance (past sins, do not repeat)

Past improvement turns were stupid fuck sloppy: closed findings without editing the artifact, patched code without running the build, regenerated images without checking aspect ratio, edited a spec and broke the plan that cited it, cherry-picked `Low` findings to look productive while `Critical` sat open, claimed confidence gains that did not match the rubric, self-mirrored the prompt. Stop that. Consume findings in severity order, edit precisely, verify per kind, cite ids, quote before / after, state the rubric-based delta, stop.

## Step plan

Deliver **exactly {{n}} steps** in one turn. For each step:

1. Read the audit finding rows to consume in this step.
2. Open / regenerate the target artifact(s).
3. Apply the improvement described in the finding row.
4. Run the kind-specific verification.
5. Update cross-artifact references on any rename.
6. State the confidence delta.

## Per-step output shape

````
## Step {i} of {{n}}, {short title}

Consumed findings: REC-{aaa}, REC-{bbb} (severity: Critical | High | Medium | Low)
Artifacts touched: {id + path list}

### Change {j}
Artifact: {id} @ {path}
Kind: {code | spec | plan | migration | image | config | doc | other}

Before:
{quoted snippet, hash, or description of prior state}

After:
{quoted snippet, hash, or description of new state}

Reason: {one line, cite the finding id + rubric band}

### Verification
- {command run and exit code, or explicit check performed, per the kind rules}

### Confidence delta
- {artifact id}: from {X}% to {Y}%  (rubric band: {old band} → {new band})

### Cross-artifact cleanup
- {list of artifacts updated for renames / import fixes / citation fixes, or "none"}
````

After all steps, emit a single summary block:

````
## Summary

Steps executed: {{n}}
Findings consumed: {count} (Critical: {a}, High: {b}, Medium: {c}, Low: {d})
Artifacts touched: {count}
Aggregate confidence across touched artifacts (criticality-weighted mean): from {X}% to {Y}%
Blind-AI ship risk: {old} → {new}
Remaining actionable findings: {count}
Next likely batch (top three by severity):
- REC-{id} | {severity} | {artifact} | {gap}
- REC-{id} | ...
- REC-{id} | ...

```
If you have any question and confusion, feel free to ask, and if you are creating tasks for creating multiple tasks, and if it is bigger ones, then do it in a way so that if we say next, you do those remaining tasks. Do you understand? Always add this part at the end of the writing inside the code block. Do you understand? Can you please do that?
```
````

Note: the inner triple-backtick block is **literal template text** to be reproduced verbatim. Do not execute or interpret it.

## Checklist before replying (any unchecked = reply rejected)

- [ ] Audit index and the single `02-<work-slug>.md` report read. Inventory + findings loaded.
- [ ] Exactly {{n}} steps produced (or fewer with a stated reason if actionable findings run out).
- [ ] Every step cites at least one `REC-###` finding id.
- [ ] `Critical` consumed before `High`, `High` before `Medium`, `Medium` before `Low`.
- [ ] Every change shows artifact id + path + before / after content or hash.
- [ ] Every touched artifact ran its kind-specific verification and passed (or the failure is reported as a new blocker).
- [ ] Every confidence delta uses rubric bands, not vibes.
- [ ] All cross-artifact references updated on renames / import fixes.
- [ ] No artifacts touched outside the audit inventory.
- [ ] No audit files edited.
- [ ] New plan files created only where `needs new plan file? = yes` was flagged in the audit backlog.
- [ ] No banned vague words introduced.
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
Blocking: improve-work from audit <work-slug> (step <i>)

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

Listen, past turns have been sloppy: closed findings without editing the artifact, patched code without running the build, regenerated images without checking dimensions, edited a spec and broke the citing plan, cherry-picked `Low` while `Critical` rotted, claimed confidence gains that did not match the rubric bands, self-mirrored the prompt, invented ambiguity folders instead of using the canonical plan-mode path. Stop that. Resolve `<work-slug>`, read `.lovable/audits/<NN>-<work-slug>/01-index.md` and the single `02-<work-slug>.md` report, consume findings in strict severity order, edit only the inventory artifacts, verify per kind, quote before / after, state rubric-based confidence deltas, update cross-artifact citations, ship {{n}} steps, stop. Going deep IS the job.

---

Step count for this run:
