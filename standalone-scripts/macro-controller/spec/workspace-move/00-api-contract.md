# Move-to-Workspace — API Contract (v2)

**Endpoint:** `PUT https://api.lovable.dev/projects/{projectId}/move-to-workspace`
**Updated:** 2026-06-21 from a live captured request on lovable.dev (Chrome 149, Windows).

## Required request shape

```http
PUT /projects/{projectId}/move-to-workspace HTTP/1.1
Host: api.lovable.dev
Content-Type: application/json
Authorization: Bearer <Firebase JWT>
x-castle-request-token: <one-shot Castle token>
x-browser-session-id: <bsess_…> (optional but sent by web app)
x-client-git-sha: <commit sha> (optional)
x-lov-platform: {"platform":"web","version":"<commit sha>"} (optional)
Origin: https://lovable.dev
Referer: https://lovable.dev/
Cookie: __cuid=…; cid=…   (sent automatically with credentials:'include')

{"workspace_id":"workspace_…"}
```

### Preflight (`OPTIONS`)
The browser sends a credentialed-CORS preflight before the PUT.
Lovable's CORS reflects the `Access-Control-Request-Headers` set, so the
preflight body has no auth — only the actual PUT carries the headers
above. We never craft the preflight ourselves; the browser does it.

## Mandatory headers (server enforced)

| Header | Why it is required |
|---|---|
| `Authorization: Bearer <jwt>` | Firebase identity. Without it: `401 Unauthorized`. |
| `x-castle-request-token` | Castle.io risk-engine guard. **NEW** — without it the server replies `403 { type: "castle_denied" }`. Tokens are single-use; mint one per call. |
| `Content-Type: application/json` | Body parser. |
| Cookies `__cuid` / `cid` | Castle device-id pair. Sent automatically when `credentials:'include'` (axios `withCredentials:true`). |

## Where the Castle token comes from

Lovable loads the Castle JS SDK on `https://lovable.dev/*`. The SDK
exposes a global function:

```ts
window._castle('createRequestToken'): Promise<string>
```

It returns a fresh one-shot token (length ~1800 chars). The macro
controller runs in MAIN world on lovable.dev, so it can call
`window._castle` directly (no postMessage bridge needed — see
`mem://architecture/injection-context-awareness`).

If Castle is not loaded (e.g. SDK blocked by an ad blocker, or the call
fires before the SDK loaded), the helper returns `''`, the PUT goes out
without the header, and the server responds `403 castle_denied`. We
surface that as a toast and stop — **no retry** per
`mem://constraints/no-retry-policy`. The user must complete a Castle
challenge on lovable.dev (verify email / 2FA / wait for cooldown) and
retry manually.

## Response classes

| Status | Meaning | Action |
|---|---|---|
| 200 | Move accepted | Refresh credit balance for source + target workspace; clear cached resolved workspace; toast success. |
| 401 | Bearer expired | Force-refresh token via `getBearerToken({ force: true })` and retry **once**. |
| 403 + body `{ type: "castle_denied" }` | Castle blocked the request (missing/invalid `x-castle-request-token` **or** account flagged) | Toast the Castle message; do NOT retry. |
| 403 (other) | Permission denied | Toast; do not retry. |
| 4xx/5xx other | Unknown failure | Log, toast, verify workspace session still valid. |

## Implementation pointers

- Helper: `standalone-scripts/macro-controller/src/castle-token.ts`
  exports `getCastleRequestToken(): Promise<string>`. 2 s timeout, never
  throws.
- Caller: `standalone-scripts/macro-controller/src/ws-move.ts` →
  `executeMove()` mints a token per attempt and passes it via the
  `headers` option to `marco.api.workspace.move()`.
- SDK plumbing: `standalone-scripts/marco-sdk/src/api.ts` already
  forwards `options.headers` to axios verbatim and keeps
  `withCredentials:true`, so cookies + custom header reach the wire
  unchanged.

## Compliance

- `mem://constraints/no-retry-policy` — single PUT per user action.
  Only the 401-refresh retry is permitted (already existed pre-Castle).
- `mem://standards/error-logging-via-namespace-logger` — Castle helper
  uses `logError(...)`; missing-SDK and timeout paths log via `log(...)`
  at `warn` level.
- `mem://architecture/injection-context-awareness` — `window._castle`
  is only reachable from MAIN world.
