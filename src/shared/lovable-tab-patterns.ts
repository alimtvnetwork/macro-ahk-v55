/**
 * Shared chrome.tabs.query() match patterns for Lovable platform tabs.
 *
 * Previously duplicated by convention in 4 files (auth-health-handler,
 * cookie-watcher, config-auth-handler, open-tabs-handler) with three
 * **different** subsets — open-tabs was missing `lovableproject.com`,
 * which is now fixed by importing this canonical list.
 *
 * Consolidated per plan.md "Open Lovable Tabs → Workspace Mapping" follow-up #4.
 *
 * To add a new platform host, update this array; the callers will inherit.
 * Modules that need additional hosts (e.g. `localhost` for dev tooling)
 * should `[...LOVABLE_TAB_PATTERNS, "http://localhost/*"]`.
 */
export const LOVABLE_TAB_PATTERNS: string[] = [
    "https://lovable.dev/*",
    "https://*.lovable.dev/*",
    "https://lovable.app/*",
    "https://*.lovable.app/*",
    "https://lovableproject.com/*",
    "https://*.lovableproject.com/*",
];
