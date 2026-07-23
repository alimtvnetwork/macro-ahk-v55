# Failure Walkthrough (Loop Budget Exceeded)

Demonstrates fail-fast behavior when an audit never reaches `TargetScore`.

## Macro

```json
{
  "Slug": "stubborn-audit", "Version": "1.0.0", "Title": "Stubborn Audit",
  "TargetScore": 100, "MaxLoops": 3,
  "Steps": [
    { "StepKindId": 3, "PromptSlug": "audit-spec" },
    { "StepKindId": 4, "PromptSlug": "fix-from-audit" },
    { "StepKindId": 5, "PromptSlug": "final-audit" },
    { "StepKindId": 6, "GotoStep": 1 }
  ]
}
```

## Timeline

| Iter | Step 0 audit | Step 1 fix | Step 2 final-audit Score | loop-if |
|---:|---|---|---:|---|
| 0 | runs | runs | 60 | jumps to step 1 |
| 1 | — | runs | 75 | jumps to step 1 |
| 2 | — | runs | 88 | jumps to step 1 |
| 3 | — | runs | 91 | **LoopBudgetExceeded** (4th iteration would exceed cap=3) |

## Final events

```
LoopIterated { Iteration=3, RemainingBudget=0 }
RunAborted   { Reason="LoopBudgetExceeded", ReasonDetail="loops=4 cap=3" }
```

## UI surface

`E-07` toast (assertive): "Macro stopped: loop limit (3) reached."

## Artifacts retained

```
spec/audit/<RunId>/
├── 01-gap-analysis.md      (overwritten 4×; holds last gap analysis)
├── 02-findings.json        (overwritten 4×; holds last findings)
├── 99-final-report.md      (overwritten 3×; holds Score 91 report)
└── _log.jsonl              (all iterations preserved)
```

## How to recover

Author edits the macro to raise `MaxLoops` (≤ 20) or improves the fix prompt; re-runs.
