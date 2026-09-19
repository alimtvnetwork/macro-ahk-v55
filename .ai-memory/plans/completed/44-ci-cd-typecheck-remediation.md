# CI/CD Typecheck & Interface Alignment Remediation

Slug: ci-cd-typecheck-remediation
Steps: 50
Status: completed
Created: 2026-08-19

## Context
A series of type checking errors has been detected under the strict compilation rule `tsconfig.app.json`. These errors span React UI dialog parameters, optional settings objects, custom Monaco Editor component bindings, database metadata properties, and test mocks.

Files involved:
- `src/components/options/BatchRunDialog.tsx`
- `src/components/options/ConfigsList.tsx`
- `src/components/options/ExportErrorDialog.tsx`
- `src/components/options/ImportErrorDialog.tsx`
- `src/components/options/OptionsSidebar.tsx`
- `src/components/options/ProjectDetailView.tsx`
- `src/components/options/ProjectFilesPanel.tsx`
- `src/components/options/ProjectScriptSelector.tsx`
- `src/components/options/PromptEditForm.tsx`
- `src/components/options/PromptManagerPanel.tsx`
- `src/components/options/ScriptBundleDetailView.tsx`
- `src/components/options/ScriptsList.tsx`
- `src/components/options/SettingsView.tsx`
- `src/components/options/UpdaterPanel.tsx`
- `src/components/options/XPathValidationPanel.tsx`
- `src/lib/__tests__/keyword-event-validation.test.ts`
- `src/lib/__tests__/keyword-events-sqlite-export.test.ts`
- `src/lib/keyword-events-sqlite-import.ts`
- `src/lib/sqlite-bundle.ts`
- `src/options/sections/editor/VariablesEditor.tsx`
- `src/pages/Options.tsx`
- `src/pages/__tests__/Options.test.tsx`
- `src/test/import-export/build-fixture.ts`
- `src/types/default-databases.ts`

## Groups & Standalone Context
The plan is partitioned into exactly 5 standalone groups, each containing 10 micro-tasks. Each group represents a self-contained unit of work that can be executed and committed independently by separate agents.

- **Group 1: UI Dialog Option Properties (Steps 01-10)** -> [01-ui-dialog-options.md](../subtasks/44-ci-cd-typecheck-remediation/01-ui-dialog-options.md)
- **Group 2: Options Sidebar & Layout Props (Steps 11-20)** -> [02-sidebar-navigation-props.md](../subtasks/44-ci-cd-typecheck-remediation/02-sidebar-navigation-props.md)
- **Group 3: Scripts & Custom Form Views (Steps 21-30)** -> [03-script-custom-views.md](../subtasks/44-ci-cd-typecheck-remediation/03-script-custom-views.md)
- **Group 4: Editor Fields & Keyword Validation (Steps 31-40)** -> [04-editor-fields-keyword-validation.md](../subtasks/44-ci-cd-typecheck-remediation/04-editor-fields-keyword-validation.md)
- **Group 5: Database Schema & Mock Tests (Steps 41-50)** -> [05-db-schema-mock-tests.md](../subtasks/44-ci-cd-typecheck-remediation/05-db-schema-mock-tests.md)

## Steps

### Group 1: UI Dialog Option Properties (Steps 01-10)
1. Read `BatchRunDialog.tsx` to locate the parameters for `GroupRunPayloadInput` mapping.
2. In `BatchRunDialog.tsx`, check where `ProjectId` and `GroupId` properties are defined.
3. Fix the missing `IsTest` field in the payload object on line 163 of `BatchRunDialog.tsx`.
4. Inspect `ReplayBridgeOptions` interface in the codebase.
5. In `BatchRunDialog.tsx`, check where `Doc` is passed to the replay bridge.
6. Fix the missing `Verbose` property in `ReplayBridgeOptions` on line 441 of `BatchRunDialog.tsx`.
7. Verify compiler accepts options arguments in `BatchRunDialog.tsx`.
8. Locate `ExportErrorDialog.tsx` detail rows component signature.
9. Fix missing `mono` prop inside row items array in `ExportErrorDialog.tsx` (line 119).
10. Fix missing `mono` prop inside row items array in `ImportErrorDialog.tsx` (line 112).

### Group 2: Options Sidebar & Layout Props (Steps 11-20)
11. Inspect `OptionsSidebar.tsx` and identify where `SidebarMenuButton` is rendered.
12. Make `asChild` and `isActive` optional in `SidebarMenuButton` props definition (or supply them).
13. Fix missing properties in `SidebarMenuButton` invocation on line 138 of `OptionsSidebar.tsx`.
14. Fix missing properties in `SidebarMenuButton` invocation on line 186 of `OptionsSidebar.tsx`.
15. Fix missing properties in `SidebarMenuButton` invocation on line 245 of `OptionsSidebar.tsx`.
16. Open `Options.tsx` and find the `SidebarProvider` invocation (line 414).
17. Make `open` and `defaultOpen` optional properties in the `SidebarProvider` component prop types.
18. Locate `SettingsView.tsx` where `SettingsGroup` is used.
19. Make `defaultOpen` optional in the `SettingsGroupProps` interface definitions.
20. Open `UpdaterPanel.tsx` and inspect the `UpdaterStep` type requirements.

### Group 3: Scripts & Custom Form Views (Steps 21-30)
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

### Group 4: Editor Fields & Keyword Validation (Steps 31-40)
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

### Group 5: Database Schema & Mock Tests (Steps 41-50)
41. Open `sqlite-bundle.ts` and inspect conversion mappings.
42. Update conversions in `sqlite-bundle.ts` to include `isIife: false, hasDomUsage: false` (lines 597, 689).
43. Cast StoredProject settings properly to resolve signature mismatch in `sqlite-bundle.ts` (line 912).
44. Update test mock entries in `keyword-event-validation.test.ts` to supply `Enabled: true` (lines 207, 208).
45. Update test mock entries in `keyword-events-sqlite-export.test.ts` to supply `Enabled: true` (lines 68, 69, 80).
46. Update options test mock project in `Options.test.tsx` to supply `isGlobal` and `isRemovable` (line 6).
47. Update options test mock script in `Options.test.tsx` to supply `isIife` and `hasDomUsage` (line 18).
48. Update `build-fixture.ts` to define `isolateScripts` and `retryOnNavigate` properties (line 40).
49. Open `default-databases.ts` and locate the default schema values.
50. Add `Nullable` and `Unique` boolean values explicitly to database columns in `default-databases.ts` (lines 65-89).

## Verification
- Verify compilation passes with `npx tsc --noEmit -p tsconfig.app.json`.
- Verify code style guidelines are met using `npx eslint .`.
- Run unit test suites using `pnpm test -- --run`.
