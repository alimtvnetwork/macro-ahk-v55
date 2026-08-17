# 17 – Fixing Project Relevance Guard at L156 in injection-namespace-bootstrap

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-namespace-bootstrap.ts` |
| **Rule violated** | Rule 3 – No negating method calls inline in if-conditions; no raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract project relevance guards in injection-namespace-bootstrap` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L156 | `if (!projectIds.has(sub.projectId))` | `isSubProjectExcluded` |
| L183 | `if (!project)` | `isProjectMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-namespace-bootstrap.ts` and locate L156 and L183.
2. At L156, immediately before the condition:
   ```ts
   const isSubProjectExcluded = !projectIds.has(sub.projectId);
   if (isSubProjectExcluded) {
   ```
3. At L183, immediately before the condition:
   ```ts
   const isProjectMissing = !project;
   if (isProjectMissing) {
   ```
4. Run `pnpm run lint` and fix any reported lint errors before committing.
5. Commit with message:
   ```
   fix(guidelines): extract project relevance guards in injection-namespace-bootstrap
   ```

---

## Expected Result

```ts
// Before (L156)
if (!projectIds.has(sub.projectId)) { continue; }

// After
const isSubProjectExcluded = !projectIds.has(sub.projectId);
if (isSubProjectExcluded) { continue; }

// Before (L183)
if (!project) { continue; }

// After
const isProjectMissing = !project;
if (isProjectMissing) { continue; }
```
