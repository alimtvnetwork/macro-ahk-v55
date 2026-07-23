# Step 2 note: reproducing issue 03

Parent: 12-prompts-import-export-menu
Status: blocked-on-manual-repro
Created: 2026-07-17

## Environment constraint

The Import / Export / IO / Load pills live in the macro-controller UI
that is injected into `https://lovable.dev/**` tabs by the Chrome
extension. They do NOT render in the extension Options page (this
project's Vite preview at `http://localhost:8080`), and the sandbox
Playwright cannot install a Chrome extension into `chromium.launch()`
against `lovable.dev` behind auth.

Result: automated in-sandbox reproduction is not viable this turn.

## Static-read confirmation (from notes-01)

- `buildDropdownHeader()` mounts all four pills unconditionally
  (`prompt-dropdown.ts` L246-249).
- Each pill has an `onclick` assigned directly on the DOM element.
- `exportPromptsToJson()`, `renderPromptIODialog()`, and the file-input
  import path all exist and do not throw at module load.

Conclusion: the "inert" symptom in `.lovable/issues/03-prompts-import-export-inert.md`
is almost certainly a **stale bundle** — the deployed zip predates the
wiring in `prompt-dropdown.ts` L246-249. The next release
(`v4.33.0`) picks up the wired handlers automatically; the plan's
Steps 3-11 then upgrade them from bare JSON to the JSON/ZIP/SQLite
popover.

## Manual repro checklist (owner: user, one-liner)

1. Load unpacked build `dist/` in `chrome://extensions`.
2. Open a Lovable project tab, wait for the macro-controller strip.
3. Click the prompts dropdown; confirm four pills render: `📤 Export`,
   `📥 Import`, `📥 IO`, `↻ Load`.
4. Click each and note the result:
   - Export → file download prompt + toast.
   - Import → file picker.
   - IO → modal opens.
   - Load → refresh spinner + toast.

If any pill still does nothing after installing the v4.33.0 build, file
a follow-up on issue 03 with the browser console output; it will be a
runtime bug rather than a wiring gap, and Step 12 of the plan (import
modal shell) is the natural entry point for the fix.

## Deferred

Playwright coverage of the injected UI is captured as Step 27 of plan
12 (E2E round-trip). It will drive the extension via a scripted Chrome
launch with `--load-extension=dist/` once the popover UI lands.
