/**
 * Marco Extension, ListPanel: main two-column grid (groups list + details).
 */

import { ListPanelGroupsList } from "./ListPanelGroupsList";
import { ListPanelDetailsCard } from "./ListPanelDetailsCard";
import type { ListPanelState } from "./use-list-panel-state";
import type { useListPanelMutations } from "./use-list-panel-mutations";

export interface ListPanelGridProps {
    state: ListPanelState;
    mutations: ReturnType<typeof useListPanelMutations>;
}

export function ListPanelGrid({ state: s, mutations: m }: ListPanelGridProps) {
    return (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
            <ListPanelGroupsList
                filtered={s.filtered}
                totalCount={s.allGroups.length}
                query={s.query}
                activeGroupId={s.activeGroupId}
                selected={s.selected}
                groupsById={s.groupsById}
                stepCountFor={s.stepCountFor}
                allVisibleSelected={s.allVisibleSelected}
                someVisibleSelected={s.someVisibleSelected}
                visibleIds={s.visibleIds}
                toggleAllVisible={s.toggleAllVisible}
                toggleOne={s.toggleOne}
                setActiveGroupId={s.setActiveGroupId}
                onClearQuery={() => s.setQuery("")}
                onOpenCreate={m.openCreate}
                onPickImportFile={() => s.fileInputRef.current?.click()}
                fileInputRef={s.fileInputRef}
            />
            <ListPanelDetailsCard
                activeGroup={s.activeGroup}
                activeSteps={s.activeSteps}
                hasBoundInputs={s.hasBoundInputs}
                onRename={m.openRename}
                onDelete={m.openDelete}
                onToggleStep={s.onToggleStep}
            />
        </div>
    );
}
