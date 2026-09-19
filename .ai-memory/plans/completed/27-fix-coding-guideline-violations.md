# 27-fix-coding-guideline-violations

## Objective
Revert syntax and style regressions introduced by the automated scripts and strictly enforce the codebase's coding standard guidelines (explicit boolean checks, strict Enum naming, newline guidelines, and query wrapper architecture).

## Subtasks & Execution Routing
The orchestrator must spawn sub-agents to tackle these steps sequentially and concurrently as permitted.

### Step 1: Revert "isMissing" Boolean Assignments
- **Target**: All `*.ts`, `*.tsx`, `*.js`, `*.jsx` files
- **Task**: A previous script expanded `if (!variable)` into `const isMissingVariable = !variable; if (isMissingVariable)`. This occurred across 1400+ locations. Revert these to `if (!variable)` to remove overhead.

### Step 2: Enforce Strict Boolean "isFail" Logic
- **Target**: Entire codebase
- **Task**: The usage of `!response.isSuccess` or `!response.ok` violates strict boolean property rules. Replace all inverted success logic with explicit `.isFail` calls.

### Step 3: Strict Enum Naming Validation
- **Target**: `src/types/enums.ts` and all other files declaring `enum`
- **Task**:
  - Replace garbage names (e.g., `Enum_76ebb585`, `SemanticSemantic*`) with meaningful context-aware names.
  - Ensure EVERY Enum ends with `Type` (e.g., `RowOutcomeCode` -> `RowOutcomeCodeType`).
  - Ensure PascalCase usage for enum values.

### Step 4: Query Error Wrapper Implementation
- **Target**: Database interaction layers and error handlers.
- **Task**:
  - Remove scattered `logError('AutoCatch', ...)` statements.
  - Implement a generic TS query wrapper (`QueryExecutor` or `withQueryLogging`) that automatically handles catching and logging failures based on the Error Management guidelines.

### Step 5: Newline Style Fixes
- **Target**: Codebase functions
- **Task**:
  - Enforce R4: Blank line before `return` (in multi-line functions).
  - Enforce R5: Blank line after `}`.
  - Enforce R12/R13: No blank lines at the start of functions and no double blank lines.
  - Use `constants.NewLineUnix` instead of hardcoded `\r\n`.

## Agent Protocol
Subagents MUST check off their tasks in `.lovable/spec/tasks/27-fix-coding-guideline-violations.md` and this file.
- `[ ]` Step 1
- `[ ]` Step 2
- `[ ]` Step 3
- `[ ]` Step 4
- `[ ]` Step 5
