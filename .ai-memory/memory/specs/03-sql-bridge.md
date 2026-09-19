---
name: SQL Bridge
description: Adaptive rawSql bridge for prompt loading/editing failures.
type: feature
---

## Goal
Fix `PROMPT_LOAD_E001` and `PROMPT_EDIT_E005` errors caused by backend API changes (unsupported `QUERY` method).

## Implementation Details
- Implemented `sql-bridge.ts`.
- Uses an adaptive approach to `rawSql` calls.
- Provides a background-to-client bridge to cache successful query methods.
- Includes fallback to standard API calls when raw SQL is unsupported.
