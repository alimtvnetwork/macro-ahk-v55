# Failure Reason Codes

Closed enum. Every failure log MUST use one of these.

| Code | When | Layer | ReasonDetail shape |
|---|---|---|---|
| `MissingVariable` | required var unresolved | interpolator | `Name=<n>` |
| `UndeclaredVariable` | `{{ X }}` not in info.json | interpolator | `Name=<n> slug=<slug>` |
| `VarTypeMismatch` | coercion failed | interpolator | `<Name>=<Type>` |
| `VarOutOfRange` | Min/Max violation | interpolator | `<Name>=<Value> min=<m> max=<M>` |
| `VarEnumMismatch` | not in Values list | interpolator | `<Name>=<Value> values=[…]` |
| `VarPathUnsafe` | path-typed unsafe value | interpolator | `<Name>=<Path>` |
| `VarTooLarge` | exceeds 64 KB / 1 MB total | interpolator | `<Name> bytes=<n>` |
| `MalformedToken` | `{{` with bad inner | interpolator | `near "<excerpt>"` |
| `WatchdogTimeout` | step or run exceeded budget | watchdog | `scope=<step/run> ms=<n>` |
| `LoopBudgetExceeded` | loop-if past cap | runner | `loops=<n> cap=<c>` |
| `TabClosed` | target tab vanished | injector | `tabId=<n>` |
| `TabBusy` | another macro on tab | runner | `runId=<other>` |
| `NewTabGuard` | blank/new-tab URL | injector | `url=<u>` |
| `ClipboardBlocked` | write denied | injector | `gestureRequired=true` |
| `InfoJsonInvalid` | schema mismatch | loader | `slug=<s> path=<p>` |
| `StorageQuota` | chrome.storage full | storage | `key=<k>` |
| `SwRestartedNonIdempotent` | non-idempotent step interrupted | runner | `step=<n> kind=<k>` |
| `UnknownAuditSchemaVersion` | unsupported version on read | audit-writer | `v=<n>` |
| `JsThrew` | JsInline (kind 4) threw | injector | `<message>` |
| `UnknownMessageType` | bus received unknown Type | message-bus | `Type=<t>` |

Add a new code → propose in `99-spec-issues/`, update this table, bump `READINESS-SCORE` evidence count.
