/**
 * Marco Extension, Step Group List Panel: left-pane groups list.
 *
 * Renders the checkbox header, empty states (zero groups vs. no
 * search matches), and the filtered list of groups. Extracted from
 * `StepGroupListPanel.tsx` to keep the outer render function under
 * the `max-lines-per-function` lint threshold.
 */

import { RefObject } from "react";
import { FilePlus2, FolderTree, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import { ListPanelGroupRow } from "./ListPanelGroupRow";

interface ListPanelGroupsListProps {
    filtered: ReadonlyArray<StepGroupRow>;
    totalCount: number;
    query: string;
    activeGroupId: number | null;
    selected: ReadonlySet<number>;
    groupsById: ReadonlyMap<number, StepGroupRow>;
    stepCountFor: (id: number) => number;
    allVisibleSelected: boolean;
    someVisibleSelected: boolean;
    visibleIds: ReadonlyArray<number>;
    toggleAllVisible: (on: boolean) => void;
    toggleOne: (id: number, on: boolean) => void;
    setActiveGroupId: (id: number | null) => void;
    onClearQuery: () => void;
    onOpenCreate: () => void;
    onPickImportFile: () => void;
    fileInputRef: RefObject<HTMLInputElement>;
}

export function ListPanelGroupsList(props: ListPanelGroupsListProps) {
    const {
        filtered,
        totalCount,
        query,
        activeGroupId,
        selected,
        groupsById,
        stepCountFor,
        allVisibleSelected,
        someVisibleSelected,
        visibleIds,
        toggleAllVisible,
        toggleOne,
        setActiveGroupId,
        onClearQuery,
        onOpenCreate,
        onPickImportFile,
    } = props;

    return (
        <Card className="flex min-h-[400px] flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                <Checkbox
                    id="list-select-all-visible"
                    checked={
                        allVisibleSelected
                            ? true
                            : someVisibleSelected
                                ? "indeterminate"
                                : false
                    }
                    onCheckedChange={(state) => toggleAllVisible(state === true)}
                    disabled={visibleIds.length === 0}
                    aria-label={
                        allVisibleSelected
                            ? "Deselect all visible groups"
                            : "Select all visible groups"
                    }
                />
                <Label
                    htmlFor="list-select-all-visible"
                    className="cursor-pointer text-sm font-medium text-muted-foreground"
                >
                    Groups
                </Label>
            </div>
            <ScrollArea className="flex-1">
                {filtered.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                        {totalCount === 0 ? (
                            <>
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <FolderTree className="h-7 w-7" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        No step groups yet
                                    </p>
                                    <p className="max-w-[34ch] text-xs text-muted-foreground">
                                        Step groups bundle related actions you can
                                        replay later. Create your first one or import
                                        a ZIP bundle exported from another project.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                    <Button size="sm" onClick={onOpenCreate}>
                                        <FilePlus2 className="mr-1 h-4 w-4" />
                                        Create the first one
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onPickImportFile}
                                    >
                                        <Upload className="mr-1 h-4 w-4" />
                                        Import ZIP
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Search className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                    No groups match &ldquo;{query}&rdquo;.
                                </p>
                                <Button variant="ghost" size="sm" onClick={onClearQuery}>
                                    Clear search
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y">
                        {filtered.map((g) => {
                            const parent =
                                g.ParentStepGroupId === null
                                    ? null
                                    : (groupsById.get(g.ParentStepGroupId) ?? null);
                            return (
                                <ListPanelGroupRow
                                    key={g.StepGroupId}
                                    group={g}
                                    isActive={g.StepGroupId === activeGroupId}
                                    isChecked={selected.has(g.StepGroupId)}
                                    stepCount={stepCountFor(g.StepGroupId)}
                                    parentName={parent?.Name ?? null}
                                    onToggleSelect={toggleOne}
                                    onActivate={setActiveGroupId}
                                />
                            );
                        })}
                    </ul>
                )}
            </ScrollArea>
        </Card>
    );
}
