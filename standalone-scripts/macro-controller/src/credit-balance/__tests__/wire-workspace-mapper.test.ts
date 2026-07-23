/**
 * Unit tests — Plan-10 WireWorkspace → enrichment-candidate mapper.
 *
 * v4.130.0: mapper widened to async (`FreshCacheProbe` may be sync or
 * `Promise<boolean>`); tests updated to await and cover the async path.
 */

import { describe, it, expect } from 'vitest';
import {
  mapWireToEnrichmentCandidates,
  selectEnrichable,
} from '../wire-workspace-mapper';

const NEVER_FRESH = (): boolean => false;
const ALWAYS_FRESH = (): boolean => true;

describe('mapWireToEnrichmentCandidates', () => {
  it('drops shape-invalid rows and keeps typed ones', async () => {
    const rows = [
      { id: 'ws-1', plan: 'pro_1', tier: 'PRO', name: 'A' },
      null,
      { id: '' },
      'oops',
    ];
    const result = await mapWireToEnrichmentCandidates(rows, NEVER_FRESH);
    expect(result).toHaveLength(1);
    expect(result[0].workspace.id).toBe('ws-1');
    expect(result[0].verdict).toEqual({ needs: true, reason: 'ok' });
  });

  it('routes FREE tier to reason=free-tier (never enriches)', async () => {
    const result = await mapWireToEnrichmentCandidates(
      [{ id: 'ws-f', plan: 'free', tier: 'FREE', name: 'F' }],
      NEVER_FRESH,
    );
    expect(result[0].verdict).toEqual({ needs: false, reason: 'free-tier' });
  });

  it('respects fresh cache probe for pro_1 workspaces', async () => {
    const result = await mapWireToEnrichmentCandidates(
      [{ id: 'ws-1', plan: 'pro_1', tier: 'PRO', name: 'A' }],
      ALWAYS_FRESH,
    );
    expect(result[0].verdict.reason).toBe('cache-fresh');
    expect(result[0].verdict.needs).toBe(false);
  });

  it('marks non-enrichable plans (e.g. teams) as skipped', async () => {
    const result = await mapWireToEnrichmentCandidates(
      [{ id: 'ws-t', plan: 'teams', tier: 'PRO', name: 'T' }],
      NEVER_FRESH,
    );
    expect(result[0].verdict.reason).toBe('non-enrichable-plan');
  });

  it('awaits async (Promise-returning) freshness probes', async () => {
    const asyncProbe = (id: string): Promise<boolean> =>
      Promise.resolve(id === 'ws-fresh');
    const result = await mapWireToEnrichmentCandidates(
      [
        { id: 'ws-fresh', plan: 'pro_1', tier: 'PRO', name: 'F' },
        { id: 'ws-stale', plan: 'pro_1', tier: 'PRO', name: 'S' },
      ],
      asyncProbe,
    );
    expect(result[0].verdict.reason).toBe('cache-fresh');
    expect(result[0].verdict.needs).toBe(false);
    expect(result[1].verdict.reason).toBe('ok');
    expect(result[1].verdict.needs).toBe(true);
  });
});

describe('selectEnrichable', () => {
  it('keeps only verdict.needs=true rows', async () => {
    const raw = [
      { id: 'a', plan: 'pro_1', tier: 'PRO' },
      { id: 'b', plan: 'free', tier: 'FREE' },
      { id: 'c', plan: 'pro_0', tier: 'PRO' },
    ];
    const enrichable = selectEnrichable(await mapWireToEnrichmentCandidates(raw, NEVER_FRESH));
    expect(enrichable.map((c) => c.workspace.id)).toEqual(['a', 'c']);
  });
});
