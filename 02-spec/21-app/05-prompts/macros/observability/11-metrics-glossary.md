# Metrics Glossary

Emitted at one of three cadences: `event` (every occurrence), `step` (per completed step), `run` (at RunCompleted/Aborted).

| Metric | Type | Cadence | Labels | Definition |
|---|---|---|---|---|
| `macro.run.started` | counter | event | `slug` | RunStarted emitted |
| `macro.run.completed` | counter | run | `slug`, `final_score_bucket` | RunCompleted emitted |
| `macro.run.aborted` | counter | run | `slug`, `reason` | RunAborted emitted |
| `macro.run.duration_ms` | histogram | run | `slug`, `status` | wall time start→end |
| `macro.step.duration_ms` | histogram | step | `slug`, `step_kind_id` | per step |
| `macro.step.failed` | counter | step | `slug`, `step_kind_id`, `reason` | StepFailed |
| `macro.loop.iteration` | counter | event | `slug` | LoopIterated emitted |
| `macro.score.parsed` | gauge | event | `slug` | latest score value |
| `macro.variable.unresolved` | counter | event | `name` | MissingVariable / UndeclaredVariable |
| `macro.watchdog.timeout` | counter | event | `slug`, `scope` (`step`/`run`) | watchdog fired |
| `macro.audit.findings` | gauge | event | `slug`, `severity` | count per severity at write |

## Buckets

- `final_score_bucket`: `0-50`, `51-79`, `80-99`, `100`.
- Histograms use `1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 30000, 60000, 300000` ms.

## Sink

Metrics are emitted into the same `_log.jsonl` with `event="Metric"` and a `metric` payload. No remote sink (no Supabase, no external).
