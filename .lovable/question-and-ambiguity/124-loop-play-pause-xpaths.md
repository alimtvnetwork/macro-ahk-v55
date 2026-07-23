# Ambiguity 124 — Loop Run-State + Queue Selectors — RESOLVED

**Spec:** `spec/22-app-issues/124-loop-play-pause-gate-and-project-locked-handling.md`
**Status:** ✅ Fully resolved 2026-05-30. User supplied all four selectors and clarified the no-STOP-click constraint.

## Resolution

| Constant | XPath | aria-label / id |
|----------|-------|-----------------|
| `SUBMIT_BUTTON_ID` | — | `#chatinput-send-message-button` |
| `SUBMIT_BUTTON_XPATH` | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]` | submit |
| `STOP_ICON_XPATH` | `…/button[3]/span[7]` (SVG path `M20.75 17…`) | — |
| `QUEUE_PAUSE_BUTTON_XPATH` | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/div[1]/div[2]/div/div[1]/div/button[1]` | `Pause queue` |
| `QUEUE_PLAY_BUTTON_XPATH`  | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/div[1]/div[2]/div/div[1]/div/button[2]` | `Resume queue` |
| `LOCKED_BANNER_XPATH` | not provided — optional; API check is sufficient | — |

## Key constraints clarified by user

- **MUST NOT click STOP.** It would discard the in-flight prompt. Observation only.
- Run-active detection: STOP icon present **OR** submit button missing.
- Cross-move control uses **Queue Pause → move → Queue Resume**, not the composer.

All Issue 124 tasks (2-5) unblocked.
