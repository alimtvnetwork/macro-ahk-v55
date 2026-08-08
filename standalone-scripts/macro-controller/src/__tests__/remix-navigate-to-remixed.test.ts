import { DomainConstants } from "../constants/domain";
/**
 * Issue 129 Step 7 — Navigate active tab to remixed project.
 *
 * Verifies:
 *   - normalizeRedirectUrl resolves relative paths against origin.
 *   - Non-http(s) schemes (javascript:, data:) are rejected.
 *   - Empty / malformed inputs return null.
 *   - navigateActiveTabToRemixedProject calls window.location.assign with
 *     the absolute URL and returns true on success.
 *   - Rejected URLs return false without calling assign.
 *   - navigateFromCachedRemix forwards the RedirectUrl from the cached row.
 *
 * Honors mem://preferences/test-with-features.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const assignCalls: string[] = [];

function installWindow(origin: string): void {
    (globalThis as unknown as { window: unknown }).window = {
        location: {
            origin,
            assign: (url: string) => { assignCalls.push(url); },
        },
    };
}

vi.mock('../error-utils', () => ({ logError: () => {} }));
vi.mock('../logging', () => ({ log: () => {} }));

beforeEach(() => {
    assignCalls.length = 0;
});

describe('normalizeRedirectUrl', () => {
    it('resolves relative paths against origin', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { normalizeRedirectUrl } = await import('../remix/navigate-to-remixed');
        expect(normalizeRedirectUrl('/projects/abc', DomainConstants.PRIMARY_URL))
            .toBe('https://lovable.dev/projects/abc');
    });

    it('passes through absolute http(s) URLs', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { normalizeRedirectUrl } = await import('../remix/navigate-to-remixed');
        expect(normalizeRedirectUrl('https://lovable.dev/projects/x', 'https://x'))
            .toBe('https://lovable.dev/projects/x');
        expect(normalizeRedirectUrl('http://localhost:3000/p/1', 'https://x'))
            .toBe('http://localhost:3000/p/1');
    });

    it('rejects javascript:, data:, file:, blob: schemes', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { normalizeRedirectUrl } = await import('../remix/navigate-to-remixed');
        expect(normalizeRedirectUrl('javascript:alert(1)', DomainConstants.PRIMARY_URL)).toBeNull();
        expect(normalizeRedirectUrl('data:text/html,x', DomainConstants.PRIMARY_URL)).toBeNull();
        expect(normalizeRedirectUrl('file:///etc/passwd', DomainConstants.PRIMARY_URL)).toBeNull();
    });

    it('rejects empty/blank input', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { normalizeRedirectUrl } = await import('../remix/navigate-to-remixed');
        expect(normalizeRedirectUrl('', DomainConstants.PRIMARY_URL)).toBeNull();
        expect(normalizeRedirectUrl('   ', DomainConstants.PRIMARY_URL)).toBeNull();
    });
});

describe('navigateActiveTabToRemixedProject', () => {
    it('calls window.location.assign with the absolute URL', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { navigateActiveTabToRemixedProject } = await import('../remix/navigate-to-remixed');
        const ok = navigateActiveTabToRemixedProject('/projects/new-1');
        expect(ok).toBe(true);
        expect(assignCalls).toEqual(['https://lovable.dev/projects/new-1']);
    });

    it('returns false and does not assign when URL is rejected', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { navigateActiveTabToRemixedProject } = await import('../remix/navigate-to-remixed');
        const ok = navigateActiveTabToRemixedProject('javascript:alert(1)');
        expect(ok).toBe(false);
        expect(assignCalls.length).toBe(0);
    });

    it('returns false when window.location is unavailable', async () => {
        (globalThis as unknown as { window: unknown }).window = {};
        const { navigateActiveTabToRemixedProject } = await import('../remix/navigate-to-remixed');
        const ok = navigateActiveTabToRemixedProject('https://lovable.dev/projects/x');
        expect(ok).toBe(false);
    });
});

describe('navigateFromCachedRemix', () => {
    it('navigates using the RedirectUrl of a cached row', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { navigateFromCachedRemix } = await import('../remix/navigate-to-remixed');
        const ok = navigateFromCachedRemix({
            SourceProjectId: 's', NewProjectId: 'n',
            RedirectUrl: '/projects/n', WorkspaceId: 'w',
            ProjectName: 'p', RemixedAtMs: 1,
        });
        expect(ok).toBe(true);
        expect(assignCalls).toEqual(['https://lovable.dev/projects/n']);
    });

    it('returns false for null row or missing RedirectUrl', async () => {
        installWindow(DomainConstants.PRIMARY_URL);
        const { navigateFromCachedRemix } = await import('../remix/navigate-to-remixed');
        expect(navigateFromCachedRemix(null)).toBe(false);
        expect(navigateFromCachedRemix({
            SourceProjectId: 's', NewProjectId: 'n', RedirectUrl: '',
            WorkspaceId: 'w', ProjectName: 'p', RemixedAtMs: 1,
        })).toBe(false);
    });
});
