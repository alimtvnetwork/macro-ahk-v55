/**
 * Marco Extension — Step Group List Panel Header
 *
 * Header/toolbar for `StepGroupListPanel`. Extracted from the panel to
 * keep the parent's render function under the `max-lines-per-function`
 * ceiling (Plan 24, Step 4, Phase 2). Pure presentation: every mutation
 * is a callback prop, no internal state.
 *
 * @see ../StepGroupListPanel.tsx — parent that owns state + handlers.
 */

import type { RefObject } from "react";

import {
    Download,
    FolderTree,
    Pencil,
    Plus,
    Trash2,
    Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface ListPanelHeaderProps {
    readonly projectName: string | null;
    readonly filteredCount: number;
    readonly totalCount: number;
    readonly selectedCount: number;
    readonly onClearSelection: () => void;
    readonly onOpenBatchRename: () => void;
    readonly onOpenBatchDelete: () => void;
    readonly onExportSelected: () => void;
    readonly onOpenCreate: () => void;
    readonly onPickImportFile: () => void;
    readonly fileInputRef: RefObject<HTMLInputElement>;
    readonly onImportFileChange: (file: File) => void;
}

export function ListPanelHeader(props: ListPanelHeaderProps): JSX.Element {
    const {
        projectName,
        filteredCount,
        totalCount,
        selectedCount,
        onClearSelection,
        onOpenBatchRename,
        onOpenBatchDelete,
        onExportSelected,
        onOpenCreate,
        onPickImportFile,
        fileInputRef,
        onImportFileChange,
    } = props;

    const hasSelection = selectedCount > 0;

    return (
        <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">
                    Step Group Library, List
                </h1>
                {projectName !== null && (
                    <span className="text-sm text-muted-foreground">
                        · {projectName}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                    {filteredCount} of {totalCount} group(s)
                </span>
                {hasSelection && (
                    <>
                        <Separator orientation="vertical" className="h-6" />
                        <span className="text-sm text-muted-foreground">
                            {selectedCount} selected
                        </span>
                        <Button variant="ghost" size="sm" onClick={onClearSelection}>
                            Clear
                        </Button>
                    </>
                )}
                <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasSelection}
                    onClick={onOpenBatchRename}
                    title="Rename every selected group with a shared transform"
                >
                    <Pencil className="mr-1 h-4 w-4" />
                    Rename selected
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    disabled={!hasSelection}
                    onClick={onOpenBatchDelete}
                    title="Delete every selected group (cascades to children + steps)"
                >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete selected
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={!hasSelection}
                    onClick={onExportSelected}
                    title="Export the marked groups as a ZIP bundle"
                >
                    <Download className="mr-1 h-4 w-4" />
                    Export selected
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onPickImportFile}
                    title="Upload a ZIP bundle and merge it into this project"
                >
                    <Upload className="mr-1 h-4 w-4" />
                    Import ZIP
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file !== undefined) {
                            onImportFileChange(file);
                            // Reset so re-uploading the same filename re-fires the
                            // change event (browsers suppress it otherwise).
                            event.target.value = "";
                        }
                    }}
                />
                <Button size="sm" onClick={onOpenCreate}>
                    <Plus className="mr-1 h-4 w-4" />
                    New group
                </Button>
                <a
                    href="#step-groups"
                    className="text-sm text-primary underline-offset-2 hover:underline"
                    title="Switch to the hierarchical tree browser"
                >
                    Open tree view
                </a>
            </div>
        </header>
    );
}
