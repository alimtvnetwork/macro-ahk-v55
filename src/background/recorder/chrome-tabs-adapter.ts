import type { TabsAdapter, TabRef } from "./url-tab-click";

export class ChromeTabsAdapter implements TabsAdapter {
    async listTabs(): Promise<ReadonlyArray<TabRef>> {
        const tabs = await (chrome.tabs as any).query({});

        return tabs.map((t: any) => ({
            Id: t.id!,
            Url: t.url || t.pendingUrl || "",
        }));
    }

    async focusTab(id: number): Promise<void> {
        await (chrome.tabs as any).update(id, { active: true });
        const tab = await (chrome.tabs as any).get(id);
        if (tab.windowId) {
            await (chrome as any).windows.update(tab.windowId, { focused: true });
        }
    }

    async createTab(url: string): Promise<TabRef> {
        const tab = await (chrome.tabs as any).create({ url, active: true });

        return { Id: tab.id!, Url: tab.url || tab.pendingUrl || "" };
    }

    async waitForMatchingTab(
        predicate: (url: string) => boolean,
        deadlineMs: number,
    ): Promise<TabRef | null> {
        const start = Date.now();
        while (Date.now() < deadlineMs) {
            const tabs = await this.listTabs();
            for (const tab of tabs) {
                if (predicate(tab.Url)) {
                    return tab;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return null;
    }
}
