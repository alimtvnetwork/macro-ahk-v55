import { describe, it, expect } from "vitest";
import { isNewTabOrBlankUrl } from "../url-utils";

describe("isNewTabOrBlankUrl", () => {
    it.each([
        [undefined],
        [null],
        [""],
        ["  "],
        ["about:blank"],
        ["About:Blank"],
        ["about:blank/"],
        ["about:blank?x=1"],
        ["about:blank#frag"],
        ["chrome://newtab/"],
        ["chrome://newtab"],
        ["chrome://new-tab-page/"],
        ["chrome-search://local-ntp/local-ntp.html"],
        ["edge://newtab/"],
        ["brave://newtab/"],
        ["opera://startpage/"],
    ])("returns true for %p", (input) => {
        expect(isNewTabOrBlankUrl(input as string | undefined | null)).toBe(true);
    });

    it.each([
        ["https://example.com/"],
        ["https://lovable.dev/projects/abc"],
        ["http://localhost:3000"],
        ["https://example.com/newtab"],            // path that mentions newtab — NOT a new tab
        ["chrome-extension://abc/options.html"],   // extension page, not a new tab
        ["file:///home/user/index.html"],
        ["about:config"],
    ])("returns false for %p", (input) => {
        expect(isNewTabOrBlankUrl(input)).toBe(false);
    });
});
