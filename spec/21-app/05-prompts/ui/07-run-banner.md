# Macros Tab — Run Banner
**Created:** 2026-06-02
The Run Banner is the sticky strip pinned to the bottom of the Prompts panel whenever a macro run is active. It is visible from both tabs (Prompts and Macros) and is the only persistent surface for Pause/Stop while a run is in progress.
## Visibility
- Mounted iff `state.activeRun !== null` AND the panel is open.
- When the panel is closed during a run, the Prompts button's `data-state="macro-running"` (`ui/00-prompts-button.md`) is the only indicator — re-opening the panel re-mounts the banner.
- One banner per tab; per-tab run state is the source of truth (engine architecture spec in Block 7).
## Anatomy (ASCII)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⏵ <Slug>   ▢ step <CurrentStep>/<StepCount>   ⟳ loop <LoopCount>/<MaxLoops>  │
│ <RunId>    score <LastScore>/100                       [ ⏸ ] [ ⏹ ]       │
│ <StatusLine>                                                              │
│ <ErrorPill — only when LastReason ≠ null>                                 │
└──────────────────────────────────────────────────────────────────────────┘
```
## Fields
| Field           | Source (run state — Block 7)                  | Display rule                                                       |
|-----------------|-----------------------------------------------|--------------------------------------------------------------------|
| `Slug`          | `state.activeRun.MacroSlug`                   | Monospace; clickable opens the macro detail strip on Macros tab.   |
| `CurrentStep`   | `state.activeRun.CurrentStepIndex + 1`        | 1-based for display; 0 → "starting".                               |
| `StepCount`     | `state.activeRun.Steps.length`                | Static for the run.                                                |
| `LoopCount`     | `state.activeRun.LoopCount`                   | 0 until the first `loop-if` fires.                                 |
| `MaxLoops`      | `state.activeRun.MaxLoops`                    | From macro definition (1–10 hard cap).                             |
| `RunId`         | `state.activeRun.RunId`                       | `<slug>-<yyyymmdd-HHmmss>` the user's local timezone. Click → copy to clipboard. |
| `LastScore`     | `state.activeRun.LastScore`                   | `—` until first `final-audit` + `score-extract` completes.         |
| `StatusLine`    | derived from `state.activeRun.Status`         | See "Status states" below.                                         |
| `ErrorPill`     | `state.activeRun.LastReason`                  | Hidden when null; otherwise red pill with `Reason` short code.     |
## Status states
`state.activeRun.Status` is a closed enum:
| Status          | StatusLine copy                                     | Tone       |
|-----------------|-----------------------------------------------------|------------|
| `Starting`      | `"Initialising run…"`                               | info       |
| `Running`       | `"Step <CurrentStep>: <Kind>"`                      | info       |
| `WaitingNext`   | `"Awaiting next response (N of M)…"`                | info       |
| `WaitingVars`   | `"Awaiting variable input"`                         | warn       |
| `Paused`        | `"Paused. Press ⏵ to resume."`                      | warn       |
| `Looping`       | `"Looping: score <LastScore> < target <TargetScore>"` | info     |
| `Done`          | `"Done. Final score <LastScore>/100."`              | success    |
| `Failed`        | `"Failed: <Reason>"`                                | error      |
| `Stopped`       | `"Stopped by user."`                                | muted      |
The banner auto-dismisses 8 seconds after `Done` or `Stopped`. `Failed` stays until the user clicks the error pill (which opens the failure-log JSON viewer).
## Controls
| Button       | Visible when                       | Action                                                       |
|--------------|------------------------------------|--------------------------------------------------------------|
| `⏸ Pause`    | Status ∈ {`Running`, `WaitingNext`, `Looping`} | Engine sets Status `Paused`; persists state to `chrome.storage.local` (`MacroRunState.<RunId>`). |
| `⏵ Resume`   | Status === `Paused`                | Engine resumes from the same step index.                     |
| `⏹ Stop`     | Status ≠ `Done` and ≠ `Failed`     | Confirm dialog; on confirm, Status → `Stopped`, engine teardown. |
| `[error pill]` | `LastReason !== null`            | Opens read-only JSON viewer with the full failure-log shape. |
Pause / Resume / Stop are idempotent. Double-clicks collapse to one operation. No retries (`mem://constraints/no-retry-policy`).
## ARIA
- `role="status"` with `aria-live="polite"` for `StatusLine` updates (low-noise — only on actual status change, not every tick).
- Controls are `role="button"` with explicit `aria-label`s (`"Pause macro"`, `"Resume macro"`, `"Stop macro"`).
- Error pill is `role="alert"` only when it first appears, then downgraded to plain text to avoid SR spam.
## Tokens (HSL — `mem://preferences/dark-only-theme`)
```css
--banner-bg:        hsl(220 14% 14%);
--banner-border:    hsl(220 14% 24%);
--banner-fg:        hsl(220 10% 90%);
--banner-muted:     hsl(220 8% 60%);
--banner-info:      hsl(200 92% 56%);
--banner-success:   hsl(160 84% 45%);
--banner-warn:      hsl(38 92% 56%);
--banner-error:     hsl(0 70% 50%);
--banner-shadow:    0 -6px 16px hsl(0 0% 0% / 0.45);
```
## No polling
The banner subscribes to `MACRO_RUN_STATE_CHANGED` events emitted by the engine. No `setInterval` for tick updates. The only timed behaviour is the 8s auto-dismiss after `Done`/`Stopped`, implemented as a single `setTimeout` with explicit clear on unmount and on `pagehide` (`mem://standards/timer-and-observer-teardown`).
## Test coverage (`mem://preferences/test-with-features`)
- Status transitions: `Starting → Running → WaitingNext → Looping → Done` renders the documented copy at each step.
- Pause/Resume round-trip preserves `CurrentStepIndex` and `LoopCount`.
- Stop with confirmation flips Status to `Stopped`; re-opening the panel after teardown shows no banner.
- Failed run shows error pill with the `Reason` short code; clicking it opens the JSON viewer with the full failure-log shape.
- Auto-dismiss timer fires exactly once after `Done`; canceled on user click during the 8s window.
