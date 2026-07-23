/**
 * Marco Extension, Input Source Settings Dialog
 *
 * Configures the project-wide HTTP endpoint that supplies a fresh
 * JSON input bag at the start of every batch run. Backed by
 * `input-source.ts` storage.
 *
 * State and mutation helpers live in `./input-source/use-input-source-draft.ts`.
 * Presentational sections live in `./input-source/input-source-sections.tsx`.
 * This module is a thin orchestrator that wires them into the shadcn Dialog.
 */

import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { InputSourceBody } from "./input-source/input-source-sections";
import { useInputSourceDraft } from "./input-source/use-input-source-draft";

interface Props {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

export default function InputSourceDialog({ open, onOpenChange }: Props) {
    const api = useInputSourceDraft(open, onOpenChange);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Run-time input source
                    </DialogTitle>
                    <DialogDescription>
                        Fetch a fresh JSON bag from your endpoint at the start of every batch run.
                        The fetched values are merged on top of each group's saved input bag, endpoint
                        keys win on collision.
                    </DialogDescription>
                </DialogHeader>
                <InputSourceBody api={api} />
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={api.handleSave}>Save settings</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
