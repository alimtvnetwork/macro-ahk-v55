# SS-03 UI entry-point coverage map

Scope: `plan-task-ui.ts`, `task-next-ui.ts`, `prompt-library-modal.ts`. Maps every exported symbol to the test files that exercise it, and lists the concrete gaps that Plan-22 steps 6..30 must fill.

## 1. plan-task-ui.ts

| Export | Kind | Test file(s) | Cases covered | Gaps |
|---|---|---|---|---|
| `buildPlanTaskPrompt(n)` | pure builder | (indirect via plan-task-ui-db-empty.test.ts fallback assertions) | fallback body used | no direct positive/negative unit: n=0, n<0, n=NaN, n huge, token-parity vs `{{N}}` |
| `renderPlanTaskSubmenu(container, ctx)` | DOM render + click wiring | `ui/__tests__/plan-task-ui-db-empty.test.ts` | DB empty warns+falls back; DB throw -> logError+fallback; paste-fail toast | no positive: DB row present -> body pasted verbatim; no submenu row count / label / aria; no ctx.close() call on click; no double-click debounce |
| `resolvePlanBody` (closure) | private | covered transitively | via renderPlanTaskSubmenu path | intentionally private, no direct test needed |

## 2. task-next-ui.ts

| Export | Test file(s) | Cases covered | Gaps |
|---|---|---|---|
| `taskNextState` (mutable module state) | `__tests__/task-next-ui-teardown.test.ts`, `task-next-queue.test.ts` | cancelled flag toggled by keydown; queue progress tracked | no reset helper documented; no assertion that `queue` starts undefined |
| `loadTaskNextSettings` | none | — | positive load, malformed JSON, missing keys, storage throw |
| `saveTaskNextSettings` | none | — | writes exact shape; storage throw -> logError |
| `findNextTasksPrompt(deps)` | none directly | — | positive DOM find; missing element returns null; multiple candidates picks first |
| `findAddToTasksButton` | none | — | positive/negative DOM lookup |
| `dequeueTaskNextPrompt` | `task-next-queue.test.ts` | prefers persisted splitter queue before legacy fallback (65); fail-fast on read failure (72) | empty queue returns fallback marker; malformed queue row |
| `runTaskNextLoop(deps, count)` | `task-next-queue.test.ts` | count===1 delegates path (39); cancellation (48) | count=0 no-op; count<0 rejected; paste throw -> abort |
| `dispatchTaskNextSubmit` | none | — | positive: dispatches submit event; negative: no button -> false; button disabled -> false |
| `runTaskNextQueue(deps, count)` | `task-next-queue.test.ts` | iterates 0..n-1 with awaited idle gate (43); cancellation inside loop and idle gate (48); fail-fast on paste/submit/timeout (53); mixes queue + fallback per cycle (77); resolveCyclePrompt per iteration (85); logError on drain failure (89) | count===1 fast-path parity with runTaskNextLoop; queue exhausted mid-run |
| `setupTaskNextCancelHandler` | `task-next-ui-teardown.test.ts` | one listener regardless of call count (24); cancelled only when running (34); removes on pagehide (48); reinstallable after reset (64) | none critical |
| `__resetTaskNextCancelHandlerForTests` | teardown test (64) | reset path | test-only helper, sufficient |

Related coverage: `task-next-queue.test.ts` also verifies submenu wiring (`prompt-dropdown.ts`) routes count>1 to `runTaskNextQueue` and the split-button label uses `runTaskNextLoop(deps, 1)`.

## 3. prompt-library-modal.ts

| Export | Test file(s) | Cases covered | Gaps |
|---|---|---|---|
| `openPromptLibraryModal()` | `ui/__tests__/prompt-library-modal.test.ts` | mounts modal + per-role sections (53); idempotent reopen (65); Set default -> setDefaultPromptForRole (71); Duplicate -> upsertPrompt with -copy slug, IsDefault omitted (81); Edit reveals editor, Save calls upsertPrompt with previousBody+id (95); listPromptsByRole failure surfaced inline, no swallow (115); role filter chip (122); sort=name alphabetic (134); body preview toggle (146); Escape closes when no editor (161); Escape cancels editor without closing (168); Ctrl+S saves open editor (181) | Delete confirmation flow; Save with token-drift rejected (guard integration); Import/Export button wiring to prompt-io-db-bridge; empty-DB empty-state copy; a11y: focus trap, initial focus |
| `uniqueDupSlug(baseSlug, existing)` | same file | -copy free path (34); collision -> -copy-N (37) | empty baseSlug; huge existing list; unicode / whitespace slugs |

## 4. Gap summary drives Plan-22 steps

Gap groups that Plan-22 steps 6..30 will lock in:

- G1 `buildPlanTaskPrompt` direct unit sweep (n boundaries + token parity).
- G2 plan-task-ui positive paste path (DB row present).
- G3 task-next-ui settings I/O positive + negative.
- G4 task-next-ui DOM finders positive + negative.
- G5 `dispatchTaskNextSubmit` three-branch coverage.
- G6 prompt-library-modal delete flow + token-drift guard integration.
- G7 prompt-library-modal a11y (focus trap, Esc/Ctrl+S already partial).
- G8 Import/Export bridge wiring assertion in modal.

Every gap above has a matching test file target under `standalone-scripts/macro-controller/src/{ui,__tests__}/` and does not touch production code unless a bug is uncovered (as with the `await` fix in step 5).
