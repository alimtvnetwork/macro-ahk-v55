# Coding Guidelines

**Version:** 1.1.0
**Status:** Active
**Updated:** 2026-08-06
**AI Confidence:** High
**Ambiguity:** None

---

## Purpose
Canonical coding guidelines for every AI agent working on this project. These rules are mandatory and must be applied to every code change without exception. When in doubt, read the linked spec files first.

---

## AI Onboarding - Read These Files First
Before generating any code, the AI MUST read the following spec folders in order:

| Priority | Path | Why |
|----------|------|-----|
| 1 | `spec/03-error-manage/00-overview.md` | Error management is the #1 priority. Every catch must be logged properly. |
| 2 | `spec/02-coding-guidelines/00-overview.md` | Cross-language standards, naming, booleans, typing, DRY. |
| 3 | `spec/02-coding-guidelines/01-cross-language/02-boolean-principles.md` | Boolean naming and positive-condition rules. |
| 4 | `spec/02-coding-guidelines/consolidated-review-guide-condensed.md` | One-liner quick-reference for every PR. |

---

## The 15 Rules
### 1. Keep functions under 8 lines
- Function body target: **≤ 8 lines** (hard max 15).
- If a function exceeds 8 lines, extract cohesive blocks into named helpers and compose at the top.

### 2. No nested ifs
- **Zero nested `if`** - always invert the condition, exit early, and continue on the happy path.
- Use guard clauses to keep the main flow flat.

### 3. Keep ifs simple — no `!` at the call site
- **NEVER use `!` in an `if` condition.** Every condition must read naturally without a `!`.
- **To check for absence/failure:** name the boolean to describe the absent state positively.
  - ✅ `const isMissing = value === null; if (isMissing)`
  - ✅ `const isDisabled = script.isEnabled === false; if (isDisabled)`
  - ❌ `const hasValue = value !== null; if (!hasValue)` — introduces `!` at call site
  - ❌ `if (!isValid)` — use `isInvalid` instead
- **NEVER use more than one `&&`** in a single condition. `if (A && B && C)` is banned. Extract into sequential guard clauses or a named boolean.
- **NEVER mix `&&` and `||`** in the same condition. Extract into distinctly named booleans.
- **Never mix positive + negative inline** (`isX && !isY` → extract into a named boolean).

### 4. Follow the Boolean guidelines
- All booleans (variables **and** functions) must start with `is` or `has`. `should` only for recommendations/preferences.
- Booleans must be named to describe what IS TRUE when the flag is set — regardless of whether the state is "good" or "bad".
  - `isMissing` = true when the thing IS missing ✅
  - `isDisabled` = true when the thing IS disabled ✅
  - `isInvalid` = true when the thing IS invalid ✅
  - `isNotReady` = ❌ use `isPending` or `isInitializing` instead
- Extract multi-part conditions into named variables.

### 5. Use proper types - never use `any`, `unknown`, `interface{}`, or any wide-range type except for Generic
- No `any` / `interface{}` / `unknown` / `object` in business logic.
- **Always prefer generics** over `any`/`interface{}`/`unknown` - create a concrete generic type first, then reuse it.

### 6. No error should be swallowed - every catch must be logged properly
- **ZERO TOLERANCE:** Never swallow an error. Empty `catch {}`, bare `return nil`, ignored `Result` = automatic rejection.
- Every error handle must follow the guidelines in `spec/03-error-manage/`.

### 7. No class or file can be more than 80-100 lines max
- File target: **≤ 100 lines** (hard max 300).
- If a file exceeds 100 lines, split by responsibility.

### 8. No magic string or number - use Enum or Constants
- No magic strings → Enum.
- No magic numbers → named constant.
- Exceptions: `0`, `1`, `-1`, `""`, `true`, `false`, `null`/`nil`.

### 9. Don’t define definitions in place - define in a separate file and separately
- Types, constants, enums, and interfaces must live in their own files (e.g., `types.ts`, `constants.ts`, `enums.ts`).

### 10. Booleans should always have `is` or `has` as a prefix
- Boolean variables: `isActive`, `hasPermission`, `shouldRetry`.
- Boolean-returning functions: `isTokenValid()`, `hasRole()`.

### 11. Always write code so it is reusable - DRY is our highest priority
- Extract duplicated logic into shared helpers, hooks, or utilities.

### 12. Make components as small and reusable as possible - plan first, Mermaid if needed
- Keep components under 100 lines.
- One component = one responsibility.

### 13. If `spec/03-error-manage/` is available, every error handle must follow those guidelines
- Implementation starts from line 1.
- Never write business logic without proper error handling wrapping it.

### 14. Assign all variables at once - no mutation unless loop index
- Prefer immutable assignment: declare and assign in one go.
- Use `const` by default; only use `let` when reassignment is truly required.

### 15. Designs/assets go to `/assets/xx-folder-name/xx-file-name.ext`
- Supported extensions: `.jpg`, `.png`, `.svg`, `.mp3`, `.mp4`, `.webp`, `.gif`, `.ico`, `.woff2`.

---

## Project-Critical Addenda (Tokens mandatory for `scripts/check-coding-guidelines-coverage.mjs`)
- **CQ14** - Braces always.
- **CQ15** - Newline grouping.
- **Defensive property access** - `?.` / `??`.
- **CaughtError** - Type contract.
- **Logger.error** - Namespace mandate.
- **CODE RED** - File error contract.
- **Failure log shape** - Mandatory structure.
- **SCREAMING_SNAKE_CASE** - Constants.
- **No short names** - (arr, cb, fn, el, msg, ctx, obj, val).
- **No Supabase** - sdk/shim/tokens banned.
- **No PascalCase storage migration** - Chrome storage keys stable.
- **getBearerToken()** - Unified auth.
- **No-retry policy** - Sequential fail-fast only.
- **Test-with-features** - TDD mandatory.
- **Dark-only theme** - No light mode.
- **framer-motion** - Animation lib ban.
- **SP-1..SP-7** - `readme.txt` prohibitions.
- **isNewTabOrBlankUrl()** - New-tab guard.
- **Timer/observer teardown** - Cleanup on exit.
