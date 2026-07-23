---
Slug: workspace-move-v2-live-verification
Status: open
Created: 2026-07-23
---

# Workspace-move v2 lacks live-call proof

## Symptom

`standalone-scripts/macro-controller/src/api/ws-move.ts` implements the membership-scoped `moveV2` per `standalone-scripts/macro-controller/spec/workspace-move/01-membership-scoped-api-v2.md`. It typechecks and unit tests pass, but no live call against `https://api.lovable.dev/workspaces/{ws}/memberships/{user}` has confirmed:

- HTTP verb (`PATCH` vs `POST`).
- Body shape (destination workspace id key: `targetWorkspaceId` vs `workspaceId`).
- Preflight `OPTIONS` requirements and CORS allow-list.

The spec is marked `PENDING-VERIFY`.

## Action

1. Trigger a real workspace-move from the extension UI against a throwaway account.
2. Capture the network trace and diff against the spec.
3. Update the spec with verified values, drop `PENDING-VERIFY`, and pin URL + verb in a regression test.

## Status

open