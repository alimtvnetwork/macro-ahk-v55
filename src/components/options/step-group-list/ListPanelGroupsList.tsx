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
import { LabelType } from "@/components/ui/label";
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

function EmptyGroupsList(props: { totalCount: number, query: string, onOpenCreate: () => void, onPickImportFile: () => void, onClearQuery: () => void }) {
    if (props.totalCount === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><FolderTree className="h-7 w-7" /></div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No step groups yet</p>
                    <p className="max-w-[34ch] text-xs text-muted-foreground">Step groups bundle related actions you can replay later. Create your first one or import a ZIP bundle exported from another project.</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button size="sm" onClick={props.onOpenCreate}><FilePlus2 className="mr-1 h-4 w-4" /> Create the first one</Button>
                    <Button size="sm" variant="outline" onClick={props.onPickImportFile}><Upload className="mr-1 h-4 w-4" /> Import ZIP</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No groups match &ldquo;{props.query}&rdquo;.</p>
            <Button variant="ghost" size="sm" onClick={props.onClearQuery}>Clear search</Button>
        </div>
    );
}

function GroupsListContent(props: ListPanelGroupsListProps) {
    return (
        <ul className="divide-y">
            {props.filtered.map((g) => {
                const parent = g.ParentStepGroupId === null ? null : (props.groupsById.get(g.ParentStepGroupId) ?? null);

                return (
                    <ListPanelGroupRow
                        key={g.StepGroupId}
                        group={g}
                        isActive={g.StepGroupId === props.activeGroupId}
                        isChecked={props.selected.has(g.StepGroupId)}
                        stepCount={props.stepCountFor(g.StepGroupId)}
                        parentName={parent?.Name ?? null}
                        onToggleSelect={props.toggleOne}
                        onActivate={props.setActiveGroupId}
                    />
                );
            })}
        </ul>
    );
}

export function ListPanelGroupsList(props: ListPanelGroupsListProps) {
    return (
        <Card className="flex min-h-[400px] flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                <Checkbox
                    id="list-select-all-visible"
                    checked={props.allVisibleSelected ? true : props.someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(state) => props.toggleAllVisible(state === true)}
                    disabled={props.visibleIds.length === 0}
                    aria-label={props.allVisibleSelected ? "Deselect all visible groups" : "Select all visible groups"}
                />
                <LabelType htmlFor="list-select-all-visible" className="cursor-pointer text-sm font-medium text-muted-foreground">Groups</LabelType>
            </div>
            <ScrollArea className="flex-1">
                {props.filtered.length === 0 ? (
                    <EmptyGroupsList totalCount={props.totalCount} query={props.query} onOpenCreate={props.onOpenCreate} onPickImportFile={props.onPickImportFile} onClearQuery={props.onClearQuery} />
                ) : (
                    <GroupsListContent {...props} />
                )}
            </ScrollArea>
        </Card>
    );
}
