# Macros — Starter Macros
**Created:** 2026-06-02
Three macros ship with the extension as built-in starters. They prove the full feature surface (all 8 `Kind` step types are exercised across the three) and give users runnable examples to clone.
## The three starters
| #   | Slug                  | Title                  | Purpose                                                                                       | Step Kinds exercised                                            | TargetScore / MaxLoops |
|-----|-----------------------|------------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------|------------------------|
| 001 | `spec-tighten-cycle`  | Spec Tighten Cycle     | Audit a spec subtree → write gap analysis → fix → re-audit → loop until score ≥ target.       | `audit`, `prompt`, `fix-from-audit`, `next-loop`, `final-audit`, `loop-if` | 90 / 3                 |
| 002 | `review-and-fix-loop` | Review And Fix Loop    | Lightweight: review last assistant message → fix one finding → loop a fixed number of times.  | `prompt`, `next-loop`, `set-var`, `notify`                       | n/a / 5                |
| 003 | `weekly-spec-audit`   | Weekly Spec Audit      | Run a full audit pass and emit a single final report (no fix loop). Schedulable trigger.       | `set-var`, `audit`, `prompt`, `final-audit`, `notify`           | n/a / 1                |
## On-disk locations
```
standalone-scripts/macros/
├── 001-spec-tighten-cycle.macro.json
├── 002-review-and-fix-loop.macro.json
└── 003-weekly-spec-audit.macro.json
```
## Why exactly three
- **001** is the canonical end-to-end example from Part A of the plan (Block 1). Required to validate the engine's loop + score logic.
- **002** demonstrates the **no-score** path: macros that loop a fixed `Count` and never call `final-audit` or `loop-if`. Proves the engine supports both control models.
- **003** demonstrates a **single-pass** macro: no loop, no fix step, just audit → report. Justifies the future "scheduled trigger" workstream without committing to it now.
Together they exercise **every** `Kind` defined in `macro.schema.json` at least once, satisfying the schema coverage requirement.
## Identification rules
- All three reside in the reserved built-in numeric band `001`–`099` (`01-naming.md`).
- All three have `IsUserAuthored: false` (omitted; defaults to false) — surfaced as **built-in** in the Macros tab.
- None has `IsExperimental: true`.
- Each carries `Version: "1.0.0"`; bump rules in `macro-prompts/06-versioning.md` apply.
## Reference implementation
`001-spec-tighten-cycle.macro.json` is authored in full in Task 40 and serves as the schema-conformance reference for the other two and for any user-authored macro. Tasks 39 (this doc) and 40 (the file) are the only two starter-macro deliverables in Block 4 — `002` and `003` are stubbed in Block 8 (Worked Examples) where they pair with their test fixtures.
## Test coverage (`mem://preferences/test-with-features`)
`scripts/__tests__/starter-macros.test.mjs`:
- All starter `.macro.json` files validate against `schemas/macro.schema.json`.
- The union of `Steps[].Kind` across the three covers all 8 documented kinds.
- Every `Slug` referenced by `prompt | audit | fix-from-audit | final-audit` steps exists in the starter macro-prompts pack (`spec/21-app/05-prompts/macro-prompts/07-starter-pack.md`).
- `loop-if.GotoStep` values resolve to a strictly-earlier step index.
