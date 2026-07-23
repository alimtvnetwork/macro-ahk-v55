/**
 * Marco Extension, Keyword Events, Target Picker Status
 *
 * Pure helper extracted from `TargetPickerRow` (Plan 25 step 12): classifies
 * a CSS-selector draft into one of four states so the row can render the
 * matching input border colour + inline hint. Keeping the classifier out of
 * the component drops `TargetPickerRow`'s cognitive complexity under the
 * 15-branch ceiling (was 18).
 */

export type SelectorStatus = "empty" | "invalid" | "no-match" | "match";

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
