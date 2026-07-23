/**
 * Marco Extension — Step Group Library dialog state shapes.
 *
 * Extracted from `StepGroupLibraryPanel.tsx` (Plan 24 · SS-04a, phase 1).
 * The panel and the `LibraryDialogs` presentational component both need
 * these shapes; declaring them once keeps the two files honest.
 */

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import type { StepEditorMode } from "../StepEditorDialog";
import type { StepGroupExportPreview } from "@/background/recorder/step-library/export-bundle";
import type { ExportErrorExplanation } from "@/background/recorder/step-library/export-error-explainer";

export interface CreateDialogState {
    readonly open: boolean;
    readonly parent: number | null;
    readonly name: string;
}

export interface RenameDialogState {
    readonly open: boolean;
    readonly group: StepGroupRow | null;
    readonly name: string;
}

export interface GroupTargetDialogState {
    readonly open: boolean;
    readonly group: StepGroupRow | null;
}

export interface StepEditorDialogState {
    readonly open: boolean;
    readonly mode: StepEditorMode | null;
}

export interface DeleteStepDialogState {
    readonly open: boolean;
    readonly step: StepRow | null;
}

export interface WaitDialogState {
    readonly open: boolean;
    readonly stepId: number | null;
    readonly stepLabel: string | null;
}

export interface RunGroupDialogState {
    readonly open: boolean;
    readonly group: StepGroupRow | null;
}

export interface ExportPreviewState {
    readonly Open: boolean;
    readonly Preview: StepGroupExportPreview | null;
    readonly Pending: {
        readonly Ids: ReadonlyArray<number>;
        readonly IncludeDescendants: boolean;
    } | null;
}

export interface ExportErrorState {
    readonly Open: boolean;
    readonly Explanation: ExportErrorExplanation | null;
}
