/**
 * Marco Extension, Step Group Library toolbar.
 *
 * Presentational header extracted from `StepGroupLibraryPanel` as
 * Plan 24 SS-04a Phase 2. Owns no state, every flag and setter is
 * passed in so the panel stays the single source of truth.
 *
 * Split into `LibraryToolbarTitle` and `LibraryToolbarActions` so
 * every render function sits under the 50-line ceiling required by
 * `.lovable/coding-guidelines.md` Rule 1.
 */

import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
import {
    Download,
    FolderTree,
    Globe,
    Pencil,
    Play,
    Plus,
    Trash2,
    Upload,
    Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import type { CreateDialogState } from "./dialog-state";

export interface LibraryToolbarProps {
    readonly projectName: string | null;
    readonly showArchived: boolean;
    readonly setShowArchived: (next: boolean) => void;
    readonly selectedCount: number;
    readonly clearSelection: () => void;
    readonly setCreateDialog: Dispatch<SetStateAction<CreateDialogState>>;
    readonly onImportClick: () => void;
    readonly setInputSourceOpen: Dispatch<SetStateAction<boolean>>;
    readonly setWebhookOpen: Dispatch<SetStateAction<boolean>>;
    readonly setBatchOpen: Dispatch<SetStateAction<boolean>>;
    readonly setBatchRenameOpen: Dispatch<SetStateAction<boolean>>;
    readonly setBatchDeleteOpen: Dispatch<SetStateAction<boolean>>;
    readonly onExportSelected: () => void;
    readonly fileInputRef: RefObject<HTMLInputElement>;
    readonly onImportFile: (file: File) => void;
}

function LibraryToolbarTitle(props: { readonly projectName: string | null }): JSX.Element {
    return (
        <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Step Group Library</h1>
            {props.projectName !== null && (
                <span className="text-sm text-muted-foreground">· {props.projectName}</span>
            )}
            <a
                href="#step-groups-list"
                className="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                title="Switch to a flat searchable list"
            >
                Open list view
            </a>
        </div>
    );
}

function ArchivedToggle(props: {
    readonly showArchived: boolean;
    readonly setShowArchived: (next: boolean) => void;
}): JSX.Element {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Switch
                checked={props.showArchived}
                onCheckedChange={props.setShowArchived}
                aria-label="Show archived groups"
            />
            Show archived
        </label>
    );
}

function SelectionCount(props: {
    readonly selectedCount: number;
    readonly clearSelection: () => void;
}): JSX.Element {
    return (
        <>
            <span className="text-sm text-muted-foreground">{props.selectedCount} selected</span>
            {props.selectedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={props.clearSelection}>
                    Clear
                </Button>
            )}
        </>
    );
}

function PrimaryActionButtons(props: LibraryToolbarProps): JSX.Element {
    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => props.setCreateDialog({ open: true, parent: null, name: "" })}
            >
                <Plus className="mr-1 h-4 w-4" />
                New group
            </Button>
            <Button variant="outline" size="sm" onClick={props.onImportClick}>
                <Upload className="mr-1 h-4 w-4" />
                Import ZIP
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => props.setInputSourceOpen(true)}
                title="Configure run-time input source"
            >
                <Globe className="mr-1 h-4 w-4" />
                Input source
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => props.setWebhookOpen(true)}
                title="Configure result webhook"
            >
                <Webhook className="mr-1 h-4 w-4" />
                Webhook
            </Button>
        </>
    );
}

function SelectionActionButtons(props: LibraryToolbarProps): JSX.Element {
    const disabled = props.selectedCount === 0;
    return (
        <>
            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => props.setBatchOpen(true)}>
                <Play className="mr-1 h-4 w-4" />
                Run selected
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => props.setBatchRenameOpen(true)}
                title="Rename every selected group with a shared transform"
            >
                <Pencil className="mr-1 h-4 w-4" />
                Rename selected
            </Button>
            <Button
                variant="destructive"
                size="sm"
                disabled={disabled}
                onClick={() => props.setBatchDeleteOpen(true)}
                title="Delete every selected group (cascades to children + steps)"
            >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete selected
            </Button>
            <Button size="sm" disabled={disabled} onClick={props.onExportSelected}>
                <Download className="mr-1 h-4 w-4" />
                Export selected
            </Button>
        </>
    );
}

function HiddenFileInput(props: {
    readonly fileInputRef: RefObject<HTMLInputElement>;
    readonly onImportFile: (file: File) => void;
}): JSX.Element {
    return (
        <input
            ref={props.fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) {
                    props.onImportFile(file);
                    event.target.value = "";
                }
            }}
        />
    );
}

function LibraryToolbarActions(props: LibraryToolbarProps): JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ArchivedToggle showArchived={props.showArchived} setShowArchived={props.setShowArchived} />
            <Separator orientation="vertical" className="h-6" />
            <SelectionCount selectedCount={props.selectedCount} clearSelection={props.clearSelection} />
            <PrimaryActionButtons {...props} />
            <SelectionActionButtons {...props} />
            <HiddenFileInput fileInputRef={props.fileInputRef} onImportFile={props.onImportFile} />
        </div>
    );
}

export function LibraryToolbar(props: LibraryToolbarProps): JSX.Element {
    return (
        <header className="flex flex-wrap items-center justify-between gap-3">
            <LibraryToolbarTitle projectName={props.projectName} />
            <LibraryToolbarActions {...props} />
        </header>
    );
}
