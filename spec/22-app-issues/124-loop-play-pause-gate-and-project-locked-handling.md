# Issue 124 — Loop Run-State Gate, Queue Flip & Project-Locked Handling

**Version target:** v3.37.0
**Owner modules:** `standalone-scripts/macro-controller/src/ws-adjacent.ts`, `ws-move.ts`, new `loop-run-state/`, new `project-lock/`

---

## 1. Problem

Three related gaps when the macro loop moves between workspaces:

1. **No run-state gate before moving.** Adjacent move fires while a Lovable run is still streaming. Half-finished runs get abandoned.
2. **`project locked` errors are silently lost.** Destination returns "project is locked", error is logged but never persisted, so the next move repeats the same failure.
3. **Queue is not paused across moves.** New queued prompts can fire on the source workspace mid-move, and the destination queue never auto-resumes.

> **Hard constraint:** we **MUST NOT** click the in-composer STOP button. Stopping an in-flight prompt would lose the user's work. We only **observe** STOP visibility; we never click it. Control across moves is exclusively via the **Queue Pause / Queue Play (Resume)** buttons.

## 2. Behaviour contract

### 2.1 Run-state detection (read-only)

A prompt is **running** if EITHER of these is true:

- The **STOP icon** (`STOP_ICON_XPATH`) is present inside the composer submit button — SVG path starts with `M20.75 17` (rounded square).
- The **Submit button** itself (`SUBMIT_BUTTON_XPATH`) is **not visible / not present** in the DOM (the composer hides it while streaming). Per the user: *"submit visibility shows that if any prompt is running, or stop button also means that prompts are running."*

A prompt is **idle** only when the submit button is present AND its inner icon is the **Send/Run arrow** (SVG path starts with `M11 19V7.415`) — STOP icon absent.

```
isRunActive = exists(STOP_ICON_XPATH)  ||  !exists(SUBMIT_BUTTON_XPATH)
isRunIdle   = !isRunActive
```

### 2.2 Pre-move gate (move-down / move-up / move-to)

Before issuing the move:

1. Read `isRunIdle()`. If idle → proceed to §2.3.
2. If running → **do not move**. Toast `"Waiting for current prompt to finish…"` and poll every `RUN_GATE_POLL_MS = 1000` ms up to `RUN_GATE_TIMEOUT_MS = 120_000` ms until `isRunIdle()`.
3. On timeout → log + toast `"Prompt still active after 2 min — move cancelled"`. No retry, no backoff (`mem://constraints/no-retry-policy`).

**Never** click STOP. Only observe.

### 2.3 Queue flip across moves

Once §2.2 passes:

1. Click **Queue Pause** (`QUEUE_PAUSE_BUTTON_XPATH`, `aria-label="Pause queue"`) on the **source** workspace, only if it is present (queue may already be paused — pause button is hidden then).
2. Perform `moveToWorkspace(destinationId)`.
3. After destination URL loads, wait up to 15s for the **Queue Play (Resume)** button (`QUEUE_PLAY_BUTTON_XPATH`, `aria-label="Resume queue"`). Click it once.
4. Log `LoopRun.queueFlip ws=<dest> outcome=ok|pause-missing|resume-missing`.

If Resume is missing after 15s → no retry, log and continue (queue may already be live on the destination, which is acceptable).

### 2.4 Project-locked detection & persistence

When the move API or post-move project-load surfaces "project locked":

1. Detect via response body (`error`/`message` contains `"project is locked"` or `"project_locked"`, or HTTP **423**) OR optional DOM banner (`LOCKED_BANNER_XPATH`).
2. Persist into SQLite table `LoopProjectLockEvent`:
   - `EventId INTEGER PK AUTOINCREMENT`
   - `WorkspaceId TEXT NOT NULL`
   - `ProjectId TEXT NOT NULL`
   - `DetectedAtMs INTEGER NOT NULL`
   - `Reason TEXT NOT NULL` — short code: `api-423`, `api-body-locked`, `dom-banner`
   - `ReasonDetail TEXT NOT NULL` — full server message or banner text
3. Re-enter §2.2 gate on the destination workspace until `isRunIdle()`, then re-attempt §2.3 queue resume. Do **not** click STOP.

## 3. Selectors (all provided)

All four XPaths/IDs are confirmed. Copy this block verbatim into `loop-run-state/selectors.ts` and `project-lock/selectors.ts`.

```ts
// ─── Composer submit button (read-only observation) ──────────────────────────
// Sample HTML (idle / Send-arrow icon visible):
//   <button type="submit" id="chatinput-send-message-button" disabled ...>
//     <span data-button-content="true" ...>
//       <svg ...><path d="M11 19V7.415l-3.293 3.293a1 1 0 1 1-1.414-1.414..."/></svg>
//       <span class="sr-only">Send message</span>
//     </span>
//   </button>
//
// Sample HTML (running / STOP square icon visible at span[7]):
//   <span data-button-content="true" class="...">
//     <svg ... class="...text-muted-foreground"><path d="M20.75 17A3.75 3.75 0 0 1 17 20.75H7..."/></svg>
//   </span>
export const SUBMIT_BUTTON_ID    = 'chatinput-send-message-button';
export const SUBMIT_BUTTON_XPATH = '/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]';
export const STOP_ICON_XPATH     = '/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]/span[7]';
export const STOP_ICON_SVG_PATH_PREFIX = 'M20.75 17'; // identifies the square STOP glyph
export const SEND_ICON_SVG_PATH_PREFIX = 'M11 19V7.415'; // identifies the up-arrow Send glyph

// ─── Queue Pause / Resume buttons (the ONLY controls we click) ───────────────
// Sample HTML (Pause queue):
//   <button type="button" aria-label="Pause queue" class="flex h-8 w-8 ...">
//     <svg ...><path d="M9.75 18a2.75 2.75 0 1 1-5.5 0V6a2.75 2.75..."/></svg>
//   </button>
//
// Sample HTML (Resume queue / Play):
//   <button type="button" aria-label="Resume queue" class="flex h-8 w-8 ...">
//     <svg ...><path d="M5.25 6.061c0-2.984 3.316-4.772 5.81-3.133..."/></svg>
//   </button>
export const QUEUE_PAUSE_BUTTON_XPATH = '/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/div[1]/div[2]/div/div[1]/div/button[1]';
export const QUEUE_PLAY_BUTTON_XPATH  = '/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/div[1]/div[2]/div/div[1]/div/button[2]';
export const QUEUE_PAUSE_ARIA_LABEL   = 'Pause queue';
export const QUEUE_RESUME_ARIA_LABEL  = 'Resume queue';

// ─── Project-locked DOM banner (optional fallback; API check is primary) ─────
export const LOCKED_BANNER_XPATH: string | null = null; // not provided — set when discovered
```

