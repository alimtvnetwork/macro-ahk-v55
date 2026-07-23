# 11 — Logging & Error Handling

Per memory `mem://standards/error-logging-via-namespace-logger` and
`mem://standards/error-logging-requirements`:

## Mandatory log fields (every failure)

| Field          | Value                                                          |
|----------------|----------------------------------------------------------------|
| Reason         | short code (`Timeout`, `Http4xx`, `Http5xx`, `AuthError`, `ParseError`, `MissingToken`) |
| ReasonDetail   | human sentence                                                 |
| Path           | full URL                                                       |
| WorkspaceId    | string                                                         |
| Plan           | `Plan` enum value                                              |
| BearerPrefix   | first 12 chars + `…REDACTED`                                   |
| Status         | HTTP status code (or `null` for network errors)                |
| BodyPreview    | first 500 chars of error body (when present)                   |
| TimeoutMs      | configured budget                                              |
| ElapsedMs      | actual elapsed wall time                                       |

## API

All logging goes through `Logger.error('CreditBalanceUpdate.<op>', payload)` —
no `console.error`, no swallowed catches.

## Code-Red examples

```ts
Logger.error('CreditBalanceUpdate.fetch', {
    Reason: 'Timeout',
    ReasonDetail: `Exceeded ${timeoutMs} ms budget for workspace ${workspaceId}`,
    Path: url,
    WorkspaceId: workspaceId,
    Plan: plan,
    BearerPrefix: sanitiseBearer(token),
    Status: null,
    BodyPreview: null,
    TimeoutMs: timeoutMs,
    ElapsedMs: elapsed,
});
```

## Verbose toggle

Full request/response bodies are logged only when `verboseLogging` is ON
(memory `mem://features/verbose-logging-toggle`). Otherwise the standard
500-char body preview applies.
