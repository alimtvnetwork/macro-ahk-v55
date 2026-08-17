# 15 – Fixing Extension Root Guards in injection-namespace-bootstrap

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-namespace-bootstrap.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract extension root guards in injection-namespace-bootstrap` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L39 | `if (!win.RiseupAsiaMacroExt)` | `isExtRootMissing` |
| L43 | `if (!ext.Projects)` | `isProjectsMissing` |
| L128 | `if (!activeId)` | `isActiveIdMissing` |
| L133 | `if (!activeProject)` | `isActiveProjectMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-namespace-bootstrap.ts` and locate L39, L43, L128, and L133.
2. At L39, immediately before `if (!win.RiseupAsiaMacroExt)`:
   ```ts
   const isExtRootMissing = !win.RiseupAsiaMacroExt;
   if (isExtRootMissing) {
   ```
3. At L43, immediately before `if (!ext.Projects)`:
   ```ts
   const isProjectsMissing = !ext.Projects;
   if (isProjectsMissing) {
   ```
4. At L128, immediately before `if (!activeId)`:
   ```ts
   const isActiveIdMissing = !activeId;
   if (isActiveIdMissing) {
   ```
5. At L133, immediately before `if (!activeProject)`:
   ```ts
   const isActiveProjectMissing = !activeProject;
   if (isActiveProjectMissing) {
   ```
6. Run `pnpm run lint` and fix any reported lint errors before committing.
7. Commit with message:
   ```
   fix(guidelines): extract extension root guards in injection-namespace-bootstrap
   ```

---

## Expected Result

```ts
// Before
if (!win.RiseupAsiaMacroExt) { ... }  // L39
if (!ext.Projects) { ... }             // L43
if (!activeId) { ... }                 // L128
if (!activeProject) { ... }            // L133

// After
const isExtRootMissing = !win.RiseupAsiaMacroExt;
if (isExtRootMissing) { ... }

const isProjectsMissing = !ext.Projects;
if (isProjectsMissing) { ... }

const isActiveIdMissing = !activeId;
if (isActiveIdMissing) { ... }

const isActiveProjectMissing = !activeProject;
if (isActiveProjectMissing) { ... }
```
