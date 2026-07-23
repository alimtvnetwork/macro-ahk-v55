# Resume After Service-Worker Restart

## Why
Chrome MV3 background SW idles after ~30s and can be killed mid-run. The engine MUST rehydrate without losing in-flight macro state.

## Persisted keys (authoritative)

| Key | Purpose | Updated |
|-----|---------|---------|
| `MacroRun.<RunId>` | full `RunState` snapshot | after every transition |
| `MacroRun.Active.<TabId>` | pointer to active RunId per tab | on Start / Stop |
| `MacroRun.LastHeartbeatAtKL.<RunId>` | epoch ms (KL) | every 5s while Running |

## Rehydration on SW spin-up
1. `chrome.runtime.onStartup` + module top-level boot both call `rehydrateActiveRuns()`.
2. For each `MacroRun.Active.*` pointer:
   - Load `MacroRun.<RunId>`.
   - Compute `staleness = now - LastHeartbeatAtKL`.
   - If `staleness > MAX_STALE_MS` → transition to `Failed`, `Reason='SwRestartStale'`, emit `RunFailed` to any subscribed panel.
   - Else → resume from current `State` (Running → re-issue current `ExecStep`; Paused → wait for user Resume).
3. Panel reconnect: panel mount calls `engine.getState(runId)` for any active runs and re-subscribes to event stream; missed events are replayed from `spec/audit/<runId>/_log.jsonl` tail.

## Constants
- `MAX_STALE_MS = 90_000` (90 seconds — covers SW idle + user inactivity grace).
- `HEARTBEAT_INTERVAL_MS = 5_000`.

## Guards
- Rehydration runs at most once per SW lifecycle (idempotent via `rehydrated` flag in memory).
- Never rehydrate runs whose tab no longer exists (`chrome.tabs.get` rejects) → `Reason='TabClosed'`.
- Never rehydrate on `isNewTabOrBlankUrl()` tab → `Reason='NewTabGuard'`.

## Failure log
`Reason ∈ { SwRestartStale, TabClosed, NewTabGuard, StateCorrupt }` with `ReasonDetail` = staleness ms + last-known StepIndex.
