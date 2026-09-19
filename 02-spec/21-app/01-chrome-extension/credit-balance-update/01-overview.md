# 01 — Overview: Credit Balance Update for Lite / Free / Cancelled Plans

**Status:** Draft (2026-06-04)
**Owner:** Macro Controller
**Trigger:** User report — workspaces on `ktlo` (Lite), `free`, and `cancelled` plans
do not include credit information in the `/workspaces` payload, so the credit
columns render as `0/0`.
**Related memory:** `mem://features/macro-controller/pro-zero-credit-balance`
**Existing baseline:** `pro_0` already calls `/workspaces/{id}/credit-balance`
(see `standalone-scripts/macro-controller/src/pro-zero/`). This spec **extends**
that branch to three additional plans without forking the logic.

## Problem

`GET /workspaces` for a Lite/Free/Cancelled workspace returns no credit fields
(`billing_period_credits_limit = 0`, no `grant_type_balances`, etc.). The macro
controller’s credit panel then shows `0 / 0`, which is indistinguishable from
"out of credits" and breaks the Refill-soon filter, totals modal, and tooltip.

## Goal

Detect plans that require a per-workspace credit-balance lookup, call
`/workspaces/{WorkspaceId}/credit-balance` exactly once per refresh window, and
surface `totalRemaining / dailyRemaining / dailyLimit` in the existing UI
without changing the layout for `pro_0` / `pro_1` workspaces.

## Non-goals

- No retry loops (memory `no-retry-policy`).
- No new UI surface beyond the existing credit cells, tooltip, and modal.
- No change to PascalCase storage keys (memory `no-storage-pascalcase-migration`).

## Acceptance (verbatim from user)

1. Cancelled, Lite (`Ktlo`), and Free accounts show correct credit info.
2. Credit balance API is called only when workspace data lacks credit info.
3. Credit load respects the customisable delay (default 3 s).
4. Settings expose a slider to change the delay.
5. Enums exist for `Plan` and `GrantType`.
6. E2E, integration, and function-based tests cover the credit logic.
