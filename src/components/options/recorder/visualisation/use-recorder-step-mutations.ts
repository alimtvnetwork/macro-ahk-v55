/**
 * Step CRUD handlers (rename, delete, description, tags, link) for the
 * recorder visualisation panel. Extracted for Plan 33 (15/50-line cap).
 * Zero behavioural change vs. the monolithic controller.
 */

import { useCallback } from "react";
import { toast } from "sonner";

import { useRecorderProjectData } from "@/hooks/use-recorder-project-data";
import { sendMessage } from "@/lib/message-client";

import { logError } from "../../options-logger";

type ProjectDataApi = ReturnType<typeof useRecorderProjectData>;
type LinkSlot = "OnSuccessProjectId" | "OnFailureProjectId";

export interface RecorderStepMutations {
    readonly handleRename: (stepId: number, newName: string) => Promise<void>;
    readonly handleDelete: (stepId: number) => Promise<void>;
    readonly handleDescriptionSave: (stepId: number, description: string | null) => Promise<void>;
    readonly handleTagsSave: (stepId: number, tags: ReadonlyArray<string>) => Promise<void>;
    readonly handleLinkChange: (stepId: number, slot: LinkSlot, targetProjectSlug: string | null) => Promise<void>;
}

export function useRecorderStepMutations(
    projectSlug: string,
    api: Pick<ProjectDataApi, "reload" | "updateStepMeta" | "setStepTags" | "setStepLink">,
): RecorderStepMutations {
    return {
        handleRename: useRenameHandler(projectSlug, api.reload),
        handleDelete: useDeleteHandler(projectSlug, api.reload),
        handleDescriptionSave: useDescriptionHandler(projectSlug, api.updateStepMeta),
        handleTagsSave: useTagsHandler(projectSlug, api.setStepTags),
        handleLinkChange: useLinkHandler(projectSlug, api.setStepLink),
    };
}

function errText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function useRenameHandler(projectSlug: string, reload: () => Promise<void>) {
    return useCallback(async (stepId: number, newName: string) => {
        try {
            await sendMessage({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: "RECORDER_STEP_RENAME" as any,
                projectSlug, stepId, newVariableName: newName,
            });
            toast.success(`Renamed step #${stepId} -> ${newName}`);
            await reload();
        } catch (error) {
            const message = errText(error, "Failed to rename step");
            toast.error(message);
            logError("RecorderVisualisationPanel.rename",
                `RECORDER_STEP_RENAME failed for project='${projectSlug}' stepId=${stepId} newName='${newName}': ${message}`,
                error);
            throw error;
        }
    }, [projectSlug, reload]);
}

function useDeleteHandler(projectSlug: string, reload: () => Promise<void>) {
    return useCallback(async (stepId: number) => {
        const confirmed = confirm(`Delete step #${stepId}? This cannot be undone.`);
        if (!confirmed) return;
        try {
            await sendMessage({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: "RECORDER_STEP_DELETE" as any,
                projectSlug, stepId,
            });
            toast.success("Step deleted");
            await reload();
        } catch (error) {
            const message = errText(error, "Failed to delete step");
            toast.error(message);
            logError("RecorderVisualisationPanel.delete",
                `RECORDER_STEP_DELETE failed for project='${projectSlug}' stepId=${stepId}: ${message}`,
                error);
        }
    }, [projectSlug, reload]);
}

function useDescriptionHandler(projectSlug: string, updateStepMeta: ProjectDataApi["updateStepMeta"]) {
    return useCallback(async (stepId: number, description: string | null) => {
        try {
            await updateStepMeta(stepId, { Description: description });
            toast.success("Description updated");
        } catch (error) {
            const message = errText(error, "Failed to update description");
            toast.error(message);
            logError("RecorderVisualisationPanel.description",
                `updateStepMeta(Description) failed for project='${projectSlug}' stepId=${stepId}: ${message}`,
                error);
            throw error;
        }
    }, [projectSlug, updateStepMeta]);
}

function useTagsHandler(projectSlug: string, setStepTags: ProjectDataApi["setStepTags"]) {
    return useCallback(async (stepId: number, tags: ReadonlyArray<string>) => {
        try {
            await setStepTags(stepId, tags);
        } catch (error) {
            const message = errText(error, "Failed to update tags");
            toast.error(message);
            logError("RecorderVisualisationPanel.tags",
                `setStepTags failed for project='${projectSlug}' stepId=${stepId} tags=[${tags.join(",")}]: ${message}`,
                error);
            throw error;
        }
    }, [projectSlug, setStepTags]);
}

function useLinkHandler(projectSlug: string, setStepLink: ProjectDataApi["setStepLink"]) {
    return useCallback(async (stepId: number, slot: LinkSlot, targetProjectSlug: string | null) => {
        try {
            await setStepLink(stepId, slot, targetProjectSlug);
            toast.success(targetProjectSlug === null ? `${slot} cleared` : `${slot} -> ${targetProjectSlug}`);
        } catch (error) {
            const message = errText(error, "Failed to update link");
            toast.error(message);
            logError("RecorderVisualisationPanel.link",
                `setStepLink(${slot}=${targetProjectSlug ?? "null"}) failed for project='${projectSlug}' stepId=${stepId}: ${message}`,
                error);
            throw error;
        }
    }, [projectSlug, setStepLink]);
}
