# Macro-Prompts — Starter Pack
**Created:** 2026-06-02
Five macro-prompts ship with the extension as the default seed. They are the minimum surface area required for the reference macro `001-spec-tighten-cycle` (Part A.5 of the plan) to run end-to-end.
| # | Slug              | Title                | Purpose                                                                                  | Required Variables                       | Writes To                          | Emits Score |
|---|-------------------|----------------------|------------------------------------------------------------------------------------------|------------------------------------------|------------------------------------|-------------|
| 1 | `audit-spec`      | Audit Spec Folder    | Walk a spec subtree to `Depth`; emit findings + 0–100 score for tightness.               | `TargetFolder`, `Depth`, `RunId`         | `spec/audit/{{ RunId }}/`          | yes         |
| 2 | `gap-analysis`    | Gap Analysis Writer  | Convert the previous audit findings into a prioritised `01-gap-analysis.md` narrative.    | `RunId`                                  | `spec/audit/{{ RunId }}/`          | no          |
| 3 | `fix-from-audit`  | Fix From Audit       | Instruct the agent to address findings in `spec/audit/{{ RunId }}/`; one fix per `next`.  | `RunId`                                  | (spec edits via human review)      | no          |
| 4 | `final-score`     | Final Score          | Re-audit after fixes; produce `99-final-report.md` with score line.                       | `TargetFolder`, `Depth`, `RunId`         | `spec/audit/{{ RunId }}/`          | yes         |
| 5 | `score-extract`   | Score Extract        | Parse the latest assistant message for a `Score: N/100` line; expose `LastScore` to the engine. | `RunId`                              | (none — pure extraction)           | yes         |
## On-disk locations
```
standalone-scripts/macro-prompts/
├── 001-audit-spec/
├── 002-gap-analysis/
├── 003-fix-from-audit/
├── 004-final-score/
└── 005-score-extract/
```
Each folder follows the contract in `00-folder-structure.md` and `02-info-json-schema.md`.
## Why exactly these five
- `001-spec-tighten-cycle.macro.json` (the reference macro) chains: `audit-spec → gap-analysis → fix-from-audit (next-loop) → final-score → score-extract → loop-if`.
- Removing any of the five breaks the reference chain; adding more is fine but they ship as optional.
- Each prompt is genuinely **template-heavy** (requires `RunId` at minimum), justifying placement under `macro-prompts/` rather than `prompts/` (per `README.md` decision matrix).
## Score-extract is special
`score-extract` does not call the model — it's a deterministic post-step the engine evaluates against the previous assistant response using the canonical regex from `spec/21-app/05-prompts/macros/04-loop-and-score.md`:
```
/^\s*Score\s*:\s*(\d{1,3})\s*\/\s*100\s*$/im
```
On match: writes `LastScore` into run context (`variables/05-built-in-context.md`).
On miss: `Reason="ScoreParseFailed"` with full `VariableContext[]` and the last 500 chars of the inspected response (truncated unless verbose).
## Test fixtures
Each starter ships with a fixture pair in `scripts/__tests__/fixtures/macro-prompts/<slug>/{input.json, expected.md}` consumed by the aggregator integration test (`mem://preferences/test-with-features`).
