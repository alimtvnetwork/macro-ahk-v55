# 13 — State Machine

```
        ┌──────────┐
        │   Idle   │
        └────┬─────┘
             │ requestCredits(workspace)
             ▼
        ┌──────────┐  inline data present
        │ Resolve  │────────────────────►  InlineHit (no fetch)
        └────┬─────┘
             │ needs API
             ▼
        ┌──────────┐  fresh cache hit
        │  Cache?  │────────────────────►  ApiCacheHit
        └────┬─────┘
             │ stale / miss
             ▼
        ┌──────────┐  in-flight?
        │ Fetching │────────────────────►  join existing promise
        └────┬─────┘
             │
       ┌─────┴─────┬─────────┬─────────┐
       ▼           ▼         ▼         ▼
     ApiHit    Timeout   HttpError  AuthError
```

Every terminal state writes to cache (positive or negative) so the UI can
render immediately on the next tick.
