# Subtask: Revert "isMissing" Boolean Assignments
Status: ⏳ Pending

## Objective
Revert unnecessary wrapper logic such as `const isMissingVariable = !variable; if (isMissingVariable)` back to `if (!variable)`.

## Scope
Across 1400+ files in `src/` and `standalone-scripts/`.

## Validation
- Ensure build succeeds after changes.
- Ensure logic remains identical.
