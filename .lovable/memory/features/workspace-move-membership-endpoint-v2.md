---
name: Workspace move endpoint v2 (membership-scoped)
description: New PUT /workspaces/{wsId}/memberships/{userId} contract replacing v1 project-scoped move; PENDING-VERIFY on first live call
type: feature
---

# Workspace move endpoint v2

Updated: 2026-07-23. **Status: PENDING-VERIFY** — coded from a partial user-captured preflight; first live call must confirm verb + body.

## Endpoint

```
PUT https://api.lovable.dev/workspaces/{targetWorkspaceId}/memberships/{currentUserId}
Headers: Authorization: Bearer <jwt>, x-castle-request-token: <token>, Content-Type: application/json
Body: {}      (assumed; may require workspace_id or role — verify)
Credentials: include
```

`currentUserId` = the bearer's `sub` claim (28-char Firebase uid).

## Wired at

- Registry: `standalone-scripts/marco-sdk/src/api-registry.ts` → `workspace.moveV2`.
- SDK wrapper: `standalone-scripts/marco-sdk/src/api.ts` → `workspace.moveV2(wsId, userId, options)`.
- Call site: `standalone-scripts/macro-controller/src/ws-move.ts::executeMove()`.
- User-id resolver: `resolveCurrentUserId()` in `ws-move.ts` (JWT `sub` via `atob`).
- Spec: `standalone-scripts/macro-controller/spec/workspace-move/01-membership-scoped-api-v2.md`.

## What changed vs v1

- Path shape: project-scoped → membership-scoped.
- Project id no longer in URL (server infers from membership context).
- Requires the caller's own user id in the path.
- Castle token, auth-retry, post-move credit refresh, castle-denied handling all unchanged.

## Do NOT

- Do NOT resurrect `PUT /projects/{id}/move-to-workspace` as the primary move call. It stays in the registry only as a rollback lever for one release.
- Do NOT remove the `x-castle-request-token` header. Server returns `403 castle_denied` without it.
- Do NOT add retry beyond the single 401 auth-refresh (see `mem://constraints/no-retry-policy`).
- Do NOT decode the JWT with `decodeJwtPayload()` from `auth-jwt-utils.ts` for user id extraction — that helper truncates `sub` to 30 chars. Use a dedicated non-truncating decoder.

## Verification checklist (first live call)

1. Open DevTools → Network → Fetch/XHR filter.
2. Trigger a move.
3. Confirm the second (non-OPTIONS) request matches the assumed verb + body.
4. If wrong: edit the registry entry (one line) + this memory.
5. Delete PENDING-VERIFY status once verified.

## Related

- `mem://features/prompts-authoring-and-release`
- `mem://auth/unified-auth-contract`