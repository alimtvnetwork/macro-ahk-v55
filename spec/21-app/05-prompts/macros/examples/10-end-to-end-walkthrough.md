# End-to-End Walkthrough (Happy Path)
A single complete run of the canonical "audit-spec-then-fix-until-100" macro.
## 0. Setup
- User opens panel, picks `macro: spec-tighten-cycle`.
- Variable dialog asks for `TargetFolder` (default `spec/`) and `TargetScore` (default 100).
- User clicks Submit. Background runner receives `StartMacro`.
## 1. Runner emits
```
RunStarted { RunId="9f3...", Slug="spec-tighten-cycle", At="2026-06-02T06:30:00.000Z" }
```
## 2. Step 0 — audit (StepKindId=3)
- Resolved template injected into chatbox.
- AI replies with audit text + `Score: 72 / 100`.
- audit-writer writes:
  - `spec/audit/9f3.../01-gap-analysis.md`
  - `spec/audit/9f3.../02-findings.json`
- Score parser → 72.
Events:
```
StepStarted   { StepIndex=0, StepKindId=3 }
ScoreParsed   { Score=72 }
StepCompleted { StepIndex=0, DurationMs=42103 }
```
## 3. Step 1 — fix-from-audit (StepKindId=4)
- Prompt: "Fix issues in `spec/audit/9f3.../02-findings.json`."
- Followed by `next-loop Count=8`.
- 8 `next` keywords sent; AI applies fixes between each.
## 4. Step 2 — final-audit (StepKindId=5)
- Re-runs audit prompt. AI replies `Score: 100 / 100`.
- audit-writer writes `spec/audit/9f3.../99-final-report.md`.
## 5. Step 3 — loop-if (StepKindId=6)
- `Score (100) >= TargetScore (100)` → no jump.
- Falls through.
## 6. Runner emits
```
RunCompleted { FinalScore=100 }
```
## 7. Artifacts
```
spec/audit/9f3.../
├── 01-gap-analysis.md
├── 02-findings.json
├── 99-final-report.md
└── _log.jsonl   (38 lines)
```
Total wall time: ~6 minutes. Loop iterations: 0 (first audit passed).
