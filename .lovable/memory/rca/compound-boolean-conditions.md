# RCA: Compound Boolean Conditions

**Date:** 2026-08-08  
**Severity:** CODE RED (guideline violation)  
**Files Fixed:** 10 files

---

## Root Cause

Developers wrote conditions that combined more than one `&&` operator, or mixed `&&` with `||`, in a single `if` statement.

**Example of violation:**
```typescript
if (perWs.length === 0 && firstRaw && isValidRawWorkspace) {
```

**Root causes (why this happened):**
1. **No explicit lint rule** enforced "max one logical operator per condition". ESLint complexity rules don't check per-condition operator count.
2. **Guideline was ambiguous** — the prior memory said "Max 2 conditions per `if`" without concrete examples showing the violation pattern.
3. **AI agents misread the rule** and focused on variable naming rather than enforcing operator count.
4. **Habit** — inline chaining feels natural when writing guard clauses quickly.

---

## Why It Shouldn't Happen Again

Rule 3 in `.lovable/memory/standards/01-coding-guidelines.md` now reads:

> **NEVER use more than one `&&`** in a single condition. `if (A && B && C)` is banned.  
> **NEVER mix `&&` and `||`** in the same condition.

With concrete code examples included directly in the rule.

---

## Fixes Applied

| File | Violation | Fix |
|------|-----------|-----|
| `ws-dialog-detection.ts` | `perWs.length === 0 && firstRaw && isValidRawWorkspace` | Named booleans + sequential guards |
| `loop-check.ts` | 5-condition `&&` chain | Named booleans chain |
| `loop-controls.ts` | `&& (!a \|\| b.length === 0)` | `isMissingWorkspaceName && isEmptyPerWorkspace` |
| `ui-updaters.ts` | `name && !fromCache && isValid(name)` | `isReadyToUpdate && isValidName` |
| `workspace-cache.ts` | `lastPid && lastPid !== currentPid && pid !== '_default'` | `shouldUpdate && !isDefaultProject` |
| `remix-fetch.ts` | `!force && existing && Date.now()...` | Named booleans |
| `ws-members-fetch.ts` | `cached && cached.expires > now && cached.members.length >= limit` | Named booleans |
| `ws-context-menu.ts` | 3x three-condition `&&` chains | Named booleans |
| `workspace-observer.ts` | 5-condition `&&` chain | Named booleans |
| `ws-checkbox-handler.ts` | `currentName && targetName && currentName === targetName` | Named booleans |

---

## The Correct Patterns

### Pattern A: Sequential guard clauses (preferred)
```typescript
const isMissingToken = token === null;
if (isMissingToken) return;
const isExpiredToken = token.expiresAt < Date.now();
if (isExpiredToken) return;
// happy path here
```

### Pattern B: Named boolean chain (when early return is not possible)
```typescript
const hasSdk = sdk !== null && sdk !== undefined;
const hasPrompts = hasSdk && sdk!.prompts !== null;
const hasPreWarm = hasPrompts && typeof sdk!.prompts.preWarm === 'function';
if (hasPreWarm) { ... }
```

Each named boolean has AT MOST ONE logical operator. Never both `&&` and `||` in the same expression.
