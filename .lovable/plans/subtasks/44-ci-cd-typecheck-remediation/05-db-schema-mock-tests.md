# Group 5: Database Schema & Mock Tests (Steps 41-50)

Status: pending

This sub-task is executed by a separate standalone agent. It is responsible for database schema default properties and mock definitions inside option test files to ensure build pipeline test gates compile.

## Steps
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
