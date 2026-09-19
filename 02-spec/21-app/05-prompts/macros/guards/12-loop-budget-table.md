# Loop Budget Table

Authoritative bounds for every loop-shaped construct.

| Construct | Default | Hard cap | Source | Abort reason |
|---|---:|---:|---|---|
| `MacroDefinition.MaxLoops` (loop-if) | 5 | **20** | macro author | `LoopBudgetExceeded` |
| `next-loop.Count` | required | 200 | step | `LoopBudgetExceeded` |
| Step retry | 0 | **0** (no retry) | constant | n/a (fail-fast) |
| Per-step watchdog | 60_000 ms | 300_000 ms | runtime defaults | `WatchdogTimeout` |
| Total run watchdog | 1_800_000 ms | 3_600_000 ms | runtime defaults | `WatchdogTimeout` |
| Storage rows (RunState LRU) | 50 | 200 | storage layer | prune oldest |
| Event ring buffer | 1_000 | 5_000 | panel | drop oldest |

## Enforcement points

- `runner.ts` increments `LoopIteration` before deciding to jump; check `>= MaxLoops` aborts.
- `next-loop` decrements `Count`; check `<= 0` advances `StepIndex`.
- `watchdog.run()` races task vs `setTimeout(ms)`.

## No backoff

Per `mem://constraints/no-retry-policy`, no exponential backoff is permitted anywhere. Sequential single attempts; on failure → abort + emit `RunAborted`.
