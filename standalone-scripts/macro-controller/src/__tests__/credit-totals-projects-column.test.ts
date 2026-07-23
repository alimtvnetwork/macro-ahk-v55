/**
 * Credit Totals — project-count column + double-click navigation (Step 12).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildBreakdownTable, sortWorkspaces, type SortState }  from '../ui/credit-totals-modal';
import type { WorkspaceCredit } from '../types';

function ws(partial: Partial<WorkspaceCredit>): WorkspaceCredit {
  return {
    id: 'w', name: 'w', fullName: 'w',
    dailyFree: 0, dailyUsed: 0, dailyLimit: 5,
    rolloverUsed: 0, rolloverLimit: 0,
    freeGranted: 0, freeRemaining: 0,
    used: 0, limit: 0, topupLimit: 0,
    totalCredits: 0, available: 0, rollover: 0, billingAvailable: 0,
    hasFree: false, totalCreditsUsed: 0,
    subscriptionStatus: 'active', subscriptionStatusChangedAt: '',
    plan: 'pro_3', role: 'owner', tier: 'PRO',
    raw: {}, rawApi: {},
    numProjects: 0, gitSyncEnabled: false,
    nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
    membershipRole: 'owner', planType: 'monthly',
    ...partial,
  };
}

describe('sortWorkspaces by projects', () => {
  it('sorts by numProjects descending', () => {
    const input = [
      ws({ id: 'a', numProjects: 1 }),
      ws({ id: 'b', numProjects: 10 }),
      ws({ id: 'c', numProjects: 5 }),
    ];
    const out = sortWorkspaces(input, { key: 'projects', dir: 'desc' });
    expect(out.map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by numProjects ascending', () => {
    const input = [
      ws({ id: 'a', numProjects: 0 }),
      ws({ id: 'b', numProjects: 3 }),
      ws({ id: 'c', numProjects: 1 }),
    ];
    const out = sortWorkspaces(input, { key: 'projects', dir: 'asc' });
    expect(out.map((w) => w.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('buildBreakdownTable — projects column + double-click', () => {
  let table: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the Prj header', () => {
    table = buildBreakdownTable([ws({ id: 'x' })]);
    document.body.appendChild(table);
    const header = table.querySelector('[data-sort-key="projects"]');
    expect(header).not.toBeNull();
    expect(header?.textContent).toMatch(/Prj/);
  });

  it('renders numeric project count for each workspace', () => {
    table = buildBreakdownTable([
      ws({ id: 'a', numProjects: 7 }),
      ws({ id: 'b', numProjects: 0 }),
      ws({ id: 'c', numProjects: 12 }),
    ]);
    document.body.appendChild(table);
    const rows = table.querySelectorAll('[data-credit-totals-row]');
    const texts = Array.from(rows).map((r) => {
      const spans = r.querySelectorAll('span');
      // projects is the 3rd cell (index 2) after name and plan
      return spans[2]?.textContent ?? '';
    });
    expect(texts).toEqual(['7', '—', '12']);
  });

  it('attaches double-click handler that opens lovable.dev/projects', () => {
    const openSpy = vi.fn();
    const originalOpen = window.open;
    window.open = openSpy as unknown as typeof window.open;

    table = buildBreakdownTable([ws({ id: 'x' })]);
    document.body.appendChild(table);
    const row = table.querySelector('[data-credit-totals-row]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://lovable.dev/projects', '_blank', 'noopener');

    window.open = originalOpen;
  });
});
