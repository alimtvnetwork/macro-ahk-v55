
# Plan: New Workspace-Move Endpoint + {{n}} Next-Button Fix

## Confirmation of understanding

Yes, I understand the codebase and can make changes safely:

- **Prompts**: canonical bodies in `standalone-scripts/prompts/NN-<slug>/{prompt.md,info.json}`, human mirrors in `.lovable/prompts/`, aggregated by `scripts/aggregate-prompts.mjs` into `03-macro-prompts.json`. `{{n}}` is substituted by `standalone-scripts/macro-controller/src/utils/token-substitute.ts` and consumed by `next-inline-ui.ts`, `task-next-ui.ts`, `plan-task-ui.ts`, `plan-next-prompts.ts`. Rule-zero validator and prompt-health-check enforce its presence in `plan` and `next` role bodies.
- **Releases**: driven by `.lovable/how-to-release.md` (checked, no rewrite needed, see step 1). Only `version.json` is edited; MINOR is the default; log skipped steps under `.lovable/release/issues/`.
- **Workspace move**: currently `PUT /projects/{projectId}/move-to-workspace` via `marco-sdk` registry `workspace.move`, called from `ws-move.ts::executeMove()` with a Castle token header. The new server contract is membership-scoped and replaces this route.

## Note on the fetch you pasted

The snippet shows `method: "OPTIONS"` with `body: null` and `credentials: "omit"`. That is the browser's **CORS preflight**, automatically emitted before the real credentialed call, not the move itself. The real request is the one that follows (with `Authorization`, `credentials: "include"`, and a real method + body). I will code against the conventional Lovable shape and mark it `PENDING-VERIFY` in the registry, exactly like the `memberships.invite/remove/updateRole` entries already do. First live call will confirm; a wrong verb = one-line registry edit.

Working assumption for path + verb (to be confirmed on first live call):

```
PUT https://api.lovable.dev/workspaces/{targetWorkspaceId}/memberships/{currentUserId}
Body: { "workspace_id": "{targetWorkspaceId}" }        # placeholder, may be empty
Headers: Authorization: Bearer <jwt>, x-castle-request-token: <token>, Content-Type: application/json
Credentials: include
```

## Deliverables

### 1. Read + audit `.lovable/how-to-release.md`

Read the file end-to-end and confirm no change needed. If gaps are found (e.g. missing note that new membership-scoped endpoints must be PENDING-VERIFY tagged), add a single "Endpoint changes" subsection. Otherwise leave untouched and record "no change" in the plan progress log.

### 2. New spec: `standalone-scripts/macro-controller/spec/workspace-move/01-membership-scoped-api-v2.md`

Content:
- Old contract (link to `00-api-contract.md`) marked deprecated.
- New endpoint shape (path, headers, cookies, castle token requirement carries over).
- User-supplied fetch snippet reproduced verbatim under "Captured preflight".
- Explicit PENDING-VERIFY block listing what the first live call must confirm: HTTP verb, request body keys, response body shape, castle-denied still returns `{type:"castle_denied"}`.
- Response class table copied from v1, plus a new row for `404` (membership not found → user must be a member of target workspace first).
- Invariants unchanged: single call site (`executeMove`), no retry beyond one auth-refresh, awaited post-move credit refresh.

### 3. New memory: `.lovable/memory/features/workspace-move-membership-endpoint-v2.md`

Frontmatter `type: feature`. Body:
- Status: pending live-call verification.
- Where it is wired (registry entry name, ws-move.ts call site).
- What changed vs v1 (project-scoped → membership-scoped path; project id no longer in URL; user id required from bearer or `/user/me`).
- Do-not list: do not resurrect `PUT /projects/{id}/move-to-workspace`; do not remove castle-token header; do not add generic retry.
- Link to spec 01 above.

Add reference line to `.lovable/memory/index.md` under Memories.

### 4. Registry + code changes

`standalone-scripts/marco-sdk/src/api-registry.ts`:
- Add `workspace.moveV2` entry:
  ```ts
  moveV2: { url: "/workspaces/{wsId}/memberships/{userId}", method: "PUT", auth: true,
            description: "Move project to workspace (v2, membership-scoped) — PENDING-VERIFY",
            timeoutMs: 15_000 }
  ```
- Keep `workspace.move` (v1) in place for one release as a rollback lever, mark with a `// DEPRECATED 2026-07-23 — see spec workspace-move/01` comment.

`standalone-scripts/marco-sdk/src/api.ts` (or the workspace facade):
- Add `workspace.moveV2(wsId, userId, opts)` that resolves params + forwards headers, same signature contract as `move`.

`standalone-scripts/macro-controller/src/ws-move.ts`:
- Introduce `resolveCurrentUserId()` helper. Source order: existing decoded-JWT util if present, else `state.currentUserId`, else `GET /user/me`. Cache per session.
- Replace `window.marco!.api!.workspace.move(projectId, targetWorkspaceId, …)` with `window.marco!.api!.workspace.moveV2(targetWorkspaceId, currentUserId, …)` inside `executeMove()`.
- Keep castle-token flow, auth-retry, castle-denied handling, and post-move `fetchAndPersist` unchanged.
- Update log lines from `PUT /projects/…/move-to-workspace` to the new path.
- File stays ≤100 lines per function; extract `resolveCurrentUserId` to its own file if `ws-move.ts` grows past its budget.

### 5. Fix `{{n}}` next-button substitution

Investigation-first (already partially mapped in memory `prompts-authoring-and-release`). Steps:
1. Read `next-inline-ui.ts`, `task-next-ui.ts`, and `token-substitute.ts` to identify why the replacement produces literal `{{n}}` in the composer.
2. Common root causes to check in order: (a) substitution called before `n` is resolved, (b) prompt body pulled from a cached bundle that predates the token, (c) the button copies the raw canonical body instead of the substituted body.
3. Fix the smallest layer that satisfies all four call sites; add a regression test alongside existing `next-tasks-prompt.e2e.test.ts` covering "click next N times, expect prompt to contain N and never `{{n}}`".

If root cause turns out to require prompt-body edits, update canonical + mirror byte-identically and regenerate the bundle (per how-to-release rule).

### 6. Verification (build mode)

- `bunx vitest run` (all suites).
- `bun run build:macro-controller` (or project equivalent) to confirm the SDK + controller bundle compile.
- Manual smoke: reload extension, trigger move on a test project, capture network in devtools, and reconcile actual verb + body against the PENDING-VERIFY block in spec 01. Patch registry entry if reality differs.
- Manual smoke: click Next button twice, confirm composer shows `next 2` (or equivalent), not `next {{n}}`.

### 7. No release this turn

Version bump only if the user says `release`. Follow `how-to-release.md` verbatim when they do.

## Order of execution

1. Read `how-to-release.md` (audit only).
2. Write spec 01.
3. Write memory file + update index.
4. Registry + SDK facade + `ws-move.ts` edits.
5. `{{n}}` investigation + fix + test.
6. Run typecheck, lint, vitest.
7. Report findings; wait for user to trigger a live move so the PENDING-VERIFY block can be confirmed.

## Risk + rollback

- Wrong verb/body → server returns 4xx on first click; registry entry is one-line editable; v1 route still exists as rollback.
- User-id resolution failure → move aborts with the existing "auth token missing" toast path; no data loss.
- `{{n}}` fix regressing other prompts → guarded by existing `prompt-parity-check.test.ts` and new regression test.
