/**
 * State + handlers for RecorderVisualisationPanel. Composes small focused
 * hooks so every function stays inside the ESLint 15/50-line budget
 * (Plan 33). Zero behavioural change vs. v4.358.0.
 */

import { useEffect } from "react";

import {
    useRecorderProjectData,
    type SelectorRow,
} from "@/hooks/use-recorder-project-data";

import { logError } from "../options-logger";
import type { ExportFormat } from "./recorder-export";
import { useRecorderStepSelection } from "./visualisation/use-recorder-step-selection";
import { useRecorderStepMutations } from "./visualisation/use-recorder-step-mutations";
import { useRecorderSelfTestExport } from "./visualisation/use-recorder-selftest-export";

export interface RecorderVisualisationController {
    readonly projectSlug: string;
    readonly data: ReturnType<typeof useRecorderProjectData>["data"];
    readonly loading: boolean;
    readonly error: string | null;
    readonly reload: () => Promise<void>;
    readonly tagsByStep: ReturnType<typeof useRecorderProjectData>["tagsByStep"];
    readonly selectedStepId: number | null;
    readonly setSelectedStepId: (id: number | null) => void;
    readonly selectors: ReadonlyArray<SelectorRow>;
    readonly selectorsLoading: boolean;
    readonly selfTestRunning: boolean;
    readonly handleSelfTest: () => Promise<void>;
    readonly handleRename: (stepId: number, newName: string) => Promise<void>;
    readonly handleDelete: (stepId: number) => Promise<void>;
    readonly handleDescriptionSave: (stepId: number, description: string | null) => Promise<void>;
    readonly handleTagsSave: (stepId: number, tags: ReadonlyArray<string>) => Promise<void>;
    readonly handleLinkChange: (
        stepId: number,
        slot: "OnSuccessProjectId" | "OnFailureProjectId",
        targetProjectSlug: string | null,
    ) => Promise<void>;
    readonly handleExport: (format: ExportFormat) => void;
}

export function useRecorderVisualisationController(projectSlug: string): RecorderVisualisationController {
    const projectData = useRecorderProjectData(projectSlug);
    const { data, loading, error, reload, loadSelectors, tagsByStep } = projectData;
    const selection = useRecorderStepSelection(data, loadSelectors);
    const mutations = useRecorderStepMutations(projectSlug, projectData);
    const selfTestExport = useRecorderSelfTestExport(projectSlug, reload, data, tagsByStep);
    useLoadErrorLogger(projectSlug, error);
    return { projectSlug, data, loading, error, reload, tagsByStep, ...selection, ...mutations, ...selfTestExport };
}

function useLoadErrorLogger(projectSlug: string, error: string | null): void {
    useEffect(() => {
        if (error === null) return;
        logError("RecorderVisualisationPanel.load",
            `useRecorderProjectData failed for project='${projectSlug}': ${error}`);
    }, [error, projectSlug]);
}
