/**
 * Shared tree-shape type for the Step Group Library panel and its
 * extracted subpanes (`LibraryTreePane`, `LibraryStepPane`).
 *
 * Extracted from `StepGroupLibraryPanel.tsx` so subcomponents can
 * reference the same `TreeNode` interface without pulling the whole
 * panel back through a circular import.
 */

import type { StepGroupRow } from "@/background/recorder/step-library/db";

export interface TreeNode {
    readonly Group: StepGroupRow;
    readonly Children: TreeNode[];
}
