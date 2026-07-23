/**
 * Marco Extension - Recorder Visualisation Panel (Phase 10)
 *
 * Project-scoped tab that visualises persisted Macro Recorder data:
 *   - Step graph (left rail): ordered list of `Step` rows
 *   - Detail panel (right): selectors, field binding, variable rename
 *   - Data Source summary chips
 *
 * All data flows through `useRecorderProjectData(projectSlug)` which
 * calls the existing `RECORDER_STEP_LIST`, `RECORDER_DATA_SOURCE_LIST`,
 * and `RECORDER_FIELD_BINDING_LIST` background handlers (Phases 07-09).
 *
 * v4.231.0: state + handlers extracted into
 * `./use-recorder-visualisation-controller`; header + body split into
 * `RecorderVisualisationHeader` + `RecorderVisualisationBody` so the
 * top-level render function stays inside the ESLint
 * `max-lines-per-function` budget.
 *
 * @see spec/31-macro-recorder/10-project-visualisation.md
 */

import { Loader2 } from "lucide-react";

import { RecorderEmptyState } from "./RecorderEmptyState";
import { RecorderVisualisationHeader } from "./RecorderVisualisationHeader";
import { RecorderVisualisationBody } from "./RecorderVisualisationBody";
import { useRecorderVisualisationController } from "./use-recorder-visualisation-controller";

interface Props {
    projectSlug: string;
}

export default function RecorderVisualisationPanel({ projectSlug }: Props): JSX.Element | null {
    const ctrl = useRecorderVisualisationController(projectSlug);
    const { data, loading, error, reload } = ctrl;

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading recorder data...
            </div>
        );
    }
    if (error) {
        return (
            <div className="space-y-3">
                <div className="text-xs text-destructive p-3 border border-destructive/40 rounded-md bg-destructive/5 font-mono">
                    {error}
                </div>
                <RecorderEmptyState
                    projectSlug={projectSlug}
                    hasDbError={true}
                    onReload={() => { void reload(); }}
                />
            </div>
        );
    }
    if (data === null) return null;

    return (
        <div className="space-y-4">
            <RecorderVisualisationHeader
                dataSources={data.dataSources}
                stepCount={data.steps.length}
                selfTestRunning={ctrl.selfTestRunning}
                onSelfTest={() => { void ctrl.handleSelfTest(); }}
                onExport={ctrl.handleExport}
            />
            {data.steps.length === 0 ? (
                <RecorderEmptyState
                    projectSlug={projectSlug}
                    hasDbError={false}
                    onReload={() => { void reload(); }}
                />
            ) : (
                <RecorderVisualisationBody
                    steps={data.steps}
                    dataSources={data.dataSources}
                    bindings={data.bindings}
                    selectedStepId={ctrl.selectedStepId}
                    selectors={ctrl.selectors}
                    selectorsLoading={ctrl.selectorsLoading}
                    tagsByStep={ctrl.tagsByStep}
                    onSelectStep={ctrl.setSelectedStepId}
                    onDelete={ctrl.handleDelete}
                    onRename={ctrl.handleRename}
                    onDescriptionSave={ctrl.handleDescriptionSave}
                    onTagsSave={ctrl.handleTagsSave}
                    onLinkChange={ctrl.handleLinkChange}
                />
            )}
        </div>
    );
}
