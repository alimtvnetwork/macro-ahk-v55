# 11 – Fixing Set.has() Negation Guards in injection-dependency-builder

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/injection-dependency-builder.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions; no negating method calls inline |
| **Commit message** | `fix(guidelines): fix Set.has negation guards in injection-dependency-builder` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L53 | `if (!relevantIds.has(sub.projectId))` | `isSubProjectIrrelevant` |
| L101 | `if (!relevantIds.has(project.id))` | `isProjectIrrelevant` |
| L117 | `if (!depProject?.scripts?.length)` | `isDependencyScriptsMissing` |
| L178 | `if (!gp.scripts?.length)` | `isGlobalScriptsMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/injection-dependency-builder.ts` and locate L53, L101, L117, and L178.
2. At L53, immediately before the condition:
   ```ts
   const isSubProjectIrrelevant = !relevantIds.has(sub.projectId);
   if (isSubProjectIrrelevant) {
   ```
3. At L101, immediately before the condition:
   ```ts
   const isProjectIrrelevant = !relevantIds.has(project.id);
   if (isProjectIrrelevant) {
   ```
4. At L117, immediately before the condition:
   ```ts
   const isDependencyScriptsMissing = !depProject?.scripts?.length;
   if (isDependencyScriptsMissing) {
   ```
5. At L178, immediately before the condition:
   ```ts
   const isGlobalScriptsMissing = !gp.scripts?.length;
   if (isGlobalScriptsMissing) {
   ```
6. Run `pnpm run lint` and fix any reported lint errors before committing.
7. Commit with message:
   ```
   fix(guidelines): fix Set.has negation guards in injection-dependency-builder
   ```

---

## Expected Result

```ts
// Before (L53)
if (!relevantIds.has(sub.projectId)) { continue; }

// After
const isSubProjectIrrelevant = !relevantIds.has(sub.projectId);
if (isSubProjectIrrelevant) { continue; }

// Before (L101)
if (!relevantIds.has(project.id)) { continue; }

// After
const isProjectIrrelevant = !relevantIds.has(project.id);
if (isProjectIrrelevant) { continue; }

// Before (L117)
if (!depProject?.scripts?.length) { continue; }

// After
const isDependencyScriptsMissing = !depProject?.scripts?.length;
if (isDependencyScriptsMissing) { continue; }

// Before (L178)
if (!gp.scripts?.length) { continue; }

// After
const isGlobalScriptsMissing = !gp.scripts?.length;
if (isGlobalScriptsMissing) { continue; }
```
