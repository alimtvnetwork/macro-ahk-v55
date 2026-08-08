import { SelectorStatus } from "../../../types/enums";

export function classifySelector(kind: string, selectorText: string): SelectorStatus {
    if (kind !== "Selector") { return "empty"; }
    const trimmed = selectorText.trim();
    if (trimmed === "") { return "empty"; }
    if (typeof document === "undefined") { return "no-match"; }
    try {
        const node = document.querySelector(trimmed);

        return node === null ? "no-match" : "match";
    } catch {
        return "invalid";
    }
}
