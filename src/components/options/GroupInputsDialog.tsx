/**
 * GroupInputsDialog
 *
 * Lets the user paste or upload a JSON object and apply it as the input
 * variable bag for one StepGroup. State and handlers live in
 * `useGroupInputsController`; presentational sections live in
 * `group-inputs-sections.tsx`.
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
import { FileJson, Trash2 } from "lucide-react";

import type { GroupInputBag } from "@/background/recorder/step-library/group-inputs";
import { useGroupInputsController } from "./group-inputs/use-group-inputs-controller";
import { DropZone, JsonEditor } from "./group-inputs/group-inputs-sections";

export interface GroupInputsDialogProps {
    readonly open: boolean;
    readonly groupName: string | null;
    readonly groupId: number | null;
    readonly currentBag: GroupInputBag | null;
    readonly onOpenChange: (open: boolean) => void;
    readonly onApply: (groupId: number, bag: GroupInputBag) => void;
    readonly onClear: (groupId: number) => void;
}

export function GroupInputsDialog(props: GroupInputsDialogProps): JSX.Element {
    const { open, groupName, groupId, currentBag, onOpenChange } = props;
    const controller = useGroupInputsController(props);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" /> Apply input data
                    </DialogTitle>
                    <GroupInputsDescription groupName={groupName} />
                </DialogHeader>

                <DropZone
                    dragOver={controller.dragOver}
                    setDragOver={controller.setDragOver}
                    currentBag={currentBag}
                    onLoadCurrent={controller.handleLoadCurrent}
                    onFilePick={controller.handleFilePick}
                    onDrop={controller.handleDrop}
                />

                <JsonEditor
                    text={controller.text}
                    setText={controller.setText}
                    parseResult={controller.parseResult}
                />

                <GroupInputsFooter groupId={groupId} currentBag={currentBag} controller={controller} onOpenChange={onOpenChange} />
            </DialogContent>
        </Dialog>
    );
}

function GroupInputsDescription({ groupName }: { groupName: string | null }): JSX.Element {
    return <DialogDescription>Paste or upload a JSON object of variables for <span className="font-medium text-foreground">{groupName ?? "(no group selected)"}</span>. Values are substituted into <code className="rounded bg-muted px-1">{"{{Placeholder}}"}</code> tokens at recording / execution time.</DialogDescription>;
}

type GroupInputsController = ReturnType<typeof useGroupInputsController>;

function GroupInputsFooter(props: { groupId: number | null; currentBag: GroupInputBag | null; controller: GroupInputsController; onOpenChange: (open: boolean) => void }): JSX.Element {
    const { groupId, currentBag, controller, onOpenChange } = props;
    return <DialogFooter className="gap-2 sm:gap-2"><Button variant="ghost" onClick={controller.handleClear} disabled={groupId === null || currentBag === null} className="mr-auto text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4" />Clear bag</Button><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={controller.handleApply} disabled={groupId === null || !controller.parseResult.Ok}>Apply</Button></DialogFooter>;
}
