---
name: Workspace Move v2
description: Membership-scoped PUT /workspaces/{wsId}/memberships/{userId} replacing v1 project-scoped move.
type: feature
---

## Goal
Implement a more secure and accurate workspace membership move API that scopes the move to a specific user membership within a workspace, rather than just the project.

## Contract
- **Method:** `PUT`
- **URL:** `https://api.lovable.dev/workspaces/{moving-workspace-id}/memberships/{current-user-id}`
- **Note:** Replaces legacy project-scoped move logic.

## Implementation Details
- Applied in `ws-move.ts`.
- v1 logic retained for one release cycle as a fallback/rollback safety.
- `PENDING-VERIFY` on first live call from the extension.
