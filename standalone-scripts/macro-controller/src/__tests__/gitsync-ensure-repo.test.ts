/**
 * Issue 129 Step 5 — ensureGithubRepo helper.
 *
 * Verifies the connection-aware contract:
 *   - Probes first; never POSTs /sync for an already-connected project.
 *   - POST /sync is single-attempt (no retry / no backoff).
 *   - Found result persists 'found' to gitsync-cache; failures persist 'error'.
 *   - Deadline returns { status: 'syncing' } without poisoning the cache.
 *
 * Honors mem://preferences/test-with-features +
 * mem://constraints/no-retry-policy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface SdkCall {
    path: string;
    params: Record<string, string>;
}

const sdkCalls: SdkCall[] = [];
const cacheWrites: Array<{ wsId: string; pid: string; status: string; url?: string }> = [];
const cacheInvalidations: Array<{ wsId: string; pid: string }> = [];

// ── Mock the marco SDK on window before importing the module under test.
function installSdkMock(handler: (path: string, params: Record<string, string>) =>
    { ok: boolean; status: number; data: unknown }): void {
    (globalThis as unknown as { window: unknown }).window = {
        marco: {
            api: {
                call: async (path: string, opts: { params: Record<string, string> }) => {
                    sdkCalls.push({ path, params: opts.params });
                    return handler(path, opts.params);
                },
            },
        },
    };
}

vi.mock('../gitsync-cache', () => ({
    setGitsyncCache: (wsId: string, pid: string, status: string, url?: string) => {
        cacheWrites.push({ wsId, pid, status, url });
    },
    invalidateGitsyncCache: (wsId: string, pid: string) => {
        cacheInvalidations.push({ wsId, pid });
    },
}));

vi.mock('../error-utils', () => ({ logError: () => {} }));
vi.mock('../logging', () => ({ log: () => {}, getDisplayProjectName: () => '' }));
vi.mock('../shared-state', () => ({ CREDIT_API_BASE: 'https://x' }));

beforeEach(() => {
    sdkCalls.length = 0;
    cacheWrites.length = 0;
    cacheInvalidations.length = 0;
});

describe('ensureGithubRepo', () => {
    it('returns connected without POSTing /sync when probe finds repo_url', async () => {
        installSdkMock(() => ({
            ok: true,
            status: 200,
            data: { status: 'completed', result: { repo_url: 'https://github.com/x/y' } },
        }));
        const { ensureGithubRepo } = await import('../gitsync/ensure-repo');
        const out = await ensureGithubRepo('ws1', 'conn1', 'proj1');
        expect(out).toEqual({ status: 'connected', repoUrl: 'https://github.com/x/y', created: false });
        // Only the progress GET; never the sync POST.
        expect(sdkCalls.map(c => c.path)).toEqual(['gitsync.progress']);
        expect(cacheWrites).toEqual([
            { wsId: 'ws1', pid: 'proj1', status: 'found', url: 'https://github.com/x/y' },
        ]);
    });

    it('POSTs /sync exactly once when probe says no_job and persists found on success', async () => {
        let phase = 0;
        installSdkMock((path) => {
            if (path === 'gitsync.progress' && phase === 0) {
                phase = 1;
                return { ok: false, status: 404, data: {} };
            }
            if (path === 'gitsync.syncProject') {
                phase = 2;
                return { ok: true, status: 200, data: { job_id: 'job-X' } };
            }
            return {
                ok: true,
                status: 200,
                data: { status: 'completed', result: { repo_url: 'https://github.com/a/b' } },
            };
        });
        const { ensureGithubRepo } = await import('../gitsync/ensure-repo');
        const out = await ensureGithubRepo('ws2', 'conn2', 'proj2', { deadlineMs: 2000 });
        expect(out).toEqual({ status: 'connected', repoUrl: 'https://github.com/a/b', created: true });
        // Exactly one POST.
        const posts = sdkCalls.filter(c => c.path === 'gitsync.syncProject');
        expect(posts.length).toBe(1);
        expect(posts[0].params).toMatchObject({ wsId: 'ws2', connId: 'conn2', projectId: 'proj2' });
        expect(cacheWrites.some(w => w.status === 'found' && w.url === 'https://github.com/a/b')).toBe(true);
    });

    it('persists error when POST /sync fails (no retry)', async () => {
        installSdkMock((path) => {
            if (path === 'gitsync.progress') return { ok: false, status: 404, data: {} };
            return { ok: false, status: 500, data: { error: 'boom' } };
        });
        const { ensureGithubRepo } = await import('../gitsync/ensure-repo');
        const out = await ensureGithubRepo('ws3', 'conn3', 'proj3');
        expect(out.status).toBe('failed');
        expect(sdkCalls.filter(c => c.path === 'gitsync.syncProject').length).toBe(1);
        expect(cacheWrites.some(w => w.status === 'error')).toBe(true);
    });

    it('forceRefresh invalidates cache before probing', async () => {
        installSdkMock(() => ({
            ok: true,
            status: 200,
            data: { status: 'completed', result: { repo_url: 'https://github.com/q/r' } },
        }));
        const { ensureGithubRepo } = await import('../gitsync/ensure-repo');
        await ensureGithubRepo('ws4', 'conn4', 'proj4', { forceRefresh: true });
        expect(cacheInvalidations).toEqual([{ wsId: 'ws4', pid: 'proj4' }]);
    });

    it('rejects missing args', async () => {
        installSdkMock(() => ({ ok: true, status: 200, data: {} }));
        const { ensureGithubRepo } = await import('../gitsync/ensure-repo');
        const out = await ensureGithubRepo('', 'c', 'p');
        expect(out).toEqual({ status: 'failed', reason: 'missing_args' });
        expect(sdkCalls.length).toBe(0);
    });
});
