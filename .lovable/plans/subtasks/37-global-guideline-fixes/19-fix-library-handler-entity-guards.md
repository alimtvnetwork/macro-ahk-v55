# 19 – Fixing Asset/Link/Group/Settings Guards in library-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/library-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions |
| **Commit message** | `fix(guidelines): extract entity guards in library-handler` |

---

## Violations

| Line | Current code | Extracted name |
|---|---|---|
| L211 | `if (!asset)` | `isAssetMissing` |
| L330 | `if (!link)` | `isLinkMissing` |
| L538 | `if (!group)` | `isGroupMissing` |
| L686 | `if (!settingsJson)` | `isSettingsJsonMissing` |

---

## Fix Instructions

1. **Read** `src/background/handlers/library-handler.ts` and locate L211, L330, L538, and L686.
2. At L211, immediately before `if (!asset)`:
   ```ts
   const isAssetMissing = !asset;
   if (isAssetMissing) {
   ```
3. At L330, immediately before `if (!link)`:
   ```ts
   const isLinkMissing = !link;
   if (isLinkMissing) {
   ```
4. At L538, immediately before `if (!group)`:
   ```ts
   const isGroupMissing = !group;
   if (isGroupMissing) {
   ```
5. At L686, immediately before `if (!settingsJson)`:
   ```ts
   const isSettingsJsonMissing = !settingsJson;
   if (isSettingsJsonMissing) {
   ```
6. Run `pnpm run lint` and fix any reported lint errors before committing.
7. Commit with message:
   ```
   fix(guidelines): extract entity guards in library-handler
   ```

---

## Expected Result

```ts
// Before
if (!asset) { ... }        // L211
if (!link) { ... }         // L330
if (!group) { ... }        // L538
if (!settingsJson) { ... } // L686

// After
const isAssetMissing = !asset;
if (isAssetMissing) { ... }

const isLinkMissing = !link;
if (isLinkMissing) { ... }

const isGroupMissing = !group;
if (isGroupMissing) { ... }

const isSettingsJsonMissing = !settingsJson;
if (isSettingsJsonMissing) { ... }
```
