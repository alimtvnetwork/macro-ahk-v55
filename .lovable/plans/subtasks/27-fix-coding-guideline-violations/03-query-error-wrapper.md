# Subtask: Query Error Wrapper Implementation
Status: ⏳ Pending

## Objective
Implement a generic TS query wrapper that handles logging automatically (replacing scattered `logError` statements) according to error manage rules.

## Scope
Database handlers and endpoints (e.g. `library-handler.ts`).

## Validation
- Queries use the wrapper.
- Extraneous `logError` blocks are removed.
