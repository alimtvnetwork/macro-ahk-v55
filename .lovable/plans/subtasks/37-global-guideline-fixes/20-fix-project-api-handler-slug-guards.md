# 20 – Fixing Slug/Endpoint Guards in project-api-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/project-api-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract slug/endpoint guards in project-api-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L79 | `if (!slug)` | `isSlugMissing` |
| L83 | `if (!endpoint)` | `isEndpointMissing` |
| L88 | `if (!hasProjectDb(slug))` | `isProjectDbMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/project-api-handler.ts` and locate L79, L83, and L88.
2. At L79, immediately before `if (!slug)`:
   ```ts
   const isSlugMissing = !slug;
   if (isSlugMissing) {
   ```
3. At L83, immediately before `if (!endpoint)`:
   ```ts
   const isEndpointMissing = !endpoint;
   if (isEndpointMissing) {
   ```
4. At L88, immediately before `if (!hasProjectDb(slug))`:
   ```ts
   const isProjectDbMissing = !hasProjectDb(slug);
   if (isProjectDbMissing) {
   ```
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract slug/endpoint guards in project-api-handler
   ```

---

## Expected Result

```ts
// Before
if (!slug) { ... }              // L79
if (!endpoint) { ... }          // L83
if (!hasProjectDb(slug)) { ... } // L88

// After
const isSlugMissing = !slug;
if (isSlugMissing) { ... }

const isEndpointMissing = !endpoint;
if (isEndpointMissing) { ... }

const isProjectDbMissing = !hasProjectDb(slug);
if (isProjectDbMissing) { ... }
```
