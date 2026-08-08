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

    (chrome.tabs as any).onCreated.addListener((tab: any) => {
        if (tab.url && tab.url !== "" && tab.id) {
            recentTabs.push({ tabId: tab.id, url: tab.url, timestamp: Date.now() });
            trimRecentTabs();
            void maybeInjectRecorder(tab.id);
        }
    });

    // Often tabs are created with pendingUrl or no URL, then immediately updated
    (chrome.tabs as any).onUpdated.addListener((tabId: any, changeInfo: any, tab: any) => {
        if (changeInfo.url && changeInfo.url !== "") {
            recentTabs.push({ tabId, url: changeInfo.url, timestamp: Date.now() });
            trimRecentTabs();
            void maybeInjectRecorder(tabId);
        }
    });
}

async function maybeInjectRecorder(tabId: number): Promise<void> {
    const sessionStr = await new Promise<string | undefined>(resolve => {
        chrome.storage.local.get("marco.recorder.session", data => resolve(data["marco.recorder.session"] as string | undefined));
    });
    // Check if recording is active
    if (sessionStr && typeof sessionStr === 'object' && (sessionStr as any).Phase === "Recording") {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ["content-scripts/xpath-recorder.js"]
            });
            console.log(`[Marco] Injected xpath-recorder.js into new tab ${tabId}`);
        } catch (e) {
            console.error(`[Marco] Failed to inject xpath-recorder.js into new tab ${tabId}:`, e);
        }
    }
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
