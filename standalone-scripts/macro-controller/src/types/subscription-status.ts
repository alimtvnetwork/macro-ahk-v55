/**
 * Subscription Status & Tier Enums — single source of truth
 *
 * Eliminates repeated magic strings ('canceled', 'cancelled', 'past_due',
 * 'unpaid', 'active', 'trialing', 'expired', 'EXPIRED', 'PRO', 'FREE', …)
 * scattered across credit-parser, workspace-status, status-explainer,
 * ws-hover-card, ws-list-renderer, etc.
 *
 * Per `mem://architecture/constant-naming-convention` and
 * `mem://standards/unknown-usage-policy`: SCREAMING_SNAKE_CASE constants,
 * fully-typed helpers, no `unknown` casts.
 *
 * Spec: spec/22-app-issues/118-past-due-expire-countdown-and-progress-bar.md
 */

/** Canonical Stripe subscription_status values returned by Lovable's billing API. */
export const enum SubscriptionStatusType {
  ACTIVE     = 'active',
  TRIALING   = 'trialing',
  PAST_DUE   = 'past_due',
  UNPAID     = 'unpaid',
  CANCELED   = 'canceled',
  /** British spelling — Stripe historically emitted both. Treat as alias of CANCELED. */
  CANCELLED  = 'cancelled',
  EXPIRED    = 'expired',
  INCOMPLETE = 'incomplete',
}

/** Derived workspace tier (computed by resolveWsTier). */
export const enum WsTierValueType {
  FREE    = 'FREE',
  LITE    = 'LITE',
  PRO     = 'PRO',
  EXPIRED = 'EXPIRED',
}

/** PlanTierType-name strings (lowercase) emitted by the workspace API. */
export const enum PlanNameType {
  FREE  = 'free',
  PRO_0 = 'pro_0',
  KTLO  = 'ktlo',
  LITE  = 'lite',
}

/* ------------------------------------------------------------------ */
/*  Normalisation + group predicates                                  */
/* ------------------------------------------------------------------ */

/** Lower-case + trim a subscription status string for safe comparison. */
export function normalizeSubscriptionStatus(s: string | null | undefined): string {
  return (s || '').toLowerCase().trim();
}

/** True for canceled / cancelled (US + UK spelling). */
export function isCanceledStatus(s: string | null | undefined): boolean {
  const n = normalizeSubscriptionStatus(s);

  return n === SubscriptionStatusType.CANCELED || n === SubscriptionStatusType.CANCELLED;
}

/** True for past_due / unpaid — Stripe's "needs payment, grants still live" states. */
export function isPastDueStatus(s: string | null | undefined): boolean {
  const n = normalizeSubscriptionStatus(s);

  return n === SubscriptionStatusType.PAST_DUE || n === SubscriptionStatusType.UNPAID;
}

/** True for active / trialing — healthy subscriptions. */
export function isHealthyStatus(s: string | null | undefined): boolean {
  const n = normalizeSubscriptionStatus(s);

  return n === SubscriptionStatusType.ACTIVE || n === SubscriptionStatusType.TRIALING;
}

/** True when the workspace tier string represents the EXPIRED tier. */
export function isExpiredTier(tier: string | null | undefined): boolean {
  return (tier || '').toUpperCase().trim() === WsTierValueType.EXPIRED;
}

/**
 * True when the workspace tier resolves to FREE. Free workspaces never carry a
 * paid subscription, so any `canceled` / `expired` subscription_status on them
 * is a no-op and must NOT surface as an Expired/Canceled badge anywhere in the
 * UI (Issue: free-plan expiry suppression).
 */
export function isFreeTier(tier: string | null | undefined): boolean {
  return (tier || '').toUpperCase().trim() === WsTierValueType.FREE;
}

/**
 * Aggregate: subscription_status indicates the workspace is in any
 * expired-ish state (canceled OR past_due OR unpaid). Used by
 * `isExpiredWs` filter / sort logic.
 */
export function isExpiredSubscriptionStatus(s: string | null | undefined): boolean {
  return isCanceledStatus(s) || isPastDueStatus(s);
}
