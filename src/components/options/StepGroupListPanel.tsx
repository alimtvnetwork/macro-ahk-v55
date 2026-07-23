/**
 * Marco Extension - Step Group List Panel
 *
 * Thin composition root: state hook + mutations hook + guards +
 * `<ListPanelBody />`.
 */

import StepLibraryErrorState from "./StepLibraryErrorState";
import { ListPanelBody } from "./step-group-list/ListPanelBody";
import { useListPanelMutations } from "./step-group-list/use-list-panel-mutations";
import { useListPanelState } from "./step-group-list/use-list-panel-state";

export default function StepGroupListPanel() {
    const state = useListPanelState();
    const mutations = useListPanelMutations({
        lib: state.lib,
        activeGroupId: state.activeGroupId,
        setActiveGroupId: state.setActiveGroupId,
        setSelected: state.setSelected,
    });

    if (state.lib.Loading) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading step library…
            </div>
        );
    }
    if (state.lib.LoadError !== null) {
        return (
            <StepLibraryErrorState
                error={state.lib.LoadError}
                onRetry={state.lib.retryLoad}
                onReset={state.lib.resetAll}
            />
        );
    }

    return <ListPanelBody state={state} mutations={mutations} />;
}
