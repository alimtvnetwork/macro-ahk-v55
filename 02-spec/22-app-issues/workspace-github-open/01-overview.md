# Workspace → "Open GitHub Repo" (right-click)

**Status:** Draft (planning)
**Targets:** `ws-context-menu.ts`, new `gitsync-cache.ts`, sqlite schema.
**Version target:** `v3.10.0`.

---

## 1. Goal

Right-click on a workspace row in the Macro Controller workspace dropdown
shows a context menu with **"🐙 Open GitHub repo"**. Clicking it:

1. Looks up the cached gitsync info for (`workspaceId`, `projectId`).
2. If cached & `RepoUrl` present → `window.open(RepoUrl, '_blank')`.
3. If cached & marked `not_linked` (negative result) → toast
   "No GitHub repo linked for this project" — **do not refetch**.
4. If not cached → `GET /workspaces/:wsId/projects/:projectId/gitsync`,
   parse JSON, persist, then open or toast as above.

---

## 2. Negative-result caching (mandatory)

The `gitsync` endpoint may legitimately return `{ synced: false }` or
`config: null`. The user explicitly required: **mark the negative outcome
in the database so we never fire the same request twice for that project**.

`Status` column values:
- `found` — `config.repo_url` is a non-empty string; cached forever (until
  user invalidates via "Refresh gitsync" submenu item).
- `not_linked` — endpoint succeeded but no repo; cached for 24h then
  re-checked on demand.
- `error` — HTTP failure; cached for 5 min only (transient).

No exponential backoff / retry loop — single fetch per click, per memory
core rule "No-Retry Policy".

---

## 3. Database — `WorkspaceGitsyncCache` table

PascalCase column names (per existing storage convention, memory
`mem://constraints/no-storage-pascalcase-migration` permits new tables):

| Column | Type | Notes |
|---|---|---|
| `WorkspaceId` | TEXT | composite PK part 1 |
| `ProjectId` | TEXT | composite PK part 2 |
| `Status` | TEXT | `found` / `not_linked` / `error` |
| `RepoUrl` | TEXT | NULL when Status != `found` |
| `RepoName` | TEXT | NULL when Status != `found` |
| `OwnerName` | TEXT | NULL when Status != `found` |
| `ProviderType` | TEXT | NULL when Status != `found` (`github` etc.) |
| `ConnectionId` | TEXT | NULL when Status != `found` |
| `Synced` | INTEGER | 0/1 |
| `FetchedAt` | TEXT | ISO8601 UTC |
| `ExpiresAt` | TEXT | ISO8601 UTC — TTL boundary (found = +∞ sentinel, not_linked = +24h, error = +5m) |

Migration script: `standalone-scripts/macro-controller/src/db/migrations/`
adds the table on first read. Uses existing SQLite layer.

---

## 4. Right-click menu wiring

Existing `ws-context-menu.ts` (308 lines) already builds a context menu on
workspace rows for switch / rename / copy ID. Add a new entry below
"Copy workspace ID":

```
─────────────
🐙 Open GitHub repo
↻ Refresh gitsync
```

`Refresh gitsync` deletes the cache row for that (wsId, pid) and re-fetches.

---

## 5. API request — reference sample

`GET https://api.lovable.dev/workspaces/{wsId}/projects/{pid}/gitsync`

See `02-api-sample.md` (request + JSON sample preserved verbatim per
user instruction).

Authentication: `Authorization: Bearer <token>` via
`getBearerToken()` (per memory `mem://auth/unified-auth-contract` —
single-path contract, no legacy fallbacks).

---

## 6. Failure handling

- No bearer token → toast "Login required to open GitHub", cache nothing.
- HTTP 4xx → cache `Status='not_linked'` with 24h TTL.
- HTTP 5xx / network → cache `Status='error'` with 5m TTL.
- Malformed JSON → `Status='error'` 5m TTL + namespace logger
  `Logger.error()` with full body snippet (per memory `mem://standards/error-logging-via-namespace-logger.md`).

---

## 7. Non-regressions

- All existing context-menu entries work unchanged.
- No automatic prefetch on row hover — strictly user-initiated.
- Manifest `host_permissions` already covers `https://api.lovable.dev/*`
  — no new permissions needed.
