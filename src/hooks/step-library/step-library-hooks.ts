/**
 * Marco Extension - internal helper hooks for `useStepLibrary`.
 *
 * These exist to satisfy the `max-lines-per-function` cap (each hook
 * stays under 40 lines) and to make the composition in
 * `use-step-library.ts` legible: state -> remote-sync -> bootstrap ->
 * mutations -> group-input mutations -> reset/retry -> API assembly.
 *
 * Zero behavior change vs. the pre-split monolith. All setters and
 * refresh semantics are preserved verbatim.
 */

import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { SqlJsStatic } from "sql.js";

import { logError } from "../hook-logger";
import { useCrossTabSync } from "../use-cross-tab-sync";
import {
    StepLibraryDb,
    type ProjectRow,
    type StepGroupRow,
    type StepRow,
} from "@/background/recorder/step-library/db";
import {
    clearGroupInput as clearGroupInputStorage,
    readAllGroupInputs,
    writeGroupInput,
    type GroupInputBag,
    type GroupInputsMap,
} from "@/background/recorder/step-library/group-inputs";
import type { StepKindId } from "@/background/recorder/step-library/schema";

import type { StepLibraryLoadError, UseStepLibraryApi } from "../use-step-library-types";

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export type OpenLibraryResultOk = { Kind: "Ok"; Wrapper: StepLibraryDb; ProjectId: number; Bytes: Uint8Array };

export interface BootstrapDeps {
    readonly bootstrapNonce: number;
    readonly loadSql: () => Promise<SqlJsStatic>;
    readonly resetSqlPromise: () => void;
    readonly readBytesFromStorage: () => Promise<
        | { Kind: "Empty" }
        | { Kind: "Bytes"; Bytes: Uint8Array }
        | { Kind: "Error"; Error: unknown }
    >;
    readonly openLibraryAndMaybeSeed: (
        sqljs: SqlJsStatic,
        readResult: { Kind: "Empty" } | { Kind: "Bytes"; Bytes: Uint8Array },
    ) => Promise<OpenLibraryResultOk | { Kind: "Err"; Error: StepLibraryLoadError }>;
    readonly classifyLoadError: (err: unknown, stage: "sqljs" | "storage-read" | "storage-write" | "other") => StepLibraryLoadError;
    readonly refreshFromDb: (
        lib: StepLibraryDb,
        projectId: number,
        setGroups: Dispatch<SetStateAction<ReadonlyArray<StepGroupRow>>>,
        setStepsByGroup: Dispatch<SetStateAction<ReadonlyMap<number, ReadonlyArray<StepRow>>>>,
    ) => void;
    readonly setters: BootstrapSetters;
}

