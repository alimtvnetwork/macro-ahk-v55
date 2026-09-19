# Recovery Walkthrough (SW Restart Mid-Run)

Demonstrates the runner's rehydration contract.

## Timeline

- `t+0` user clicks Run; macro starts with `RunId=ab12...`.
- `t+2s` Step 0 (audit) begins.
- `t+10s` Chrome suspends the service worker (idle eviction).
- `t+11s` Background message arrives → SW wakes.
- `chrome.runtime.onStartup` fires → state-store enumerates in-flight runs.
- Found: `RunState{ RunId=ab12, Status=Running, StepIndex=0, LastCompletedStepIndex=-1, LastStepKindId=3 }`.
- Step kind 3 (`audit`) is NON-idempotent (writes files). Runner calls `abort(state, "SwRestartedNonIdempotent", "step=0 kind=3")`.

## Recovery event stream (panel sees)

```
RunResumed   { RunId="ab12..." }
RunAborted   { Reason="SwRestartedNonIdempotent", ReasonDetail="step=0 kind=3" }
```

## UI surface

`E-15` inline message: "A non-resumable step was interrupted. Re-run from step 0."

## Alternate path — idempotent step

If the interrupted step had been `prompt` (kind=1, idempotent), runner would have:

```
RunResumed   { RunId="ab12..." }
StepStarted  { StepIndex=0, StepKindId=1 }   ← replay
…
```

The replay is safe because `prompt` just injects text into a chatbox; double-injection at worst sends the same message twice (rare due to SW timing).

## Persistence proof

Every state mutation calls `stateStore.put(state)` BEFORE emitting the event. This guarantees that if SW dies between mutation and emission, the rehydration sees the latest state.
