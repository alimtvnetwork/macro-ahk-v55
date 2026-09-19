# Log Format Spec
## File: `spec/audit/<RunId>/_log.jsonl`
One JSON object per line. UTF-8. No trailing comma. Append-only.
```json
{ "at": "2026-06-02T06:30:01.000Z", "level": "info", "event": "StepStarted", "stepIndex": 0, "stepKindId": 1 }
{ "at": "2026-06-02T06:30:04.000Z", "level": "info", "event": "StepCompleted", "stepIndex": 0, "durationMs": 3041 }
{ "at": "2026-06-02T06:30:07.000Z", "level": "error", "event": "StepFailed", "stepIndex": 1, "reason": "WatchdogTimeout", "reasonDetail": "step exceeded 60000ms" }
```
## Required fields on every line
| Field | Type | Notes |
|---|---|---|
| `at` | ISO-8601 string  | mandatory |
| `level` | `"info" \| "warn" \| "error"` | mandatory |
| `event` | string | matches a `MacroEvent.Type` or `"DebugTrace"` |
## Required on every `error` line
| Field | Type | Notes |
|---|---|---|
| `reason` | string | short code from `12-failure-reason-codes.md` |
| `reasonDetail` | string | human, ≤ 500 chars, sensitive masked |
| `selectorAttempts` | array? | mandatory for selector misses; else `null` + reason |
| `variableContext` | array? | mandatory for variable/data failures; else `null` + reason |
## Truncation
When `Project.VerboseLogging === false` (default):
- HTML payloads truncated to 120 chars.
- Text payloads truncated to 240 chars.
- Truncated lines append `"truncated": true`.
When `true`:
- Full payloads preserved. Sensitive values STILL masked.
## Logger
```ts
RiseupAsiaMacroExt.Logger.error("StepFailed", { reason, reasonDetail, selectorAttempts, variableContext });
```
Never `console.log` errors; the logger is the single sink.
