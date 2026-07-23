# Fixture Catalog

All fixtures live under `tests/fixtures/macros/`.

| File | Purpose |
|---|---|
| `macro-definitions/audit-basic.json` | minimal valid MacroDefinition (3 steps) |
| `macro-definitions/audit-with-loop.json` | includes loop-if step pointing back |
| `macro-definitions/invalid-step-kind.json` | StepKindId=99 — schema validator must reject |
| `macro-definitions/invalid-version.json` | Version="1.0" — pattern fail |
| `info-json/valid-with-variables.json` | declares 3 vars (string, integer, sensitive) |
| `info-json/invalid-name-pattern.json` | variable Name="lowercase" → reject |
| `run-states/in-flight-idempotent.json` | for SW-restart rehydration test |
| `run-states/in-flight-audit.json` | for non-idempotent abort test |
| `audit-outputs/empty-findings.json` | Score=100, Findings=[] |
| `audit-outputs/mixed-severities.json` | one of each Critical/High/Medium/Low |
| `prompts/audit-spec.md` | template with `{{ TargetFolder }}` and `{{ Depth }}` |
| `prompts/sensitive-curl.md` | template with `{{ ApiToken }}` |
| `events/full-happy-run.jsonl` | 14-event ground-truth stream |
| `events/aborted-loop.jsonl` | ends with RunAborted reason=LoopBudgetExceeded |

## Generation rule

Fixtures are hand-authored, not auto-generated. Each fixture file has a 1-line header comment `// fixture: <purpose>`.

## Snapshot policy

Unit tests MAY snapshot interpolated output (`*.snap`); component tests MUST NOT snapshot whole React trees (use targeted `getByRole`).