export interface BootstrapSetters {
    readonly setSql: Dispatch<SetStateAction<SqlJsStatic | null>>;
    readonly setLib: Dispatch<SetStateAction<StepLibraryDb | null>>;
    readonly setProject: Dispatch<SetStateAction<ProjectRow | null>>;
    readonly setGroups: Dispatch<SetStateAction<ReadonlyArray<StepGroupRow>>>;
    readonly setStepsByGroup: Dispatch<SetStateAction<ReadonlyMap<number, ReadonlyArray<StepRow>>>>;
    readonly setGroupInputs: Dispatch<SetStateAction<GroupInputsMap>>;
    readonly setError: Dispatch<SetStateAction<string | null>>;
    readonly setLoadError: Dispatch<SetStateAction<StepLibraryLoadError | null>>;
    readonly setLoading: Dispatch<SetStateAction<boolean>>;
    readonly setDbBytes: Dispatch<SetStateAction<Uint8Array | null>>;
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */

function makeApplyLoadError(setters: BootstrapSetters) {
    return (classified: StepLibraryLoadError): void => {
        setters.setLoadError(classified);
        setters.setError(classified.Message);
        setters.setLoading(false);
    };
}

function makeApplySuccess(
    setters: BootstrapSetters,
    refreshFromDb: BootstrapDeps["refreshFromDb"],
) {
    return (opened: OpenLibraryResultOk, sqljs: SqlJsStatic): void => {
        setters.setDbBytes(opened.Bytes);
        setters.setSql(sqljs);
        setters.setLib(opened.Wrapper);
        setters.setProject(opened.Wrapper.listProjects().find((p) => p.ProjectId === opened.ProjectId) ?? null);
        refreshFromDb(opened.Wrapper, opened.ProjectId, setters.setGroups, setters.setStepsByGroup);
        setters.setGroupInputs(readAllGroupInputs());
        setters.setLoading(false);
    };
}

async function runBootstrapSequence(
    deps: BootstrapDeps,
    applyLoadError: (e: StepLibraryLoadError) => void,
    applySuccess: (opened: OpenLibraryResultOk, sqljs: SqlJsStatic) => void,
    isCancelled: () => boolean,
): Promise<void> {
    let sqljs: SqlJsStatic;
    try {
        sqljs = await deps.loadSql();
    } catch (err) {
        if (isCancelled()) return;
        deps.resetSqlPromise();
        applyLoadError(deps.classifyLoadError(err, "sqljs"));
        return;
    }
    if (isCancelled()) return;
    const readResult = await deps.readBytesFromStorage();
    if (isCancelled()) return;
    if (readResult.Kind === "Error") {
        applyLoadError(deps.classifyLoadError(readResult.Error, "storage-read"));
        return;
    }
    const opened = await deps.openLibraryAndMaybeSeed(sqljs, readResult);
    if (isCancelled()) return;
    if (opened.Kind === "Err") { applyLoadError(opened.Error); return; }
    applySuccess(opened, sqljs);
}

export function useBootstrap(deps: BootstrapDeps): void {
    const { setters, refreshFromDb, bootstrapNonce } = deps;
    const applyLoadError = useCallback(
        (classified: StepLibraryLoadError) => makeApplyLoadError(setters)(classified),
        [setters],
    );
    const applySuccess = useCallback(
        (opened: OpenLibraryResultOk, sqljs: SqlJsStatic) => makeApplySuccess(setters, refreshFromDb)(opened, sqljs),
        [setters, refreshFromDb],
    );
    useEffect(() => {
        let cancelled = false;
        setters.setLoading(true);
        setters.setError(null);
        setters.setLoadError(null);
        void runBootstrapSequence(deps, applyLoadError, applySuccess, () => cancelled);
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrapNonce, applyLoadError, applySuccess]);
}


/* ------------------------------------------------------------------ */
/*  Remote (cross-tab) sync                                            */
/* ------------------------------------------------------------------ */

export interface RemoteSyncDeps {
    readonly sql: SqlJsStatic | null;
    readonly lib: StepLibraryDb | null;
    readonly project: ProjectRow | null;
    readonly dbBytes: Uint8Array | null;
    readonly setLib: Dispatch<SetStateAction<StepLibraryDb | null>>;
    readonly setGroups: Dispatch<SetStateAction<ReadonlyArray<StepGroupRow>>>;
    readonly setStepsByGroup: Dispatch<SetStateAction<ReadonlyMap<number, ReadonlyArray<StepRow>>>>;
    readonly setDbBytes: Dispatch<SetStateAction<Uint8Array | null>>;
    readonly refreshFromDb: BootstrapDeps["refreshFromDb"];
}

function applyRemoteBytes(deps: RemoteSyncDeps, remoteBytes: Uint8Array): void {
    if (!deps.lib || !deps.project || !deps.sql) return;
    try {
        const db = new deps.sql.Database(remoteBytes);
        const wrapper = new StepLibraryDb(db);
        deps.setLib(wrapper);
        deps.refreshFromDb(wrapper, deps.project.ProjectId, deps.setGroups, deps.setStepsByGroup);
        deps.setDbBytes(remoteBytes);
        new BroadcastChannel("marco-sync-activity").postMessage("synced");
    } catch (err) {
        logError("use-step-library::onRemoteBytes", "Failed to sync remote library state", err);
    }
}

export function useRemoteBytesSync(deps: RemoteSyncDeps): void {
    const onRemoteBytes = useCallback((remoteBytes: Uint8Array | null) => {
        if (!remoteBytes) return;
        applyRemoteBytes(deps, remoteBytes);
    }, [deps]);
    useCrossTabSync<Uint8Array | null>("marco-step-library-sync", deps.dbBytes, onRemoteBytes);
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export interface MutationDeps {
    readonly lib: StepLibraryDb | null;
    readonly project: ProjectRow | null;
    readonly stepsByGroup: ReadonlyMap<number, ReadonlyArray<StepRow>>;
    readonly setGroups: Dispatch<SetStateAction<ReadonlyArray<StepGroupRow>>>;
    readonly setStepsByGroup: Dispatch<SetStateAction<ReadonlyMap<number, ReadonlyArray<StepRow>>>>;
    readonly setDbBytes: Dispatch<SetStateAction<Uint8Array | null>>;
    readonly refreshFromDb: BootstrapDeps["refreshFromDb"];
    readonly writeBytesToStorage: (bytes: Uint8Array) => Promise<{ Ok: true } | { Ok: false; Error: unknown }>;
}

export interface LibraryMutations {
    readonly refresh: UseStepLibraryApi["refresh"];
    readonly createGroup: UseStepLibraryApi["createGroup"];
    readonly renameGroup: UseStepLibraryApi["renameGroup"];
    readonly deleteGroup: UseStepLibraryApi["deleteGroup"];
    readonly moveGroupWithinParent: UseStepLibraryApi["moveGroupWithinParent"];
    readonly reorderSiblings: UseStepLibraryApi["reorderSiblings"];
    readonly setGroupArchived: UseStepLibraryApi["setGroupArchived"];
    readonly setStepDisabled: UseStepLibraryApi["setStepDisabled"];
    readonly appendStep: UseStepLibraryApi["appendStep"];
    readonly updateStep: UseStepLibraryApi["updateStep"];
    readonly deleteStep: UseStepLibraryApi["deleteStep"];
    readonly moveStepWithinGroup: UseStepLibraryApi["moveStepWithinGroup"];
    readonly reorderSteps: UseStepLibraryApi["reorderSteps"];
}

function moveWithinArray(ids: readonly number[], id: number, direction: "up" | "down"): readonly number[] | null {
    const idx = ids.indexOf(id);
    if (idx === -1) return null;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ids.length) return null;
    const next = ids.slice();
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    return next;
}

function findOwningGroupId(stepsByGroup: ReadonlyMap<number, ReadonlyArray<StepRow>>, stepId: number): number | null {
    for (const [gid, steps] of stepsByGroup) {
        if (steps.some((s) => s.StepId === stepId)) return gid;
    }
    return null;
}

function useCommit(deps: MutationDeps) {
    return useCallback(() => {
        if (deps.lib === null) return;
        const bytes = deps.lib.exportDbBytes();
        deps.setDbBytes(bytes);
        void deps.writeBytesToStorage(bytes);
    }, [deps]);
}

function useAfterMutation(deps: MutationDeps, commit: () => void) {
    return useCallback(() => {
        if (deps.lib === null || deps.project === null) return;
        deps.refreshFromDb(deps.lib, deps.project.ProjectId, deps.setGroups, deps.setStepsByGroup);
        commit();
    }, [deps, commit]);
}

function useGroupCrud(deps: MutationDeps, after: () => void) {
    const createGroup = useCallback<UseStepLibraryApi["createGroup"]>((input) => {
        if (deps.lib === null || deps.project === null) throw new Error("createGroup: library not initialised");
        const id = deps.lib.createGroup({
            ProjectId: deps.project.ProjectId,
            ParentStepGroupId: input.ParentStepGroupId,
            Name: input.Name,
            Description: input.Description ?? null,
        });
        after();
        return id;
    }, [deps, after]);
    const renameGroup = useCallback<UseStepLibraryApi["renameGroup"]>((id, name) => {
        if (deps.lib === null) return;
        deps.lib.renameGroup(id, name); after();
    }, [deps, after]);
    const deleteGroup = useCallback<UseStepLibraryApi["deleteGroup"]>((id) => {
        if (deps.lib === null) return;
        deps.lib.deleteGroup(id); after();
    }, [deps, after]);
    const setGroupArchived = useCallback<UseStepLibraryApi["setGroupArchived"]>((id, archived) => {
        if (deps.lib === null) return;
        deps.lib.setGroupArchived(id, archived); after();
    }, [deps, after]);
    return { createGroup, renameGroup, deleteGroup, setGroupArchived };
}

function useGroupOrdering(deps: MutationDeps, after: () => void) {
    const moveGroupWithinParent = useCallback<UseStepLibraryApi["moveGroupWithinParent"]>((id, direction) => {
        if (deps.lib === null || deps.project === null) return;
        const all = deps.lib.listGroups(deps.project.ProjectId);
        const target = all.find((g) => g.StepGroupId === id);
        if (target === undefined) return;
        const parent = target.ParentStepGroupId ?? null;
        const siblings = all
            .filter((g) => (g.ParentStepGroupId ?? null) === parent)
            .sort((a, b) => a.OrderIndex - b.OrderIndex || a.Name.localeCompare(b.Name))
            .map((g) => g.StepGroupId);
        const next = moveWithinArray(siblings, id, direction);
        if (next === null) return;
        deps.lib.reorderGroups(deps.project.ProjectId, parent, next);
        after();
    }, [deps, after]);
    const reorderSiblings = useCallback<UseStepLibraryApi["reorderSiblings"]>((parent, orderedIds) => {
        if (deps.lib === null || deps.project === null) return;
        deps.lib.reorderGroups(deps.project.ProjectId, parent, orderedIds); after();
    }, [deps, after]);
    return { moveGroupWithinParent, reorderSiblings };
}

function useStepCrud(deps: MutationDeps, after: () => void) {
    const appendStep = useCallback<UseStepLibraryApi["appendStep"]>((input) => {
        if (deps.lib === null || deps.project === null) throw new Error("appendStep: library not initialised");
        const id = deps.lib.appendStep(input);
        after();
        return id;
    }, [deps, after]);
    const updateStep = useCallback<UseStepLibraryApi["updateStep"]>((input) => {
        if (deps.lib === null) return;
        deps.lib.updateStep(input); after();
    }, [deps, after]);
    const deleteStep = useCallback<UseStepLibraryApi["deleteStep"]>((stepId) => {
        if (deps.lib === null) return;
        deps.lib.deleteStep(stepId); after();
    }, [deps, after]);
    const setStepDisabled = useCallback<UseStepLibraryApi["setStepDisabled"]>((stepId, disabled) => {
        if (deps.lib === null) return;
        deps.lib.setStepDisabled(stepId, disabled); after();
    }, [deps, after]);
    return { appendStep, updateStep, deleteStep, setStepDisabled };
}

function useStepOrdering(deps: MutationDeps, after: () => void) {
    const moveStepWithinGroup = useCallback<UseStepLibraryApi["moveStepWithinGroup"]>((stepId, direction) => {
        if (deps.lib === null) return;
        const owningGroupId = findOwningGroupId(deps.stepsByGroup, stepId);
        if (owningGroupId === null) return;
        const ordered = (deps.stepsByGroup.get(owningGroupId) ?? []).map((s) => s.StepId);
        const next = moveWithinArray(ordered, stepId, direction);
        if (next === null) return;
        deps.lib.reorderSteps(owningGroupId, next);
        after();
    }, [deps, after]);
    const reorderSteps = useCallback<UseStepLibraryApi["reorderSteps"]>((stepGroupId, orderedStepIds) => {
        if (deps.lib === null) return;
        deps.lib.reorderSteps(stepGroupId, orderedStepIds); after();
    }, [deps, after]);
    return { moveStepWithinGroup, reorderSteps };
}

export function useLibraryMutations(deps: MutationDeps): LibraryMutations {
    const commit = useCommit(deps);
    const after = useAfterMutation(deps, commit);
    const refresh = useCallback(() => {
        if (deps.lib === null || deps.project === null) return;
        deps.refreshFromDb(deps.lib, deps.project.ProjectId, deps.setGroups, deps.setStepsByGroup);
    }, [deps]);
    const groupCrud = useGroupCrud(deps, after);
    const groupOrdering = useGroupOrdering(deps, after);
    const stepCrud = useStepCrud(deps, after);
    const stepOrdering = useStepOrdering(deps, after);
    return { refresh, ...groupCrud, ...groupOrdering, ...stepCrud, ...stepOrdering };
}

/* ------------------------------------------------------------------ */
/*  Group-input state                                                  */
/* ------------------------------------------------------------------ */

export function useGroupInputMutations(setGroupInputs: Dispatch<SetStateAction<GroupInputsMap>>) {
    const setGroupInput = useCallback((id: number, bag: GroupInputBag) => {
        writeGroupInput(id, bag);
        setGroupInputs((prev) => {
            const next = new Map(prev);
            next.set(id, bag);
            return next;
        });
    }, [setGroupInputs]);
    const clearGroupInput = useCallback((id: number) => {
        clearGroupInputStorage(id);
        setGroupInputs((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, [setGroupInputs]);
    return { setGroupInput, clearGroupInput };
}

/* ------------------------------------------------------------------ */
/*  Reset + retry                                                      */
/* ------------------------------------------------------------------ */

export function useResetAndRetry(deps: {
    readonly storageKey: string;
    readonly resetSqlPromise: () => void;
    readonly setBootstrapNonce: Dispatch<SetStateAction<number>>;
}) {
    const resetAll = useCallback(() => {
        try {
            localStorage.removeItem(deps.storageKey);
        } catch (caught) {
            logError("useStepLibrary.resetAll", `localStorage.removeItem("${deps.storageKey}") failed - bootstrap nonce will still trigger reload`, caught);
        }
        window.location.reload();
    }, [deps]);
    const retryLoad = useCallback(() => {
        deps.resetSqlPromise();
        deps.setBootstrapNonce((n) => n + 1);
    }, [deps]);
    return { resetAll, retryLoad };
}

/* ------------------------------------------------------------------ */
/*  API assembly (useMemo)                                             */
/* ------------------------------------------------------------------ */

export interface ApiAssemblyState {
    readonly loading: boolean;
    readonly error: string | null;
    readonly loadError: StepLibraryLoadError | null;
    readonly sql: SqlJsStatic | null;
    readonly lib: StepLibraryDb | null;
    readonly project: ProjectRow | null;
    readonly groups: ReadonlyArray<StepGroupRow>;
    readonly stepsByGroup: ReadonlyMap<number, ReadonlyArray<StepRow>>;
    readonly groupInputs: GroupInputsMap;
    readonly mutations: LibraryMutations;
    readonly setGroupInput: UseStepLibraryApi["setGroupInput"];
    readonly clearGroupInput: UseStepLibraryApi["clearGroupInput"];
    readonly resetAll: UseStepLibraryApi["resetAll"];
    readonly retryLoad: UseStepLibraryApi["retryLoad"];
}

export function useAssembleApi(state: ApiAssemblyState): UseStepLibraryApi {
    return useMemo<UseStepLibraryApi>(() => ({
        Loading: state.loading,
        Error: state.error,
        LoadError: state.loadError,
        SqlJs: state.sql,
        Lib: state.lib,
        Project: state.project,
        Groups: state.groups,
        StepsByGroup: state.stepsByGroup,
        GroupInputs: state.groupInputs,
        ...state.mutations,
        setGroupInput: state.setGroupInput,
        clearGroupInput: state.clearGroupInput,
        resetAll: state.resetAll,
        retryLoad: state.retryLoad,
    }), [state]);
}

/* Re-export types consumers of this helper file need. */
export type { StepKindId };
