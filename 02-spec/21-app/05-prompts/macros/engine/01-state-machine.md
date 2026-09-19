# State Machine

## States
`Idle` · `Running` · `Paused` · `Looping` · `Done` · `Failed`

## Transitions

| From | Event | To | Side effects |
|------|-------|----|--------------|
| Idle | StartMacro | Running | Persist RunState; emit RunStarted |
| Running | StepCompleted (more steps) | Running | Advance StepIndex |
| Running | StepCompleted (last step, no LoopIf match) | Done | Write final audit; emit RunFinished |
| Running | StepCompleted (LoopIf matches, LoopsRemaining > 0) | Looping | Decrement LoopsRemaining |
| Running | StepCompleted (LoopIf matches, LoopsRemaining == 0) | Done | Reason='MaxLoopsReached' |
| Running | Pause | Paused | Persist; emit RunPaused |
| Running | StepFailed | Failed | Write failure log; emit RunFailed |
| Running | Watchdog timeout | Failed | Reason='Timeout' |
| Running | Stop | Failed | Reason='UserStopped' |
| Paused | Resume | Running | Re-emit current StepStarted |
| Paused | Stop | Failed | Reason='UserStopped' |
| Looping | (auto) | Running | Reset StepIndex to LoopAnchor; emit LoopEntered |
| Done / Failed | (any) | — | terminal; new run requires fresh RunId |

## Invariants
- Exactly one `Running` or `Paused` run per tab (see `07-concurrency.md`).
- Every transition is persisted **before** the side effect fires (crash-safe).
- `LoopsRemaining` starts at `MaxLoops` (capped at 25 hard ceiling).
- `LoopAnchor` = StepIndex marked `IsLoopAnchor: true`, or 0 if none.

## Persistence keys (chrome.storage.local)

| Key | Shape |
|-----|-------|
| `MacroRun.<RunId>` | `RunState` (current state, StepIndex, LoopsRemaining, Variables, StartedAtKL) |
| `MacroRun.Active.<TabId>` | `RunId` pointer |
| `MacroRun.History` | ring of last 25 RunIds (for diagnostics) |

## Failure transitions
Every `Failed` transition writes a failure log via mandatory shape (`Reason`, `ReasonDetail`, `VariableContext[]`, `SelectorAttempts[]`) before emitting `RunFailed`.
