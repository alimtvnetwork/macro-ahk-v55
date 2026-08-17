# 10 – Fixing Active ID/Project Guards in injection-dependency-builder

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-dependency-builder.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract active-id guards in injection-dependency-builder` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L23 | `if (!activeId)` | `isActiveIdMissing` |
| L28 | `if (!activeProject)` | `isActiveProjectMissing` |
| L149 | `if (!scriptKey)` | `isScriptKeyMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-dependency-builder.ts` and locate L23, L28, and L149.
2. At L23, immediately before `if (!activeId)`:
   ```ts
   const isActiveIdMissing = !activeId;
   if (isActiveIdMissing) {
   ```
3. At L28, immediately before `if (!activeProject)`:
   ```ts
   const isActiveProjectMissing = !activeProject;
   if (isActiveProjectMissing) {
   ```
4. At L149, immediately before `if (!scriptKey)`:
   ```ts
   const isScriptKeyMissing = !scriptKey;
   if (isScriptKeyMissing) {
   ```
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract active-id guards in injection-dependency-builder
   ```

---

## Expected Result

```ts
// Before
if (!activeId) { ... }      // L23
if (!activeProject) { ... } // L28
if (!scriptKey) { ... }     // L149

// After
const isActiveIdMissing = !activeId;
if (isActiveIdMissing) { ... }

const isActiveProjectMissing = !activeProject;
if (isActiveProjectMissing) { ... }

const isScriptKeyMissing = !scriptKey;
if (isScriptKeyMissing) { ... }
```
