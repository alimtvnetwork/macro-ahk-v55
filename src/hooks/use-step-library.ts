/**
 * Marco Extension — useStepLibrary
 *
 * React hook that owns an in-memory `StepLibraryDb` (sql.js) and
 * persists the raw DB bytes to `localStorage` on every mutation.
 *
 * This is the "preview-friendly" data layer that the new
 * `StepGroupLibraryPanel` uses. It deliberately does NOT touch OPFS,
 * chrome.storage, or the background message bus — those are wired
 * separately when the panel ships inside the extension. Keeping the
 * hook self-contained makes the panel runnable in the Lovable preview
 * and unit-testable without WASM mocking gymnastics.
 *
 * Storage key: `marco.step-library.v1` (versioned so a future schema
 * bump can invalidate cleanly).
 *
 * @see src/background/recorder/step-library/db.ts
 */

import { useState } from "react";
import { WorkspaceStorage } from "@/lib/workspace-storage";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import {
    StepLibraryDb,
    type ProjectRow,
    type StepGroupRow,
    type StepRow,
} from "@/background/recorder/step-library/db";
import {
    type GroupInputsMap,
} from "@/background/recorder/step-library/group-inputs";
import { StepKindId } from "@/background/recorder/step-library/schema";
import {
    useBootstrap,
    useRemoteBytesSync,
    useLibraryMutations,
    useGroupInputMutations,
    useResetAndRetry,
    useAssembleApi,
} from "./step-library/step-library-hooks";
import type { StepLibraryLoadError, UseStepLibraryApi, UseStepLibraryState } from "./use-step-library-types";

export type { StepLibraryLoadError, UseStepLibraryApi, UseStepLibraryState };


/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "marco.step-library.v1";
const WASM_CDN_URL = "https://sql.js.org/dist/sql-wasm.wasm";
const DEFAULT_PROJECT_NAME = "My Project";
const DEFAULT_PROJECT_EXTERNAL_ID = "00000000-0000-0000-0000-000000000001";

/* ------------------------------------------------------------------ */
/*  Structured load failure                                            */
/* ------------------------------------------------------------------ */

/**
 * Discriminated load-failure shape so the panel can render an
 * actionable error UI (icon + title + hint + recovery action) instead
 * of a single opaque string. Each kind maps to a distinct user-facing
 * recovery path:
 *
 *  - `SqlJsLoad` — sql.js WASM never resolved (CDN blocked, offline,
 *    CSP, slow network). User can retry once connectivity is back.
 *  - `StorageRead` — `localStorage` read or JSON parse failed
 *    (corrupt payload, quota inaccessible). User can reset to clear
 *    the bad blob and start fresh.
 *  - `StorageWrite` — initial seed write failed (quota, private
 *    mode). The library still works in-memory but won't persist;
 *    user should free space or exit private browsing.
 *  - `Unknown` — anything not classified above. Shown as-is with a
 *    generic retry.
 */
// StepLibraryLoadError type is defined in `use-step-library-types.ts` and re-exported above.


function classifyLoadError(err: unknown, stage: "sqljs" | "storage-read" | "storage-write" | "other"): StepLibraryLoadError {
    const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
    if (stage === "sqljs") {
        return {
            Kind: "SqlJsLoad",
            Message: message,
            Hint: "Could not download the SQL engine (sql.js WASM) from the CDN. Check your internet connection, then click Retry.",
            Recoverable: true,
        };
    }
    if (stage === "storage-read") {
        return {
            Kind: "StorageRead",
            Message: message,
            Hint: "Your saved step-library data appears to be corrupted or unreadable. Click Reset to clear it and start with an empty library.",
            Recoverable: true,
        };
    }
    if (stage === "storage-write") {
        return {
            Kind: "StorageWrite",
            Message: message,
            Hint: "Browser storage is full or unavailable (private/incognito mode often blocks writes). Free up space or use a normal window, then Retry.",
            Recoverable: true,
        };
    }
    return {
        Kind: "Unknown",
        Message: message,
        Hint: "Something went wrong while opening the step library. Try retrying — if the problem persists, reset to clear local state.",
        Recoverable: true,
    };
}

/* ------------------------------------------------------------------ */
/*  sql.js singleton (lazy, browser-only)                              */
/* ------------------------------------------------------------------ */

let sqlPromise: Promise<SqlJsStatic> | null = null;
function loadSql(): Promise<SqlJsStatic> {
    if (sqlPromise === null) {
        sqlPromise = initSqlJs({ locateFile: () => WASM_CDN_URL });
    }
    return sqlPromise;
}

