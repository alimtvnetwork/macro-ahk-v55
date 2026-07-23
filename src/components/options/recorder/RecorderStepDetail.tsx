/**
 * Marco Extension - Recorder Step Detail (Phase 10 + 14)
 *
 * Right-pane detail view for one selected Step. State + handlers live in
 * `recorder-step-detail/use-recorder-step-detail.ts`; presentational
 * sections live in `recorder-step-detail/recorder-step-sections.tsx`.
 */

import type {
    StepRow,
    SelectorRow,
    DataSourceRow,
    FieldBindingRow,
    StepLinkSlot,
} from "@/hooks/use-recorder-project-data";
import { useRecorderStepDetail } from "./recorder-step-detail/use-recorder-step-detail";
import {
    VariableSection,
    DescriptionSection,
    TagsSection,
    LinksSection,
    SelectorsSection,
    FieldBindingSection,
} from "./recorder-step-detail/recorder-step-sections";

interface Props {
    step: StepRow;
    selectors: ReadonlyArray<SelectorRow>;
    dataSources: ReadonlyArray<DataSourceRow>;
    bindings: ReadonlyArray<FieldBindingRow>;
    tags: ReadonlyArray<string>;
    onRename: (stepId: number, newName: string) => Promise<void>;
    onDescriptionSave: (stepId: number, description: string | null) => Promise<void>;
    onTagsSave: (stepId: number, tags: ReadonlyArray<string>) => Promise<void>;
    onLinkChange: (stepId: number, slot: StepLinkSlot, target: string | null) => Promise<void>;
}

export function RecorderStepDetail(props: Props): JSX.Element {
    const { step, selectors, dataSources, bindings, tags } = props;
    const controller = useRecorderStepDetail(props);
    const binding = bindings.find((row) => row.StepId === step.StepId) ?? null;
    const boundDs = binding ? dataSources.find((row) => row.DataSourceId === binding.DataSourceId) ?? null : null;
    return (
        <div className="space-y-4">
            <VariableSection
                step={step}
                draftName={controller.draftName}
                setDraftName={controller.setDraftName}
                isDirty={controller.isDirty}
                isSaving={controller.isSaving}
                renameError={controller.renameError}
                onSave={() => void controller.handleSave()}
            />
            <DescriptionSection
                draftDesc={controller.draftDesc}
                setDraftDesc={controller.setDraftDesc}
                isDescDirty={controller.isDescDirty}
                descSaving={controller.descSaving}
                descError={controller.descError}
                onSave={() => void controller.handleDescSave()}
            />
            <TagsSection
                tags={tags}
                draftTag={controller.draftTag}
                setDraftTag={controller.setDraftTag}
                tagsError={controller.tagsError}
                onAdd={() => void controller.handleAddTag()}
                onRemove={(name) => void controller.handleRemoveTag(name)}
            />
            <LinksSection
                step={step}
                linkError={controller.linkError}
                onLinkSave={controller.handleLinkSave}
            />
            <SelectorsSection selectors={selectors} />
            <FieldBindingSection binding={binding} boundDs={boundDs} />
        </div>
    );
}
