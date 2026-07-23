/**
 * Marco Extension, ListPanel: all dialog groups (IO + create/rename/delete).
 */

import { ListPanelIODialogs } from "./ListPanelIODialogs";
import { ListPanelDialogs } from "./ListPanelDialogs";
import type { ListPanelState } from "./use-list-panel-state";
import type { useListPanelMutations } from "./use-list-panel-mutations";

export interface ListPanelDialogsGroupProps {
    state: ListPanelState;
    mutations: ReturnType<typeof useListPanelMutations>;
}

export function ListPanelDialogsGroup({ state: s, mutations: m }: ListPanelDialogsGroupProps) {
    return (
        <>
            <ListPanelIODialogs
                exportApi={s.exportApi}
                importApi={s.importApi}
                allGroups={s.allGroups}
                selectedGroups={s.selectedGroups}
                deletePreview={s.deletePreview}
                batchRenameOpen={s.batchRenameOpen}
                setBatchRenameOpen={s.setBatchRenameOpen}
                batchDeleteOpen={s.batchDeleteOpen}
                setBatchDeleteOpen={s.setBatchDeleteOpen}
                onBatchRenameApply={m.handleBatchRenameApply}
                onBatchDeleteConfirm={m.handleBatchDeleteConfirm}
            />
            <ListPanelDialogs
                projectName={s.projectName}
                createDialog={m.createDialog}
                setCreateDialog={m.setCreateDialog}
                createError={m.createError}
                submitCreate={m.submitCreate}
                renameDialog={m.renameDialog}
                setRenameDialog={m.setRenameDialog}
                renameError={m.renameError}
                submitRename={m.submitRename}
                deleteDialog={m.deleteDialog}
                setDeleteDialog={m.setDeleteDialog}
                submitDelete={m.submitDelete}
            />
        </>
    );
}