/**
 * Read result is tri-state:
 *   - `{ Kind: "Empty" }`  — nothing stored yet, fresh start
 *   - `{ Kind: "Bytes" }`  — stored DB found and decoded
 *   - `{ Kind: "Error" }`  — storage was present but unreadable
 *                            (corrupt JSON, blocked access). Caller
 *                            propagates to the load-error UI rather
 *                            than silently wiping the user's data.
 */
type StorageReadResult =
    | { Kind: "Empty" }
    | { Kind: "Bytes"; Bytes: Uint8Array }
    | { Kind: "Error"; Error: unknown };

async function readBytesFromStorage(): Promise<StorageReadResult> {
    try {
        const bytes = await WorkspaceStorage.get<Uint8Array>(STORAGE_KEY);
        if (!bytes) return { Kind: "Empty" };
        return { Kind: "Bytes", Bytes: bytes };
    } catch (err) {
        return { Kind: "Error", Error: err };
    }
}

/**
 * Write result mirrors the read shape so the bootstrap path can
 * distinguish "saved fine" from "stayed in memory only".
 */
async function writeBytesToStorage(bytes: Uint8Array): Promise<{ Ok: true } | { Ok: false; Error: unknown }> {
    try {
        await WorkspaceStorage.set(STORAGE_KEY, bytes);
        return { Ok: true };
    } catch (err) {
        console.warn("useStepLibrary: WorkspaceStorage write failed", err);
        return { Ok: false, Error: err };
    }
}

type OpenLibraryResult =

    | { Kind: "Ok"; Wrapper: StepLibraryDb; ProjectId: number; Bytes: Uint8Array }
    | { Kind: "Err"; Error: StepLibraryLoadError };

function openDatabase(sqljs: SqlJsStatic, readResult: StorageReadResult): Database {
    if (readResult.Kind === "Empty") return new sqljs.Database();
    if (readResult.Kind === "Bytes") return new sqljs.Database(readResult.Bytes);
    // Should never happen: caller filters "Error" before invoking us.
    return new sqljs.Database();
}

async function ensureProjectSeeded(wrapper: StepLibraryDb): Promise<{ ProjectId: number; SeedError: StepLibraryLoadError | null }> {
    const existing = wrapper.listProjects();
    if (existing.length > 0) return { ProjectId: existing[0].ProjectId, SeedError: null };
    const projectId = wrapper.upsertProject({
        ExternalId: DEFAULT_PROJECT_EXTERNAL_ID,
        Name: DEFAULT_PROJECT_NAME,
    });
    seedExampleData(wrapper, projectId);
    const writeResult = await writeBytesToStorage(wrapper.exportDbBytes());
    if (writeResult.Ok) return { ProjectId: projectId, SeedError: null };
    return { ProjectId: projectId, SeedError: classifyLoadError(writeResult.Error, "storage-write") };
}

async function openLibraryAndMaybeSeed(sqljs: SqlJsStatic, readResult: StorageReadResult): Promise<OpenLibraryResult> {
    try {
        const wrapper = new StepLibraryDb(openDatabase(sqljs, readResult));
        const seeded = await ensureProjectSeeded(wrapper);
        if (seeded.SeedError !== null) return { Kind: "Err", Error: seeded.SeedError };
        return { Kind: "Ok", Wrapper: wrapper, ProjectId: seeded.ProjectId, Bytes: wrapper.exportDbBytes() };
    } catch (err) {
        return { Kind: "Err", Error: classifyLoadError(err, "other") };
    }
}




/* ------------------------------------------------------------------ */
/*  Public hook                                                        */
/* ------------------------------------------------------------------ */

/**
 * See `use-step-library-types.ts` for the `UseStepLibraryApi` /
 * `UseStepLibraryState` contract. Behavior preserved verbatim from
 * the pre-split monolith: state + cross-tab sync + bootstrap +
 * mutations + group-input mutations + reset/retry, assembled into a
 * single memoized API surface.
 */
