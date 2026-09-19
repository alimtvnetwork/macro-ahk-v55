# Watchdog Pseudo-code

```ts
export interface Watchdog {
  run<T>(task: () => Promise<T>, timeoutMs: number): Promise<T>;
  runTotal<T>(task: () => Promise<T>, totalMs: number): Promise<T>;
}

export const watchdog: Watchdog = {
  async run(task, ms) {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new SpecError("WatchdogTimeout", `step exceeded ${ms}ms`)), ms);
    });
    try { return await Promise.race([task(), timeout]); }
    finally { clearTimeout(timer!); }
  },
  async runTotal(task, ms) {
    return this.run(task, ms);  // same shape; runner enforces both
  },
};
```

## Budgets (defaults)

| Scope | Default | Override |
|---|---:|---|
| Per-step (any kind) | 60_000 ms | `MacroDefinition.StepTimeoutMs` |
| `audit` step | 180_000 ms | `Step.TimeoutMs` |
| `next-loop` per iteration | 30_000 ms | `Step.TimeoutMs` |
| Total run | 1_800_000 ms (30 min) | `MacroDefinition.TotalTimeoutMs` |

No retry, no exponential backoff. Single attempt → abort.
