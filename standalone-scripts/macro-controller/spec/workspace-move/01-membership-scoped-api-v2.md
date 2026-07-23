# Move-to-Workspace — API Contract (v2, membership-scoped)

**Status:** PENDING-VERIFY. Coded 2026-07-23 from a partial user-captured fetch snippet.
**Supersedes:** `00-api-contract.md` (project-scoped `PUT /projects/{id}/move-to-workspace`).

## What changed

The server switched the workspace-move contract from a project-scoped path
to a membership-scoped path:

```
OLD:  PUT https://api.lovable.dev/projects/{projectId}/move-to-workspace
NEW:  PUT https://api.lovable.dev/workspaces/{targetWorkspaceId}/memberships/{currentUserId}
```

`projectId` is no longer in the URL. The server now infers which project(s)
to move from the caller's membership context. The user id in the path is
the **currently authenticated user** (bearer `sub`), not the owner of the
target workspace.

## Captured preflight (verbatim, from user)

```js
fetch("https://api.lovable.dev/workspaces/kIf3AmPRjCx1QMJ4Uxex/memberships/ll8JGScuunc3QQxLHrsqBw43Tty2", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "priority": "u=1, i",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrer": "https://lovable.dev/",
  "body": null,
  "method": "OPTIONS",
  "mode": "cors",
  "credentials": "omit"
});
```

Note: this is the browser's **CORS preflight**, not the real call. The
preflight is credential-less by design (`credentials: "omit"`, `body: null`).
The real credentialed request follows automatically and carries auth
headers + a body (if any). Reproduce with the DevTools Network tab set to
"Fetch/XHR" and filter for the same URL to see the second request.

## Assumed request shape (until first live call confirms)

```http
PUT /workspaces/{targetWorkspaceId}/memberships/{currentUserId} HTTP/1.1
Host: api.lovable.dev
Content-Type: application/json
Authorization: Bearer <Firebase JWT>
x-castle-request-token: <one-shot Castle token>
Origin: https://lovable.dev
Referer: https://lovable.dev/
Cookie: __cuid=…; cid=…    (sent via credentials:'include')

{}
```

Body is sent as `{}` for now. If the server requires a `workspace_id` or
`role` field, the first live call will 400 with a clear message and we
patch `standalone-scripts/marco-sdk/src/api.ts::workspace.moveV2()`.

## PENDING-VERIFY on first live call

Confirm and update this spec + `api-registry.ts::workspace.moveV2` if any
of the following are wrong:

1. **HTTP verb** — assumed `PUT`. Alternatives: `POST`, `PATCH`, `DELETE`.
2. **Body keys** — assumed `{}`. Server may require `{ workspace_id }`,
   `{ project_id }`, or `{ role }`.
3. **Path shape** — assumed `/workspaces/{wsId}/memberships/{userId}`.
4. **User id source** — assumed JWT `sub`. May need `/user/me` lookup.
5. **Castle token still required** — assumed yes (carried over from v1).
6. **Castle-denied response shape** — assumed `{type:"castle_denied"}`.

## Response classes (assumed)

| Status | Meaning | Action |
|---|---|---|
| 200 / 204 | Move accepted | Refresh credits for source + target workspace; clear cached resolved workspace; toast success. |
| 401 | Bearer expired | `getBearerToken({ force: true })` and retry **once**. |
| 403 + `{type:"castle_denied"}` | Castle blocked the request | Toast the Castle message; **no retry**. |
| 403 (other) | Permission denied | Toast; no retry. |
| 404 | Membership not found on target workspace | Toast: user must already be a member of the target workspace. |
| 4xx/5xx other | Unknown failure | Log, toast, session probe. |

## Invariants (unchanged from v1)

- Single call site: `executeMove()` in `standalone-scripts/macro-controller/src/ws-move.ts`.
- One PUT per user action. Only the 401 auth-retry is permitted.
- Awaited `fetchAndPersist(target, force=true)` post-move.
- Castle token minted per attempt via `getCastleRequestToken()`.
- Log lines redact bearer to first 12 chars.

## Rollback lever

The v1 registry entry `workspace.move` and SDK wrapper `workspace.move()`
are retained for one release marked DEPRECATED. If v2 is broken in
production, flip the call in `ws-move.ts::executeMove()` back to
`workspace.move(projectId, targetWorkspaceId, ...)` and rebuild.

## Related

- `00-api-contract.md` — v1 (deprecated) contract.
- `mem://features/workspace-move-membership-endpoint-v2` — memory summary.
- `mem://constraints/no-retry-policy` — retry policy.
- `mem://auth/unified-auth-contract` — token source.