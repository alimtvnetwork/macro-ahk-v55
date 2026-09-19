# Group 1: UI Dialog Option Properties (Steps 01-10)

Status: pending

This sub-task is executed by a separate standalone agent. It is responsible for fixing missing properties in React dialog payloads and custom row item types.

## Steps
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
