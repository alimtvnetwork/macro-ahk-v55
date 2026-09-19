# Prompts & Macros — Keyboard Shortcuts
**Created:** 2026-06-02
A small, non-conflicting keymap for the Prompts panel and the macro engine. **All shortcuts use `Ctrl+Alt+<key>`** to mirror the recorder convention (`mem://features/recorder-keyboard-shortcuts`) and avoid colliding with browser, OS, or chatbox bindings.
## Keymap
| Shortcut         | Scope                              | Action                                                          |
|------------------|------------------------------------|-----------------------------------------------------------------|
| `Ctrl+Alt+M`     | global (per-tab, page-level)       | Toggle Prompts panel open/closed (focus the search input on open). |
| `Ctrl+Alt+K`     | global, only when panel open       | Switch active tab (Prompts ↔ Macros).                            |
| `Ctrl+Alt+B`     | global, only when Macros tab open  | Open Macro Builder (Create mode).                                |
| `Ctrl+Alt+R`     | global, only when no run active    | Run the currently-focused macro row (or last-run macro if none). |
| `Ctrl+Alt+;`     | global, only when run active       | Pause / Resume the active run.                                   |
| `Ctrl+Alt+.`     | global, only when run active       | Stop the active run (confirm dialog).                            |
| `F`              | row focus only                     | Toggle favorite on the focused row.                              |
| `Enter` / `Space`| row focus only                     | Insert prompt (Prompts tab) or Run macro (Macros tab).           |
| `ArrowUp/Down`   | list focus                         | Move row focus.                                                  |
| `Escape`         | panel open                         | Close panel (or close any open dialog first).                    |
| `Alt+ArrowUp/Down` | step card focus in Macro Builder | Reorder step.                                                    |
## Conflict-check matrix
| Shortcut       | Recorder uses?       | Browser default?    | Verdict |
|----------------|----------------------|---------------------|---------|
| `Ctrl+Alt+P`   | **yes** (Resume)     | —                   | **Avoided** — reserved for recorder. |
| `Ctrl+Alt+;`   | **yes** (Pause)      | —                   | **Reused intentionally** — only active during a macro run; recorder shortcut is only active during a recorder session; the two scopes are mutually exclusive (the same physical key can mean Pause-recorder OR Pause-macro depending on which session exists, never both at once). |
| `Ctrl+Alt+.`   | **yes** (Stop)       | —                   | **Reused intentionally** — same scope-exclusion reasoning. |
| `Ctrl+Alt+M`   | no                   | no                  | OK.     |
| `Ctrl+Alt+K`   | no                   | no                  | OK.     |
| `Ctrl+Alt+B`   | no                   | no                  | OK.     |
| `Ctrl+Alt+R`   | no                   | Firefox: reload (overrides only when panel focus) | OK with focus-gate. |
**Scope-exclusion rule** (mandatory): handlers for `Ctrl+Alt+;` and `Ctrl+Alt+.` MUST first check `state.activeMacroRun !== null`. If false, fall through (let the recorder handler win). If true, swallow the event and dispatch the macro action. The recorder handler does the inverse check (`mem://features/recorder-keyboard-shortcuts` — "only active while a session exists"). Both are documented and tested.
## Editable-field guard (mandatory)
Every handler MUST early-return when the event target is an editable field — matches the recorder's existing guard (`mem://features/recorder-keyboard-shortcuts`):
```ts
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) { return false; }
  if (target.isContentEditable) { return true; }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
```
Only the panel's own search input and Macro Builder fields are exempt — they handle their own keys (`Enter`/`Escape`) and never call the global handler.
## Registration & teardown
- Single global `keydown` listener installed by the `MacroController` UI manager.
- Paired teardown on `pagehide` and on extension context invalidation (`mem://standards/timer-and-observer-teardown`).
- Listener early-returns when `isNewTabOrBlankUrl()` is true (`mem://features/new-tab-no-url-guard`).
- All shortcuts call `event.preventDefault()` + `event.stopPropagation()` only after the editable-field guard and scope checks pass.
## Discoverability
- Each menu item / button shows its shortcut in a muted span on the right (`[Ctrl+Alt+M]`).
- A `?` icon in the panel footer opens a read-only keymap reference (this doc, condensed).
## Test coverage (`mem://preferences/test-with-features`)
- Each shortcut fires its action under the documented conditions.
- Editable-field guard: typing `Ctrl+Alt+M` inside the search input does NOT toggle the panel.
- Scope exclusion: `Ctrl+Alt+;` with no active macro run AND an active recorder session triggers the recorder's Pause and not the macro's Pause; the inverse case also passes.
- Teardown: after `pagehide`, no handler fires.
- New-tab guard: shortcuts noop on `about:blank`.
