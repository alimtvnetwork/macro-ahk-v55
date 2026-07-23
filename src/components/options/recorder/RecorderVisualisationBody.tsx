/**
 * Two-column body for RecorderVisualisationPanel: step graph on the
 * left, step detail (with loading + empty variants) on the right.
 *
 * Prop types are derived from the child components with
 * `React.ComponentProps<...>` so we avoid duplicating them here (and
 * avoid `any`/double-cast escapes that trip the P0-10 baseline).
 */

import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";

import type { SelectorRow } from "@/hooks/use-recorder-project-data";

import { RecorderStepGraph } from "./RecorderStepGraph";
import { RecorderStepDetail } from "./RecorderStepDetail";

type StepGraphProps = ComponentProps<typeof RecorderStepGraph>;
type StepDetailProps = ComponentProps<typeof RecorderStepDetail>;

export interface RecorderVisualisationBodyProps {
    readonly steps: StepGraphProps["steps"];
    readonly dataSources: StepDetailProps["dataSources"];
    readonly bindings: StepDetailProps["bindings"];
    readonly selectedStepId: number | null;
    readonly selectors: ReadonlyArray<SelectorRow>;
    readonly selectorsLoading: boolean;
    readonly tagsByStep: ReadonlyMap<number, ReadonlyArray<string>>;
    readonly onSelectStep: StepGraphProps["onSelect"];
    readonly onDelete: StepGraphProps["onDelete"];
    readonly onRename: StepDetailProps["onRename"];
    readonly onDescriptionSave: StepDetailProps["onDescriptionSave"];
    readonly onTagsSave: StepDetailProps["onTagsSave"];
    readonly onLinkChange: StepDetailProps["onLinkChange"];
}

export function RecorderVisualisationBody(props: RecorderVisualisationBodyProps): JSX.Element {
    const selectedStep = props.steps.find((s) => s.StepId === props.selectedStepId) ?? null;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_2fr] gap-4">
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Steps ({props.steps.length})
                </h3>
                <RecorderStepGraph
                    steps={props.steps}
                    selectedStepId={props.selectedStepId}
                    onSelect={props.onSelectStep}
                    onDelete={props.onDelete}
                />
            </div>
            <div className="border border-border rounded-md bg-card/50 p-4">
                {selectedStep === null ? (
                    <p className="text-xs text-muted-foreground italic">
                        Select a step from the list to inspect its selectors and binding.
                    </p>
                ) : props.selectorsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading selectors...
                    </div>
                ) : (
                    <RecorderStepDetail
                        step={selectedStep}
                        selectors={props.selectors}
                        dataSources={props.dataSources}
                        bindings={props.bindings}
                        tags={props.tagsByStep.get(selectedStep.StepId) ?? []}
                        onRename={props.onRename}
                        onDescriptionSave={props.onDescriptionSave}
                        onTagsSave={props.onTagsSave}
                        onLinkChange={props.onLinkChange}
                    />
                )}
            </div>
        </div>
    );
}
