# Subtask 09: Built-in Script Guard Improvements

Status: completed

## Goal
Resolve nested-if and swallowed error violations in `src/background/builtin-script-guard.ts`.

## Action Items
1. Open `src/background/builtin-script-guard.ts`.
2. Locate the nested-if inside `fetch` handler around line 281. Extract it into a positively named boolean check `const isValidCode = code && code.length > 10;` and flat structure.
3. Locate lines 150 and 261 where catches swallow errors. Add proper `RiseupAsiaMacroExt.Logger.error` logging.
4. Verify changes compile cleanly.
