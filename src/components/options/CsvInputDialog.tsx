/**
 * CsvInputDialog
 *
 * Upload (or paste) a CSV file, configure how each column maps to a
 * variable in the StepGroup's input bag, pick which row to apply, and
 * commit. The resulting bag is identical in shape to what the JSON
 * dialog produces: both feed the same `setGroupInput` call.
 *
 * Constraints (recorded in mem://workflow/no-questions-mode):
 *   - File <= 5 MB / <= 10 000 rows, fully in memory.
 *   - Pure presentation; the runner picks up the bag from
 *     `useStepLibrary.GroupInputs`.
 *
 * v4.219.0: state + handlers extracted into
 * `./csv-input/use-csv-input-controller`; per-section markup lives
 * under `./csv-input/*` to keep this component within the ESLint
 * `max-lines-per-function` budget.
 */

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { CoercionKind } from "@/background/recorder/step-library/csv-mapping";
import type { GroupInputBag } from "@/background/recorder/step-library/group-inputs";

import { FileSpreadsheet } from "lucide-react";

import { CsvSourcePanel } from "./csv-input/CsvSourcePanel";
import { CsvMappingSection } from "./csv-input/CsvMappingSection";
import { useCsvInputController } from "./csv-input/use-csv-input-controller";

const COERCION_OPTIONS: ReadonlyArray<{ value: CoercionKind; label: string; hint: string }> = [
    { value: "auto",    label: "Auto",    hint: "Numbers, true/false, blank -> empty string" },
    { value: "string",  label: "String",  hint: "Always treat as text" },
    { value: "number",  label: "Number",  hint: "Reject non-numeric cells" },
    { value: "boolean", label: "Boolean", hint: "true/false/yes/no/0/1" },
    { value: "json",    label: "JSON",    hint: "Parse cell as JSON" },
];

export interface CsvInputDialogProps {
    readonly open: boolean;
    readonly groupName: string | null;
    readonly groupId: number | null;
    readonly onOpenChange: (open: boolean) => void;
    readonly onApply: (groupId: number, bag: GroupInputBag) => void;
}

export function CsvInputDialog(props: CsvInputDialogProps): JSX.Element {
    const { open, groupName, groupId, onOpenChange, onApply } = props;
    const ctrl = useCsvInputController({ open, groupId, groupName, onApply, onOpenChange });
    const { parsed, buildResult } = ctrl;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" /> Import CSV input
                    </DialogTitle>
                    <CsvDialogDescription groupName={groupName} />
                </DialogHeader>

                <CsvSourcePanel
                    hasParsed={parsed !== null}
                    loadedFileName={parsed?.FileName ?? null}
                    dragOver={ctrl.dragOver}
                    onDragOverChange={ctrl.setDragOver}
                    onDropFile={ctrl.handleDrop}
                    onPickFile={ctrl.handleFilePick}
                    pasted={ctrl.pasted}
                    onPastedChange={ctrl.setPasted}
                    parseError={ctrl.parseError}
                    onParseClick={ctrl.handleParseClick}
                />

                {parsed !== null && (
                    <CsvMappingSection
                        csv={parsed.Csv}
                        mappings={ctrl.mappings}
                        rowIndex={ctrl.rowIndex}
                        onRowIndexChange={ctrl.setRowIndex}
                        onUpdateMapping={ctrl.updateMapping}
                        coercionOptions={COERCION_OPTIONS}
                        buildResult={buildResult}
                    />
                )}

                <CsvDialogFooter groupId={groupId} parsed={parsed} controller={ctrl} onOpenChange={onOpenChange} />
            </DialogContent>
        </Dialog>
    );
}

function CsvDialogDescription({ groupName }: { groupName: string | null }): JSX.Element {
    return <DialogDescription>Upload a CSV, choose how each column maps to a variable, then apply one row to <span className="font-medium text-foreground">{groupName ?? "(no group selected)"}</span>. Limits: 5&nbsp;MB / 10&nbsp;000 rows, in memory.</DialogDescription>;
}

type CsvController = ReturnType<typeof useCsvInputController>;

function CsvDialogFooter(props: { groupId: number | null; parsed: CsvController["parsed"]; controller: CsvController; onOpenChange: (open: boolean) => void }): JSX.Element {
    const { groupId, parsed, controller, onOpenChange } = props;
    return <DialogFooter className="gap-2 sm:gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>{parsed !== null && <Button variant="outline" onClick={controller.resetParsed}>Load a different file</Button>}<Button onClick={controller.handleApply} disabled={groupId === null || controller.buildResult === null || !controller.buildResult.Ok}>Apply row {parsed === null ? "" : controller.rowIndex + 1}</Button></DialogFooter>;
}
