/**
 * project-id-from-url — unit tests (plan 13 step 5).
 *
 * Mocks the two upstream dependencies (`workspace-detection` and
 * `logging`) so we control what id/name the extractor sees, and asserts:
 *   - regex match on the plan-mandated pattern
 *   - identity combines both sources
 *   - rename-detection fires listeners exactly once per real change
 *   - first-seen name does NOT fire a rename event (no false positives)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockedId: string | null = null;
let mockedName: string | null = null;

vi.mock('../../workspace-detection', () => ({
  extractProjectIdFromUrl: vi.fn(() => mockedId),
}));

vi.mock('../../logging', () => ({
  getDisplayProjectName: vi.fn(() => mockedName),
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: vi.fn() };
});

import {
  LOVABLE_PROJECT_ID_REGEX,
  extractProjectIdFromString,
  resolveProjectIdentity,
  subscribeProjectNameChange,
  notifyIfProjectRenamed,
  _resetProjectIdentityStateForTests,
} from '../project-id-from-url';

beforeEach(() => {
  _resetProjectIdentityStateForTests();
  mockedId = null;
  mockedName = null;
});

describe('extractProjectIdFromString', () => {
  it('matches the plan-mandated /projects/<uuid> pattern', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    expect(extractProjectIdFromString(`https://lovable.dev/projects/${uuid}/edit`)).toBe(uuid);
  });

  it('returns null for non-project URLs', () => {
    expect(extractProjectIdFromString('https://lovable.dev/dashboard')).toBeNull();
    expect(extractProjectIdFromString('about:blank')).toBeNull();
  });

  it('regex is case-insensitive and captures group 1', () => {
    const match = 'https://x/PROJECTS/abcdef01-2345-6789-abcd-ef0123456789'.match(LOVABLE_PROJECT_ID_REGEX);
    expect(match?.[1]).toBe('abcdef01-2345-6789-abcd-ef0123456789');
  });
});

describe('resolveProjectIdentity', () => {
  it('combines id + name from the two upstream sources', () => {
    mockedId = 'proj-1';
    mockedName = 'Alpha';
    expect(resolveProjectIdentity()).toEqual({ projectId: 'proj-1', projectName: 'Alpha' });
  });

  it('null-safe when either source returns null', () => {
    expect(resolveProjectIdentity()).toEqual({ projectId: null, projectName: null });
  });
});

describe('subscribeProjectNameChange + notifyIfProjectRenamed', () => {
  it('does NOT fire on first-seen name (regression guard)', () => {
    const callback = vi.fn();
    subscribeProjectNameChange(callback);
    mockedId = 'proj-1';
    mockedName = 'Original';
    notifyIfProjectRenamed();
    expect(callback).not.toHaveBeenCalled();
  });

  it('fires exactly once when the name changes', () => {
    const callback = vi.fn();
    subscribeProjectNameChange(callback);
    mockedId = 'proj-1';
    mockedName = 'Original';
    notifyIfProjectRenamed(); // seed
    mockedName = 'Renamed';
    notifyIfProjectRenamed();
    notifyIfProjectRenamed(); // second call with same name → no-op
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('proj-1', 'Original', 'Renamed');
  });

  it('tracks names per projectId independently', () => {
    const callback = vi.fn();
    subscribeProjectNameChange(callback);
    mockedId = 'proj-A'; mockedName = 'A1'; notifyIfProjectRenamed();
    mockedId = 'proj-B'; mockedName = 'B1'; notifyIfProjectRenamed();
    mockedId = 'proj-A'; mockedName = 'A2'; notifyIfProjectRenamed();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('proj-A', 'A1', 'A2');
  });

  it('unsubscribe stops further notifications', () => {
    const callback = vi.fn();
    const unsub = subscribeProjectNameChange(callback);
    mockedId = 'proj-1'; mockedName = 'X'; notifyIfProjectRenamed();
    unsub();
    mockedName = 'Y'; notifyIfProjectRenamed();
    expect(callback).not.toHaveBeenCalled();
  });

  it('silently ignores calls with no projectId — never fires with a null id', () => {
    const callback = vi.fn();
    subscribeProjectNameChange(callback);
    mockedId = null; mockedName = 'Anything';
    notifyIfProjectRenamed();
    expect(callback).not.toHaveBeenCalled();
  });

  it('isolates listener exceptions — one bad listener does not break others', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    subscribeProjectNameChange(bad);
    subscribeProjectNameChange(good);
    mockedId = 'p'; mockedName = 'a'; notifyIfProjectRenamed();
    mockedName = 'b'; notifyIfProjectRenamed();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
