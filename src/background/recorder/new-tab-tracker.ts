/**
 * Marco Extension — New Tab Tracker
 * 
 * Tracks recently opened tabs so that the capture handler can retroactively
 * or delayed-ly promote a Click to a UrlTabClick if a tab opened within 200ms.
 */

interface RecentTab {
    readonly tabId: number;
    readonly url: string;
    readonly timestamp: number;
}

const recentTabs: RecentTab[] = [];

export function startNewTabTracker(): void {
    if (typeof chrome === "undefined" || !chrome.tabs) return;

    chrome.tabs.onCreated.addListener((tab) => {
        if (tab.url && tab.url !== "" && tab.id) {
            recentTabs.push({ tabId: tab.id, url: tab.url, timestamp: Date.now() });
            trimRecentTabs();
        }
    });

    // Often tabs are created with pendingUrl or no URL, then immediately updated
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url && changeInfo.url !== "") {
            recentTabs.push({ tabId, url: changeInfo.url, timestamp: Date.now() });
            trimRecentTabs();
        }
    });
}

function trimRecentTabs(): void {
    if (recentTabs.length > 50) {
        recentTabs.splice(0, recentTabs.length - 50);
    }
}

/**
 * Returns the URL of the most recently created tab since the given timestamp.
 * Includes a small 500ms buffer for clock skew or early tab creation.
 */
export function getRecentlyOpenedTabUrl(sinceTimestampMs: number): string | undefined {
    const cutoff = sinceTimestampMs - 500;
    const recent = recentTabs.filter(t => t.timestamp >= cutoff);
    if (recent.length === 0) return undefined;
    // Return the latest
    return recent[recent.length - 1].url;
}
