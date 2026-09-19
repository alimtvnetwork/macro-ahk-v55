# Group 3: Scripts & Custom Form Views (Steps 21-30)

Status: pending

This sub-task is executed by a separate standalone agent. It is responsible for fixing file uploader options and editor props alignment across custom panel forms.

## Steps
21. In `UpdaterPanel.tsx`, add the required `isRedirectable` flag to the step creation payload (line 218).
22. Open `ProjectDetailView.tsx` and locate the `settings` property destructuring (line 219).
23. Coalesce optional settings variables (such as `isolateScripts`, `retryOnNavigate`) with standard default values in `ProjectDetailView.tsx`.
24. Open `ProjectFilesPanel.tsx` to find where the custom code editor is rendered (line 920).
25. Update the custom code editor components in `ProjectFilesPanel.tsx` to accept and handle `readOnly`.
26. Open `ProjectScriptSelector.tsx` and find lines 346, 353, 364.
27. Update custom editor in `ProjectScriptSelector.tsx` to supply the optional `readOnly` parameter (line 346).
28. Update file uploader in `ProjectScriptSelector.tsx` to supply the required `multiple` property (line 353).
29. Update JSON custom editor in `ProjectScriptSelector.tsx` to supply `readOnly` (line 364).
30. Open `PromptEditForm.tsx` and identify editor parameters on lines 72 and 167.
