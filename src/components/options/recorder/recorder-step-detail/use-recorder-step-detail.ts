/**
 * useRecorderStepDetail — state + handlers for RecorderStepDetail.
 * Splits the four independent edit surfaces (variable rename, description,
 * tags, cross-project links) so the presentational component drops under
 * the 50-line component cap.
 */

import { useCallback, useEffect, useState } from "react";
import type { StepRow, StepLinkSlot } from "@/hooks/use-recorder-project-data";

function errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export interface UseRecorderStepDetailArgs {
    readonly step: StepRow;
    readonly tags: ReadonlyArray<string>;
    readonly onRename: (stepId: number, newName: string) => Promise<void>;
    readonly onDescriptionSave: (stepId: number, description: string | null) => Promise<void>;
    readonly onTagsSave: (stepId: number, tags: ReadonlyArray<string>) => Promise<void>;
    readonly onLinkChange: (stepId: number, slot: StepLinkSlot, target: string | null) => Promise<void>;
}

export function useRecorderStepDetail(args: UseRecorderStepDetailArgs) {
    const { step, tags, onRename, onDescriptionSave, onTagsSave, onLinkChange } = args;

    const [draftName, setDraftName] = useState(step.VariableName);
    const [renameError, setRenameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [draftDesc, setDraftDesc] = useState(step.Description ?? "");
    const [descSaving, setDescSaving] = useState(false);
    const [descError, setDescError] = useState<string | null>(null);

    const [draftTag, setDraftTag] = useState("");
    const [tagsError, setTagsError] = useState<string | null>(null);

    const [linkError, setLinkError] = useState<string | null>(null);

    useEffect(() => {
        setDraftName(step.VariableName);
        setRenameError(null);
        setDraftDesc(step.Description ?? "");
        setDescError(null);
        setDraftTag("");
        setTagsError(null);
        setLinkError(null);
    }, [step.StepId, step.VariableName, step.Description]);

    const isDirty = draftName !== step.VariableName;
    const isDescDirty = draftDesc !== (step.Description ?? "");

    const handleSave = useCallback(async () => {
        if (!isDirty) return;
        setIsSaving(true);
        setRenameError(null);
        try { await onRename(step.StepId, draftName.trim()); }
        catch (err) { setRenameError(errorText(err)); }
        finally { setIsSaving(false); }
    }, [isDirty, draftName, onRename, step.StepId]);

    const handleDescSave = useCallback(async () => {
        if (!isDescDirty) return;
        setDescSaving(true);
        setDescError(null);
        try {
            const trimmed = draftDesc.trim();
            await onDescriptionSave(step.StepId, trimmed.length === 0 ? null : trimmed);
        } catch (err) { setDescError(errorText(err)); }
        finally { setDescSaving(false); }
    }, [isDescDirty, draftDesc, onDescriptionSave, step.StepId]);

    const handleAddTag = useCallback(async () => {
        const next = draftTag.trim();
        if (next.length === 0) return;
        if (tags.includes(next)) { setDraftTag(""); return; }
        setTagsError(null);
        try { await onTagsSave(step.StepId, [...tags, next]); setDraftTag(""); }
        catch (err) { setTagsError(errorText(err)); }
    }, [draftTag, tags, onTagsSave, step.StepId]);

    const handleRemoveTag = useCallback(async (name: string) => {
        setTagsError(null);
        try { await onTagsSave(step.StepId, tags.filter((tag) => tag !== name)); }
        catch (err) { setTagsError(errorText(err)); }
    }, [tags, onTagsSave, step.StepId]);

    const handleLinkSave = useCallback(async (slot: StepLinkSlot, raw: string) => {
        setLinkError(null);
        try {
            const trimmed = raw.trim();
            await onLinkChange(step.StepId, slot, trimmed.length === 0 ? null : trimmed);
        } catch (err) { setLinkError(errorText(err)); }
    }, [onLinkChange, step.StepId]);

    return {
        draftName, setDraftName, renameError, isSaving, isDirty, handleSave,
        draftDesc, setDraftDesc, descSaving, descError, isDescDirty, handleDescSave,
        draftTag, setDraftTag, tagsError, handleAddTag, handleRemoveTag,
        linkError, handleLinkSave,
    };
}
