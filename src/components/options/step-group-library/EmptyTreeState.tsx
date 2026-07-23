/**
 * EmptyTreeState — empty-state placeholder for the Step Group Library
 * tree pane. Extracted from `StepGroupLibraryPanel.tsx` (Plan 24, Step 3)
 * so the panel file no longer has to carry this presentational block.
 */

import type { JSX } from "react";
import { FolderTree, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyTreeState(props: {
    readonly onCreate: () => void;
    readonly onImport?: () => void;
}): JSX.Element {
    const { onCreate, onImport } = props;
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderTree className="h-7 w-7" />
            </div>
            <div className="space-y-1">
                <p className="font-medium text-foreground">No step groups yet</p>
                <p className="max-w-[34ch] text-xs">
                    Step groups bundle related actions you can replay later.
                    Create your first one or import a ZIP bundle from another
                    project.
                </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button size="sm" onClick={onCreate}>
                    <Plus className="mr-1 h-4 w-4" /> Create your first group
                </Button>
                {onImport !== undefined && (
                    <Button variant="outline" size="sm" onClick={onImport}>
                        <Upload className="mr-1 h-4 w-4" /> Import ZIP
                    </Button>
                )}
            </div>
        </div>
    );
}
