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

function EmptyLibraryState(props: {
  readonly onOpenCreate: () => void;
  readonly onPickImportFile: () => void;
}) {
  const { onOpenCreate, onPickImportFile } = props;

  return (
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
  );
}

function NoSearchMatchesState(props: {
  readonly query: string;
  readonly onClearQuery: () => void;
}) {
  const { query, onClearQuery } = props;

  return (
    <>
      <Search className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
                          No groups match &ldquo;{query}&rdquo;.
      </p>
      <Button variant="ghost" size="sm" onClick={onClearQuery}>
                          Clear search
      </Button>
    </>
  );
}

function FilteredGroupList(props: {
  readonly filtered: ReadonlyArray<StepGroupRow>;
  readonly groupsById: ReadonlyMap<number, StepGroupRow>;
  readonly activeGroupId: number | null;
  readonly selected: ReadonlySet<number>;
  readonly stepCountFor: (id: number) => number;
  readonly toggleOne: (id: number, on: boolean) => void;
  readonly setActiveGroupId: (id: number | null) => void;
}) {
  const { filtered, groupsById, activeGroupId, selected, stepCountFor, toggleOne, setActiveGroupId } = props;

  return (
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
  );
}

function ListPanelGroupsListHeader(props: {
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly visibleIds: ReadonlyArray<number>;
  readonly toggleAllVisible: (on: boolean) => void;
}) {
  const { allVisibleSelected, someVisibleSelected, visibleIds, toggleAllVisible } = props;

  return (
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
      <LabelType
        htmlFor="list-select-all-visible"
        className="cursor-pointer text-sm font-medium text-muted-foreground"
      >
                  Groups
      </LabelType>
    </div>
  );
}

function ListPanelGroupsListContent(props: {
  readonly filtered: ReadonlyArray<StepGroupRow>;
  readonly totalCount: number;
  readonly query: string;
  readonly groupsById: ReadonlyMap<number, StepGroupRow>;
  readonly activeGroupId: number | null;
  readonly selected: ReadonlySet<number>;
  readonly stepCountFor: (id: number) => number;
  readonly toggleOne: (id: number, on: boolean) => void;
  readonly setActiveGroupId: (id: number | null) => void;
  readonly onClearQuery: () => void;
  readonly onOpenCreate: () => void;
  readonly onPickImportFile: () => void;
}) {
  const { filtered, totalCount, query, groupsById, activeGroupId, selected, stepCountFor, toggleOne, setActiveGroupId, onClearQuery, onOpenCreate, onPickImportFile } = props;

  if (filtered.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        {totalCount === 0 ? (
          <EmptyLibraryState
            onOpenCreate={onOpenCreate}
            onPickImportFile={onPickImportFile}
          />
        ) : (
          <NoSearchMatchesState
            query={query}
            onClearQuery={onClearQuery}
          />
        )}
      </div>
    );
  }

  return (
    <FilteredGroupList
      filtered={filtered}
      groupsById={groupsById}
      activeGroupId={activeGroupId}
      selected={selected}
      stepCountFor={stepCountFor}
      toggleOne={toggleOne}
      setActiveGroupId={setActiveGroupId}
    />
  );
}

export function ListPanelGroupsList(props: ListPanelGroupsListProps) {
  return (
    <Card className="flex min-h-[400px] flex-col overflow-hidden">
      <ListPanelGroupsListHeader
        allVisibleSelected={props.allVisibleSelected}
        someVisibleSelected={props.someVisibleSelected}
        visibleIds={props.visibleIds}
        toggleAllVisible={props.toggleAllVisible}
      />
      <ScrollArea className="flex-1">
        <ListPanelGroupsListContent
          filtered={props.filtered}
          totalCount={props.totalCount}
          query={props.query}
          groupsById={props.groupsById}
          activeGroupId={props.activeGroupId}
          selected={props.selected}
          stepCountFor={props.stepCountFor}
          toggleOne={props.toggleOne}
          setActiveGroupId={props.setActiveGroupId}
          onClearQuery={props.onClearQuery}
          onOpenCreate={props.onOpenCreate}
          onPickImportFile={props.onPickImportFile}
        />
      </ScrollArea>
    </Card>
  );
}
