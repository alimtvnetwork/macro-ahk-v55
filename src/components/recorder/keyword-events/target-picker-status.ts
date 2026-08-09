import { SelectorStatusType } from "../../../types/enums";

export function classifySelector(kind: string, selectorText: string): SelectorStatusType {
    if (kind !== "Selector") { return "empty"; }
    const trimmed = selectorText.trim();
    if (trimmed === "") { return "empty"; }
    if (typeof document === "undefined") { return "no-match"; }
    try {
        const node = document.querySelector(trimmed);

        return node === null ? "no-match" : "match";
    } catch (err) { console.error("Automatically logged error:", err);
        return "invalid";
    }
}
