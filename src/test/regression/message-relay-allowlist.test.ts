/**
 * message-relay-allowlist.test.ts
 *
 * Regression guard for the content-script relay allow-list.
 *
 * Root cause captured here (see .lovable/memory + rules.md):
 *   Every db/* module in standalone-scripts/macro-controller posts
 *   `sendToExtension('PROJECT_API', ...)` through the page/content-script
 *   bridge. The relay in `src/content-scripts/message-relay.ts` filters
 *   `event.data.type` against a static `ALLOWED_TYPES` allow-list before
 *   forwarding to the service worker. Dropping `PROJECT_API` from that
 *   set makes every Plan/Next/Generic DB call fail synchronously with
 *   `"Blocked disallowed message type: PROJECT_API"`, which surfaces as
 *   the red "Load error" rows in the Prompt Library modal.
 *
 * This test locks `PROJECT_API` into the allow-list at the source level
 * so a future edit to `ALLOWED_TYPES` cannot silently reintroduce the
 * regression.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RELAY_PATH = resolve(__dirname, "../../content-scripts/message-relay.ts");

describe("message-relay ALLOWED_TYPES allow-list", () => {
    const source = readFileSync(RELAY_PATH, "utf8");

    // Grab the ALLOWED_TYPES literal block.
    const match = source.match(/const ALLOWED_TYPES = new Set\(\[([\s\S]*?)\]\);/);

    it("declares an ALLOWED_TYPES Set literal", () => {
        expect(match).not.toBeNull();
    });

    it("includes PROJECT_API so role-scoped prompt DB calls are not blocked", () => {
        expect(match?.[1] ?? "").toContain('"PROJECT_API"');
    });

    it("still includes the SDK/prompt CRUD message types the extension depends on", () => {
        const body = match?.[1] ?? "";
        for (const required of [
            "GET_PROMPTS",
            "SAVE_PROMPT",
            "DELETE_PROMPT",
            "KV_GET",
            "KV_SET",
        ]) {
            expect(body).toContain(`"${required}"`);
        }
    });
});
