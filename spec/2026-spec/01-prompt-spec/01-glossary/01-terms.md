# T21 · Terms

**Created:** 2026-06-02

Canonical vocabulary for this spec. Any future doc that uses these
words MUST use the meaning given here.

| Term | Meaning |
|---|---|
| **Prompt** | A reusable, named block of text the user can inject into a chat-box. Stored as `info.json` + `prompt.md` on disk, or any equivalent record in a `PromptStore`. |
| **PromptCategory** | A free-form tag-like grouping (e.g. `automation`, `versioning`). One prompt may belong to multiple categories. |
| **PromptStore** | Interface that lists/reads/writes prompts. Implementation (JSON file, IndexedDB, REST, in-memory) is up to the integrator. |
| **ChatBox** | The host app's text-input element that the user normally types into to talk to its chatbot/LLM. Located via integrator-supplied selector (Q1, see `00-overview.md`). |
| **Injection** | The act of writing prompt text into the ChatBox so the host app treats it as user input. |
| **SubmitTarget** | The host app's send / "Add to Tasks" button that fires the chatbot turn. Located via Q2. |
| **NextLoop** | An automation that enqueues N copies of a "next-task" prompt and runs them one-by-one with a delay between submissions. |
| **PlanLoop** | The same engine as NextLoop but using a "plan-task" prompt template; user picks how many plan iterations to queue. |
| **Queue / QueuedTask** | In-memory (optionally persisted) FIFO of pending submissions. One task = one injection + one submit. |
| **Delay** | Sleep time inserted between two queued submissions. Default 7 s, configurable 5–10 s. |
| **HostApp** | The third-party web/desktop app whose ChatBox we paste into. This spec assumes nothing about its stack. |
| **Integrator** | The engineer wiring the Prompts feature into a HostApp; the audience for `140-integration-onboarding/`. |
| **InterruptionSignal** | Any DOM/state cue the HostApp shows when a previous turn must be acknowledged (e.g. "return to chat" banner). Located via Q3; pauses the queue when detected. |
| **EditorKind** | One of `textarea`, `contenteditable`, `prosemirror`, `lexical`, `monaco`, `other`. Determines which paste adapter is used (see `06-injection-contract/adapters/`). |
| **VerboseMode** | Off by default; when on, full prompt body + full DOM snapshot are recorded in logs. |

## Acceptance

- [ ] The implementation satisfies the `T21 · Terms` contract in this file and the folder-level acceptance target: all downstream terms, actors, states, and banned vocabulary stay defined and consistently named.
- [ ] Verification passes when `LINT-glossary-coverage` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

---

<!-- audit: numeric constants source-of-truth -->

Numeric defaults referenced in this file are canonical in [Runtime Defaults](../reference/05-runtime-defaults.md). If a value differs, the SOT wins.

<!-- audit: determinism+pitfalls footer -->

## Determinism (MUST)

- **MUST** bind every numeric default (timeouts, capacities, retries=0, debounce/throttle ms, char limits) to a named constant in `reference/05-runtime-defaults.md`. Inline literals are rejected by `check-must-constants.mjs`.
- **MUST** classify every failure with a stable `Reason` (see `reference/02-failure-reason-codes.md`) plus `ReasonDetail`, and log via `Logger.error` — never `console.error`, never silent `catch {}`.
- **MUST** include `SelectorAttempts[]` on every selector miss and `VariableContext[]` on every variable/data failure; unknown fields written as `null` with a reason.
- **MUST** render timestamps in the user-local timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); storage is UTC ms only.

## Pitfalls / Counter-examples

- ❌ Empty `catch (e) {}` — rejected by `public/error-swallow-audit.json`. ✅ `Logger.error` + re-throw.
- ❌ Retrying a failed call with exponential backoff. ✅ Fail fast per `mem://constraints/no-retry-policy`.
- ❌ Hardcoded `Asia/Kuala_Lumpur` (or any zone). ✅ User-local timezone at render time.
- ❌ `setInterval` / `setTimeout` without paired teardown. ✅ Register `pagehide` cleanup (see `mem://standards/timer-and-observer-teardown`).
- ❌ Magic numbers (`1500`, `64`) inline. ✅ Import the named constant from `reference/05-runtime-defaults.md`.
