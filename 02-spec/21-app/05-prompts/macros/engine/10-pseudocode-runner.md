# Runner Pseudo-code

```ts
async function runMacro(def: MacroDefinition, vars: Record<string, JsonValue>, tabId: number) {
  const runId = crypto.randomUUID();
  const state: RunState = {
    RunId: runId, Slug: def.Slug, Status: "Running",
    StepIndex: 0, LastCompletedStepIndex: -1, LoopIteration: 0,
    TabId: tabId, Variables: { ...def.DefaultVariables, ...vars },
    Score: null, Reason: null, ReasonDetail: null,
    StartedAt: nowIso(), UpdatedAt: nowIso(), SchemaVersion: 1,
  };
  await stateStore.put(state);
  emit({ Type: "RunStarted", RunId: runId, At: state.StartedAt, Slug: def.Slug });

  while (state.StepIndex < def.Steps.length) {
    const step = def.Steps[state.StepIndex];
    emit({ Type: "StepStarted", RunId: runId, At: nowIso(), StepIndex: state.StepIndex, StepKindId: step.StepKindId });

    try {
      const t0 = Date.now();
      const result = await watchdog.run(() => execStep(step, state), runtimeDefaults.stepTimeoutMs);
      const dt = Date.now() - t0;

      if (result.Score != null) {
        state.Score = result.Score;
        emit({ Type: "ScoreParsed", RunId: runId, At: nowIso(), Score: result.Score });
      }

      if (step.StepKindId === 6 /* loop-if */) {
        if ((state.Score ?? -1) < (def.TargetScore ?? 100)) {
          if (state.LoopIteration + 1 > Math.min(def.MaxLoops ?? 5, 20)) {
            return abort(state, "LoopBudgetExceeded", `loops=${state.LoopIteration + 1}`);
          }
          state.LoopIteration++;
          state.StepIndex = step.GotoStep!;
          emit({ Type: "LoopIterated", RunId: runId, At: nowIso(), Iteration: state.LoopIteration, RemainingBudget: (def.MaxLoops ?? 5) - state.LoopIteration });
          await stateStore.put(state);
          continue;
        }
      }

      state.LastCompletedStepIndex = state.StepIndex;
      state.StepIndex++;
      state.UpdatedAt = nowIso();
      await stateStore.put(state);
      emit({ Type: "StepCompleted", RunId: runId, At: nowIso(), StepIndex: state.LastCompletedStepIndex, DurationMs: dt });
    } catch (e: CaughtError) {
      return abort(state, classifyReason(e), String(e?.message ?? e));
    }
  }

  state.Status = "Completed";
  await stateStore.put(state);
  emit({ Type: "RunCompleted", RunId: runId, At: nowIso(), FinalScore: state.Score });
}
```

## SW restart rehydration

```ts
chrome.runtime.onStartup.addListener(async () => {
  for (const state of await stateStore.listInFlight()) {
    if (isIdempotent(state.LastStepKindId)) {
      void runMacroFromState(state);   // replay from LastCompletedStepIndex + 1
    } else {
      await abort(state, "SwRestartedNonIdempotent", `step=${state.StepIndex}`);
    }
  }
});
```