## 4. New modules

```
standalone-scripts/macro-controller/src/
  loop-run-state/
    selectors.ts        # constants above
    index.ts            # public API: isRunIdle(), isRunActive(), waitForRunIdle()
    poll.ts             # pollUntil helper (re-export from existing poll-util)
  queue-control/
    selectors.ts        # re-exports QUEUE_* constants
    index.ts            # public API: pauseQueue(), resumeQueue(), isQueuePauseVisible(), isQueueResumeVisible()
  project-lock/
    detector.ts         # detectProjectLocked(response, dom) → ProjectLockEvent | null
    store.ts            # SQLite upsert/list for LoopProjectLockEvent
    types.ts            # ProjectLockEvent, ProjectLockReason
```

**API surface (must not click STOP anywhere):**

```ts
// loop-run-state/index.ts
export function isRunActive(): boolean;     // STOP icon present OR submit button missing
export function isRunIdle(): boolean;       // !isRunActive()
export function waitForRunIdle(opts?: { timeoutMs?: number; pollMs?: number }): Promise<void>;

// queue-control/index.ts
export function pauseQueue(): { clicked: boolean; reason: 'ok' | 'pause-missing' };
export function resumeQueue(): { clicked: boolean; reason: 'ok' | 'resume-missing' };
```

## 5. Wiring

- `ws-adjacent.ts → moveToAdjacentWorkspace()`:
  1. `await waitForRunIdle()` BEFORE any move call.
  2. `pauseQueue()` on the source workspace.
  3. Call existing `moveToWorkspace(destinationId)`.
  4. After destination loads, poll for Resume button → `resumeQueue()`.
- `ws-move.ts → executeMove()` error path: run `detectProjectLocked`; on hit, `LoopProjectLockEvent.persist()` then re-enter the §2.2 gate.

## 6. Feature flag

`Loop.RunStateGate.Enabled` (default `false` until v3.37.0 ships). When OFF, modules are inert (functions return `isRunIdle = true` to preserve current behaviour).

## 7. Tests (ship with feature)

- `loop-run-state/__tests__/run-state.test.ts` — `isRunActive` true when STOP svg present; true when submit button absent; false when only send-arrow svg present. `waitForRunIdle` resolves immediately when idle, polls until STOP disappears, rejects on timeout.
- `queue-control/__tests__/queue-control.test.ts` — `pauseQueue` clicks button[1] when present; returns `pause-missing` otherwise. `resumeQueue` clicks button[2] when present; returns `resume-missing` otherwise. Neither ever clicks the composer STOP/Submit button.
- `project-lock/__tests__/detector.test.ts` — recognises HTTP 423, body `project_locked`, body `"project is locked"`, optional DOM banner; null otherwise.
- `project-lock/__tests__/store.test.ts` — persist + list ordering; idempotent on duplicate event within 1s.
- `ws-adjacent.integration.test.ts` — move-down while STOP visible → blocks → polls → pauses queue → moves → resumes queue once Resume button appears. Locked response is persisted and triggers re-wait. **Asserts STOP button is never clicked** via spy.

## 8. Acceptance

- [ ] Move-down while a prompt is streaming waits and only moves after the prompt is idle.
- [ ] STOP button is never clicked by extension code (covered by spy in integration test).
- [ ] Queue is paused on source before move, resumed on destination within 15s.
- [ ] A `project is locked` response writes exactly one `LoopProjectLockEvent` row and does not silently swallow.
- [ ] All test files pass.
- [ ] Feature flag `Loop.RunStateGate.Enabled` gates activation; default OFF until v3.37.0.

---

## 5-step task plan

1. **Spec + selectors** *(this turn)*: rewritten with all four selectors + sample HTML in `selectors.ts` block, queue-flip model, STOP-no-click constraint.
2. **`loop-run-state` + `queue-control` modules + unit tests**: implement `selectors.ts`, `isRunActive/isRunIdle/waitForRunIdle`, `pauseQueue/resumeQueue`. Tests assert STOP is never clicked.
3. **`project-lock` module + tests**: detector (API + optional DOM), SQLite `LoopProjectLockEvent` store.
4. **Wire into `ws-adjacent` + `ws-move`** behind `Loop.RunStateGate.Enabled` flag; integration test with spy proving STOP is never clicked.
5. **Enable flag + version bump v3.37.0**: flip default ON, bump manifest/constants, changelog entry.
