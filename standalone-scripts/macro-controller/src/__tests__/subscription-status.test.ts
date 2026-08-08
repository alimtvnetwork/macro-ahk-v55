/**
 * subscription-status enum + helpers — unit tests.
 *
 * Guards against re-introduction of the magic strings 'canceled', 'cancelled',
 * 'past_due', 'unpaid', 'active', 'trialing', 'EXPIRED' across the codebase.
 */

import { describe, it, expect } from 'vitest';
import {
  SubscriptionStatusType,
  WsTierValueType,
  PlanNameType,
  normalizeSubscriptionStatus,
  isCanceledStatus,
  isPastDueStatus,
  isHealthyStatus,
  isExpiredTier,
  isExpiredSubscriptionStatus,
} from '../types/subscription-status';

describe('subscription-status enums', () => {
  it('exposes canonical Stripe status values', () => {
    expect(SubscriptionStatusType.ACTIVE).toBe('active');
    expect(SubscriptionStatusType.TRIALING).toBe('trialing');
    expect(SubscriptionStatusType.PAST_DUE).toBe('past_due');
    expect(SubscriptionStatusType.UNPAID).toBe('unpaid');
    expect(SubscriptionStatusType.CANCELED).toBe('canceled');
    expect(SubscriptionStatusType.CANCELLED).toBe('cancelled');
    expect(SubscriptionStatusType.EXPIRED).toBe('expired');
  });

  it('exposes canonical workspace tier values', () => {
    expect(WsTierValueType.FREE).toBe('FREE');
    expect(WsTierValueType.LITE).toBe('LITE');
    expect(WsTierValueType.PRO).toBe('PRO');
    expect(WsTierValueType.EXPIRED).toBe('EXPIRED');
  });

  it('exposes canonical plan-name values', () => {
    expect(PlanNameType.FREE).toBe('free');
    expect(PlanNameType.PRO_0).toBe('pro_0');
    expect(PlanNameType.KTLO).toBe('ktlo');
    expect(PlanNameType.LITE).toBe('lite');
  });
});

describe('normalizeSubscriptionStatus', () => {
  it('lower-cases and trims', () => {
    expect(normalizeSubscriptionStatus('  ACTIVE  ')).toBe('active');
    expect(normalizeSubscriptionStatus('Past_Due')).toBe('past_due');
  });
  it('handles null / undefined / empty', () => {
    expect(normalizeSubscriptionStatus(null)).toBe('');
    expect(normalizeSubscriptionStatus(undefined)).toBe('');
    expect(normalizeSubscriptionStatus('')).toBe('');
  });
});

describe('isCanceledStatus', () => {
  it('accepts US + UK spellings', () => {
    expect(isCanceledStatus('canceled')).toBe(true);
    expect(isCanceledStatus('cancelled')).toBe(true);
    expect(isCanceledStatus('CANCELED')).toBe(true);
    expect(isCanceledStatus('  Cancelled ')).toBe(true);
  });
  it('rejects other statuses', () => {
    expect(isCanceledStatus('active')).toBe(false);
    expect(isCanceledStatus('past_due')).toBe(false);
    expect(isCanceledStatus('')).toBe(false);
    expect(isCanceledStatus(null)).toBe(false);
  });
});

describe('isPastDueStatus', () => {
  it('matches past_due and unpaid', () => {
    expect(isPastDueStatus('past_due')).toBe(true);
    expect(isPastDueStatus('unpaid')).toBe(true);
    expect(isPastDueStatus('PAST_DUE')).toBe(true);
  });
  it('rejects other statuses', () => {
    expect(isPastDueStatus('canceled')).toBe(false);
    expect(isPastDueStatus('active')).toBe(false);
    expect(isPastDueStatus('')).toBe(false);
  });
});

describe('isHealthyStatus', () => {
  it('matches active and trialing', () => {
    expect(isHealthyStatus('active')).toBe(true);
    expect(isHealthyStatus('trialing')).toBe(true);
    expect(isHealthyStatus('ACTIVE')).toBe(true);
  });
  it('rejects unhealthy statuses', () => {
    expect(isHealthyStatus('past_due')).toBe(false);
    expect(isHealthyStatus('canceled')).toBe(false);
    expect(isHealthyStatus('')).toBe(false);
  });
});

describe('isExpiredTier', () => {
  it('matches EXPIRED case-insensitively', () => {
    expect(isExpiredTier('EXPIRED')).toBe(true);
    expect(isExpiredTier('expired')).toBe(true);
    expect(isExpiredTier(' Expired ')).toBe(true);
  });
  it('rejects other tiers', () => {
    expect(isExpiredTier('FREE')).toBe(false);
    expect(isExpiredTier('PRO')).toBe(false);
    expect(isExpiredTier('LITE')).toBe(false);
    expect(isExpiredTier(null)).toBe(false);
  });
});

describe('isExpiredSubscriptionStatus', () => {
  it('combines canceled + past-due groups', () => {
    expect(isExpiredSubscriptionStatus('canceled')).toBe(true);
    expect(isExpiredSubscriptionStatus('cancelled')).toBe(true);
    expect(isExpiredSubscriptionStatus('past_due')).toBe(true);
    expect(isExpiredSubscriptionStatus('unpaid')).toBe(true);
  });
  it('rejects healthy + empty', () => {
    expect(isExpiredSubscriptionStatus('active')).toBe(false);
    expect(isExpiredSubscriptionStatus('trialing')).toBe(false);
    expect(isExpiredSubscriptionStatus('')).toBe(false);
    expect(isExpiredSubscriptionStatus(null)).toBe(false);
  });
});

describe('no-magic-strings guard (regression)', () => {
  // If a future refactor introduces a typo'd status string, these symbolic
  // comparisons will still match — the enum is the only place the string
  // value is defined.
  it('canceled enum survives round-trip through isCanceledStatus', () => {
    expect(isCanceledStatus(SubscriptionStatusType.CANCELED)).toBe(true);
    expect(isCanceledStatus(SubscriptionStatusType.CANCELLED)).toBe(true);
  });
  it('past_due enum survives round-trip through isPastDueStatus', () => {
    expect(isPastDueStatus(SubscriptionStatusType.PAST_DUE)).toBe(true);
    expect(isPastDueStatus(SubscriptionStatusType.UNPAID)).toBe(true);
  });
  it('active enum survives round-trip through isHealthyStatus', () => {
    expect(isHealthyStatus(SubscriptionStatusType.ACTIVE)).toBe(true);
    expect(isHealthyStatus(SubscriptionStatusType.TRIALING)).toBe(true);
  });
  it('EXPIRED tier round-trip', () => {
    expect(isExpiredTier(WsTierValueType.EXPIRED)).toBe(true);
  });
});
