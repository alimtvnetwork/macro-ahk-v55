import { SelectorStatusType } from "../../../types/enums";
import { logError } from "@/components/recorder/recorder-logger";

export function classifySelector(kind: string, selectorText: string): SelectorStatusType {
  if (kind !== "Selector") {
    return "empty"; 
  }

  const trimmed = selectorText.trim();

  if (trimmed === "") {
    return "empty"; 
  }

  if (typeof document === "undefined") {
    return "no-match"; 
  }

  try {
    const node = document.querySelector(trimmed);

    return node === null ? "no-match" : "match";
  } catch (err) { /* swallowed */
    return "invalid";
  }
}
