/**
 * Step selection + selector fetching effects for the recorder
 * visualisation panel. Extracted from
 * `use-recorder-visualisation-controller.ts` for Plan 33 (15/50-line cap).
 */

import { useEffect, useState } from "react";

import type {
    useRecorderProjectData,
    SelectorRow,
} from "@/hooks/use-recorder-project-data";

type ProjectData = ReturnType<typeof useRecorderProjectData>["data"];
type LoadSelectors = ReturnType<typeof useRecorderProjectData>["loadSelectors"];

export interface RecorderStepSelectionState {
    readonly selectedStepId: number | null;
    readonly setSelectedStepId: (id: number | null) => void;
    readonly selectors: ReadonlyArray<SelectorRow>;
    readonly selectorsLoading: boolean;
}

export function useRecorderStepSelection(
    data: ProjectData,
    loadSelectors: LoadSelectors,
): RecorderStepSelectionState {
    const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
    const [selectors, setSelectors] = useState<ReadonlyArray<SelectorRow>>([]);
    const [selectorsLoading, setSelectorsLoading] = useState(false);

    useAutoSelectFirstStep(data, selectedStepId, setSelectedStepId);
    useFetchSelectorsOnStepChange(selectedStepId, loadSelectors, setSelectors, setSelectorsLoading);

    return { selectedStepId, setSelectedStepId, selectors, selectorsLoading };
}

function useAutoSelectFirstStep(
    data: ProjectData,
    selectedStepId: number | null,
    setSelectedStepId: (id: number | null) => void,
): void {
    useEffect(() => {
        if (data === null || data.steps.length === 0) {
            setSelectedStepId(null);
            return;
        }
        const stillExists = data.steps.some((s) => s.StepId === selectedStepId);
        if (!stillExists) setSelectedStepId(data.steps[0].StepId);
    }, [data, selectedStepId, setSelectedStepId]);
}

function useFetchSelectorsOnStepChange(
    selectedStepId: number | null,
    loadSelectors: LoadSelectors,
    setSelectors: (rows: ReadonlyArray<SelectorRow>) => void,
    setSelectorsLoading: (loading: boolean) => void,
): void {
    useEffect(() => {
        if (selectedStepId === null) {
            setSelectors([]);
            return;
        }
        let cancelled = false;
        setSelectorsLoading(true);
        loadSelectors(selectedStepId)
            .then((rows) => { if (!cancelled) setSelectors(rows); })
            .finally(() => { if (!cancelled) setSelectorsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedStepId, loadSelectors, setSelectors, setSelectorsLoading]);
}
