/**
 * Unit tests — `needsBalanceEnrichment` (Plan-10 predicate).
 */

import { describe, it, expect } from 'vitest';
import { needsBalanceEnrichment } from '../needs-balance-enrichment';
import type { WorkspaceCredit } from '../../types/credit-types';

function ws(partial: Partial<Pick<WorkspaceCredit, 'id' | 'plan' | 'tier'>>): Pick<WorkspaceCredit, 'id' | 'plan' | 'tier'> {
  return { id: 'ws-1', plan: 'pro_1', tier: 'PRO', ...partial };
}

describe('needsBalanceEnrichment', () => {
  it('returns needs=true for pro_1 with no fresh cache', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: 'pro_1' }), hasFreshCache: false });
    expect(r).toEqual({ needs: true, reason: 'ok' });
  });

  it('returns needs=true for pro_0 with no fresh cache', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: 'pro_0' }), hasFreshCache: false });
    expect(r).toEqual({ needs: true, reason: 'ok' });
  });

  it('short-circuits when cache is fresh (skip network)', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: 'pro_1' }), hasFreshCache: true });
    expect(r).toEqual({ needs: false, reason: 'cache-fresh' });
  });

  it('rejects rows missing an id — never fires anonymous fetches', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ id: '' }), hasFreshCache: false });
    expect(r).toEqual({ needs: false, reason: 'no-id' });
  });

  it('rejects FREE tier by tier literal', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ tier: 'FREE', plan: 'pro_1' }), hasFreshCache: false });
    expect(r).toEqual({ needs: false, reason: 'free-tier' });
  });

  it('rejects FREE tier by plan literal (free)', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: 'free' }), hasFreshCache: false });
    expect(r).toEqual({ needs: false, reason: 'free-tier' });
  });

  it('rejects unknown / non-enrichable plans', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: 'enterprise_xl' }), hasFreshCache: false });
    expect(r).toEqual({ needs: false, reason: 'non-enrichable-plan' });
  });

  it('normalises case + whitespace on plan/tier', () => {
    const r = needsBalanceEnrichment({ workspace: ws({ plan: '  PRO_1  ', tier: ' pro ' }), hasFreshCache: false });
    expect(r.needs).toBe(true);
    expect(r.reason).toBe('ok');
  });

  it('decision order: no-id beats free-tier beats non-enrichable-plan beats cache-fresh', () => {
    // no-id short-circuits even with FREE tier + fresh cache present
    const r1 = needsBalanceEnrichment({
      workspace: { id: '  ', plan: 'free', tier: 'FREE' },
      hasFreshCache: true,
    });
    expect(r1.reason).toBe('no-id');

    // free-tier short-circuits before non-enrichable-plan branch
    const r2 = needsBalanceEnrichment({
      workspace: ws({ plan: 'weird_plan', tier: 'FREE' }),
      hasFreshCache: false,
    });
    expect(r2.reason).toBe('free-tier');

    // non-enrichable-plan short-circuits before cache-fresh
    const r3 = needsBalanceEnrichment({
      workspace: ws({ plan: 'enterprise_xl' }),
      hasFreshCache: true,
    });
    expect(r3.reason).toBe('non-enrichable-plan');
  });
});
