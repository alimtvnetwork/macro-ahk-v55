/**
 * Unit tests — WireWorkspaceLifecycle sibling narrowing surface.
 */

import { describe, it, expect } from 'vitest';
import { toWireWorkspaceLifecycle } from '../wire-workspace-lifecycle';

describe('toWireWorkspaceLifecycle', () => {
  it('reads every lifecycle string field + nested membership.role + gitsync flag', () => {
    const out = toWireWorkspaceLifecycle({
      subscription_status: 'active',
      subscription_status_changed_at: '2026-06-01T00:00:00Z',
      role: 'admin',
      plan_type: 'monthly',
      next_monthly_credit_grant_date: '2026-08-01',
      billing_period_end_date: '2026-08-01',
      created_at: '2025-01-15',
      num_projects: 7,
      experimental_features: { gitsync_github: true },
      membership: { role: 'owner' },
    });
    expect(out).toEqual({
      subscription_status: 'active',
      subscription_status_changed_at: '2026-06-01T00:00:00Z',
      role: 'admin',
      plan_type: 'monthly',
      next_monthly_credit_grant_date: '2026-08-01',
      billing_period_end_date: '2026-08-01',
      created_at: '2025-01-15',
      num_projects: 7,
      gitsync_github_enabled: true,
      membership_role: 'owner',
    });
  });

  it('defaults every field safely when the row is empty / non-object nested', () => {
    const out = toWireWorkspaceLifecycle({
      experimental_features: null as unknown as Record<string, unknown>,
      membership: 'nope' as unknown as Record<string, unknown>,
    });
    expect(out.subscription_status).toBe('');
    expect(out.role).toBe('');
    expect(out.plan_type).toBe('');
    expect(out.num_projects).toBe(0);
    expect(out.gitsync_github_enabled).toBe(false);
    expect(out.membership_role).toBe('');
  });

  it('treats gitsync_github !== true as false (strict boolean, not truthy)', () => {
    const out = toWireWorkspaceLifecycle({
      experimental_features: { gitsync_github: 'true' as unknown as boolean },
    });
    expect(out.gitsync_github_enabled).toBe(false);
  });
});
