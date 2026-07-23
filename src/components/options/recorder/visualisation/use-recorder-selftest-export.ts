/**
 * Self-test + export handlers for the recorder visualisation panel.
 * Extracted for Plan 33 (15/50-line cap).
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { useRecorderProjectData } from "@/hooks/use-recorder-project-data";

import { downloadRecorderExport, type ExportFormat } from "../recorder-export";
import { runRecorderSelfTest, RecorderSelfTestError } from "../recorder-self-test";
import { logError } from "../../options-logger";

type ProjectData = ReturnType<typeof useRecorderProjectData>["data"];
type TagsByStep = ReturnType<typeof useRecorderProjectData>["tagsByStep"];

export interface RecorderSelfTestExport {
    readonly selfTestRunning: boolean;
    readonly handleSelfTest: () => Promise<void>;
    readonly handleExport: (format: ExportFormat) => void;
}

export function useRecorderSelfTestExport(
    projectSlug: string,
    reload: () => Promise<void>,
    data: ProjectData,
    tagsByStep: TagsByStep,
): RecorderSelfTestExport {
    const [selfTestRunning, setSelfTestRunning] = useState(false);
    const handleSelfTest = useSelfTestHandler(projectSlug, reload, setSelfTestRunning);
    const handleExport = useExportHandler(projectSlug, data, tagsByStep);
    return { selfTestRunning, handleSelfTest, handleExport };
}

function useSelfTestHandler(
    projectSlug: string,
    reload: () => Promise<void>,
    setSelfTestRunning: (running: boolean) => void,
) {
    return useCallback(async () => {
        setSelfTestRunning(true);
        try {
            const result = await runRecorderSelfTest(projectSlug);
            await reload();
            toast.success(
                `Self-test passed: wrote StepId ${result.InsertedStepId}, verified, cleaned up (${result.DurationMs}ms)`,
            );
        } catch (error) {
            const phase = error instanceof RecorderSelfTestError ? error.Phase : "unknown";
            const message = error instanceof Error ? error.message : "Self-test failed";
            toast.error(`Recorder self-test failed (${phase}): ${message}`);
            logError("RecorderVisualisationPanel.selfTest",
                `runRecorderSelfTest failed at phase='${phase}' for project='${projectSlug}': ${message}`,
                error);
        } finally {
            setSelfTestRunning(false);
        }
    }, [projectSlug, reload, setSelfTestRunning]);
}

function useExportHandler(projectSlug: string, data: ProjectData, tagsByStep: TagsByStep) {
    return useCallback((format: ExportFormat) => {
        if (data === null) return;
        if (data.steps.length === 0) {
            toast.error("Nothing to export: no steps recorded yet.");
            return;
        }
        try {
            downloadRecorderExport({ projectSlug, data, tagsByStep }, format);
            toast.success(`Exported ${data.steps.length} step(s) as ${format.toUpperCase()}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Export failed";
            toast.error(message);
            logError("RecorderVisualisationPanel.export",
                `downloadRecorderExport(format='${format}') failed for project='${projectSlug}' steps=${data.steps.length}: ${message}`,
                error);
        }
    }, [data, projectSlug, tagsByStep]);
}