export function useStepLibrary(): UseStepLibraryApi {
    const [sql, setSql] = useState<SqlJsStatic | null>(null);
    const [lib, setLib] = useState<StepLibraryDb | null>(null);
    const [project, setProject] = useState<ProjectRow | null>(null);
    const [groups, setGroups] = useState<ReadonlyArray<StepGroupRow>>([]);
    const [stepsByGroup, setStepsByGroup] = useState<ReadonlyMap<number, ReadonlyArray<StepRow>>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<StepLibraryLoadError | null>(null);
    const [groupInputs, setGroupInputs] = useState<GroupInputsMap>(() => new Map());
    const [loading, setLoading] = useState(true);
    const [dbBytes, setDbBytes] = useState<Uint8Array | null>(null);
    const [bootstrapNonce, setBootstrapNonce] = useState(0);

    useRemoteBytesSync({
        sql, lib, project, dbBytes,
        setLib, setGroups, setStepsByGroup, setDbBytes,
        refreshFromDb,
    });

    useBootstrap({
        bootstrapNonce, loadSql, resetSqlPromise, readBytesFromStorage,
        openLibraryAndMaybeSeed, classifyLoadError, refreshFromDb,
        setters: {
            setSql, setLib, setProject, setGroups, setStepsByGroup,
            setGroupInputs, setError, setLoadError, setLoading, setDbBytes,
        },
    });

    const mutations = useLibraryMutations({
        lib, project, stepsByGroup,
        setGroups, setStepsByGroup, setDbBytes,
        refreshFromDb, writeBytesToStorage,
    });
    const { setGroupInput, clearGroupInput } = useGroupInputMutations(setGroupInputs);
    const { resetAll, retryLoad } = useResetAndRetry({
        storageKey: STORAGE_KEY, resetSqlPromise, setBootstrapNonce,
    });

    return useAssembleApi({
        loading, error, loadError, sql, lib, project, groups, stepsByGroup, groupInputs,
        mutations, setGroupInput, clearGroupInput, resetAll, retryLoad,
    });
}

function resetSqlPromise(): void { sqlPromise = null; }



/* ------------------------------------------------------------------ */
/*  Internals                                                          */
/* ------------------------------------------------------------------ */

function refreshFromDb(
    lib: StepLibraryDb,
    projectId: number,
    setGroups: (g: ReadonlyArray<StepGroupRow>) => void,
    setStepsByGroup: (m: ReadonlyMap<number, ReadonlyArray<StepRow>>) => void,
): void {
    const groups = lib.listGroups(projectId);
    setGroups(groups);
    const map = new Map<number, ReadonlyArray<StepRow>>();
    for (const g of groups) {
        map.set(g.StepGroupId, lib.listSteps(g.StepGroupId));
    }
    setStepsByGroup(map);
}

/**
 * Seed a small, illustrative tree on first run so the empty state has
 * something to demonstrate. Safe to remove once the panel is wired to
 * the real recorder data.
 */
function seedOnboardingClicks(lib: StepLibraryDb, onboarding: number, login: number): void {
    lib.appendStep({
        StepGroupId: onboarding,
        StepKindId: StepKindId.Click,
        Label: "Click Get Started",
        PayloadJson: JSON.stringify({ Selector: "#get-started" }),
    });
    lib.appendStep({
        StepGroupId: onboarding,
        StepKindId: StepKindId.RunGroup,
        Label: "Run Login subroutine",
        TargetStepGroupId: login,
    });
}

function seedLoginSteps(lib: StepLibraryDb, login: number): void {
    lib.appendStep({
        StepGroupId: login,
        StepKindId: StepKindId.Type,
        Label: "Type email",
        PayloadJson: JSON.stringify({ Selector: "#email", Value: "{{Email}}" }),
    });
    lib.appendStep({
        StepGroupId: login,
        StepKindId: StepKindId.Click,
        Label: "Click Sign in",
        PayloadJson: JSON.stringify({ Selector: "#signin" }),
    });
}

function seedExampleData(lib: StepLibraryDb, projectId: number): void {
    const onboarding = lib.createGroup({
        ProjectId: projectId, ParentStepGroupId: null,
        Name: "Onboarding", Description: "End-to-end signup flow",
    });
    const login = lib.createGroup({
        ProjectId: projectId, ParentStepGroupId: onboarding,
        Name: "Login", Description: "Sign-in subroutine",
    });
    seedOnboardingClicks(lib, onboarding, login);
    seedLoginSteps(lib, login);
    lib.createGroup({
        ProjectId: projectId, ParentStepGroupId: null,
        Name: "Checkout", Description: "Cart + payment macros",
    });
}


/** StepKind id → human label, for the right-pane preview. */
export function stepKindLabel(id: StepKindId): string {
    switch (id) {
        case StepKindId.Click:    return "Click";
        case StepKindId.Type:     return "Type";
        case StepKindId.Select:   return "Select";
        case StepKindId.JsInline: return "JS";
        case StepKindId.Wait:     return "Wait";
        case StepKindId.RunGroup: return "Run group";
        case StepKindId.Hotkey:      return "Hotkey";
        case StepKindId.UrlTabClick: return "URL tab click";
        default:                     return `Kind ${String(id)}`;
    }
}
