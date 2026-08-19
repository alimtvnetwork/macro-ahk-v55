# Group 4: Editor Fields & Keyword Validation (Steps 31-40)

Status: pending

This sub-task is executed by a separate standalone agent. It is responsible for supplying editor configurations and type alignment for keyword validation steps and properties.

## Steps
31. In `PromptEditForm.tsx`, supply `readOnly: false` to the markdown editors on lines 72 and 167.
32. In `PromptManagerPanel.tsx`, supply `readOnly: false` to the markdown editor on line 116.
33. In `ScriptBundleDetailView.tsx`, supply `readOnly: false` to the js/json editors on lines 630 and 649.
34. In `ScriptsList.tsx`, supply `readOnly: false` to the editors on lines 866 and 885.
35. In `VariablesEditor.tsx`, supply `readOnly: false` to the editor on line 127.
36. Open `XPathValidationPanel.tsx` and inspect `ValidationEntry` properties.
37. Coalesce optional `fallbackUsed` boolean to strict true/false in `XPathValidationPanel.tsx` (line 110).
38. Open `keyword-events-sqlite-import.ts` and inspect the type mappings.
39. Fix incompatibility of optional `Enabled` flag in `keyword-events-sqlite-import.ts` (line 131).
40. Fix missing option `strictUidOnly` in `keyword-events-sqlite-import.ts` (line 350).
