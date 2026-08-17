# 09 – Fixing isDbManagerMissing / isGroupMissing / isKeyMissing in grouped-kv-handler

## Metadata
| Field | Value |
|---|---|
| **Target file** | `src/background/handlers/grouped-kv-handler.ts` |
| **Rule violated** | Rule 3 – No raw `!` in if-conditions; Rule 11 – DRY (don't repeat yourself) |
| **Commit message** | `fix(guidelines): extract grouped-kv boolean guards` |

---

## Violations

| Line | Current code | Extracted name | Notes |
|---|---|---|---|
| L34 | `if (!dbManager)` | `isDbManagerMissing` | Once, top-level |
| L51 | `if (!group)` | `isGroupMissing` | Function 1 |
| L83 | `if (!group)` | `isGroupMissing` | Function 2 |
| L113 | `if (!group)` | `isGroupMissing` | Function 3 |
| L137 | `if (!group)` | `isGroupMissing` | Function 4 |
| L167 | `if (!group)` | `isGroupMissing` | Function 5 |
| L55 | `if (!key)` | `isKeyMissing` | Function 1 |
| L87 | `if (!key)` | `isKeyMissing` | Function 2 |
| L117 | `if (!key)` | `isKeyMissing` | Function 3 |

---

## Fix Instructions

1. **Read** `src/background/handlers/grouped-kv-handler.ts` to understand the structure and identify function boundaries.
2. At L34, immediately before `if (!dbManager)`:
   ```ts
   const isDbManagerMissing = !dbManager;
   if (isDbManagerMissing) {
   ```
3. In each of the five functions containing `if (!group)` (L51, L83, L113, L137, L167), extract a local `isGroupMissing` at the top of each respective function body:
   ```ts
   const isGroupMissing = !group;
   if (isGroupMissing) {
   ```
4. In the three functions containing `if (!key)` (L55, L87, L117), extract a local `isKeyMissing` immediately before the check in each respective function:
   ```ts
   const isKeyMissing = !key;
   if (isKeyMissing) {
   ```
5. Run `pnpm run lint` and fix any reported lint errors before committing.
6. Commit with message:
   ```
   fix(guidelines): extract grouped-kv boolean guards
   ```

---

## Expected Result

Each function goes from:
```ts
if (!group) { return; }
if (!key) { return; }
```
To:
```ts
const isGroupMissing = !group;
if (isGroupMissing) { return; }

const isKeyMissing = !key;
if (isKeyMissing) { return; }
```
