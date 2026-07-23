/**
 * Marco Extension — Step Group Bundle Import
 *
 * Symmetric counterpart to `./export-bundle.ts`. Accepts the bytes of a
 * ZIP produced by `runStepGroupExport`, validates every layer, and
 * merges the contained `StepGroup` + `Step` rows into a destination
 * `StepLibraryDb` under a caller-chosen project.
 *
 * Pure module — no chrome.*, no DOM, no file-system. The caller
 * supplies the ZIP bytes (typically read from an `<input type="file">`
 * via `arrayBuffer()`).
 *
 * Failure handling: this module never throws after `runStepGroupImport`
 * returns; every reachable failure surfaces as a structured
 * `ImportFailure` per mem://standards/verbose-logging-and-failure-diagnostics.
 *
 * Atomicity: all writes happen inside a single `BEGIN`/`COMMIT` on the
 * destination DB. A failure mid-merge rolls back, leaving the
 * destination identical to its pre-import state.
 *
 * @see ./export-bundle.ts
 * @see spec/31-macro-recorder/16-step-group-library.md  §8.4 (import)
 * @see mem://standards/verbose-logging-and-failure-diagnostics
 */

import type { Database, SqlJsStatic } from "sql.js";
import type JSZipType from "jszip";

import { applySchema, StepKindId } from "./schema";
import {
    StepLibraryDb,
    type StepGroupRow,
    type StepRow,
} from "./db";
import {
    sha256Hex,
    STEP_GROUP_BUNDLE_FORMAT_VERSION,
    type StepGroupExportManifest,
} from "./export-bundle";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type ConflictPolicy = "Skip" | "Rename" | "Fail";

export interface RunStepGroupImportInit {
    /** Raw ZIP bytes (e.g. from `await file.arrayBuffer()` then `new Uint8Array(buf)`). */
    readonly ZipBytes: Uint8Array;
    /** Destination DB to merge into. */
    readonly Destination: StepLibraryDb;
    /** Project that will own every imported group. */
    readonly DestinationProjectId: number;
    /**
     * Where to attach the imported tree's roots:
     *   - `null` (default) → at the top level of the destination project,
     *   - a `StepGroupId` → all imported roots become children of it.
     * The given parent MUST belong to `DestinationProjectId`.
     */
    readonly AttachUnderStepGroupId?: number | null;
    /** What to do when an imported root collides with an existing sibling name. */
    readonly OnNameConflict?: ConflictPolicy;
    /** sql.js factory — typically the lazily-initialised singleton. */
    readonly SqlJs: SqlJsStatic;
    /** JSZip constructor — passed in so this module stays tree-shakeable. */
    readonly JsZip: typeof JSZipType;
}

export type ImportReason =
    | "Ok"
    | "BundleNotZip"
    | "ManifestMissing"
    | "ManifestMalformed"
    | "ManifestVersionUnsupported"
    | "DbFileMissing"
    | "DbChecksumMismatch"
    | "DbSchemaIncompatible"
    | "DbCorrupt"
    | "DestinationProjectMissing"
    | "AttachParentMissing"
    | "AttachParentWrongProject"
    | "NameConflict"
    | "RunGroupTargetMissing"
    | "InternalError";

export interface ImportFailure {
    readonly Reason: Exclude<ImportReason, "Ok">;
    readonly Detail: string;
    readonly OffendingNames?: ReadonlyArray<string>;
    readonly OffendingIds?: ReadonlyArray<number>;
}

export interface ImportSummary {
    readonly Reason: "Ok";
    readonly Manifest: StepGroupExportManifest;
    readonly DestinationProjectId: number;
    readonly AttachedUnderStepGroupId: number | null;
    readonly RootStepGroupIds: ReadonlyArray<number>;
    readonly IdMap: ReadonlyArray<{ readonly OldId: number; readonly NewId: number }>;
    readonly RenamedRoots: ReadonlyArray<{ readonly OldName: string; readonly NewName: string }>;
    readonly Counts: { readonly StepGroups: number; readonly Steps: number; readonly RunGroupRefs: number };
}

export type StepGroupImportResult = ImportSummary | ImportFailure;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MANIFEST_FILE = "manifest.json";
const RENAME_MAX_ATTEMPTS = 256;

/* ------------------------------------------------------------------ */
/*  ZIP unpacking + validation                                         */
/* ------------------------------------------------------------------ */

interface UnpackedBundle {
    readonly Manifest: StepGroupExportManifest;
    readonly DbBytes: Uint8Array;
}

async function unpackBundle(
    zipBytes: Uint8Array,
    jsZip: typeof JSZipType,
): Promise<UnpackedBundle | ImportFailure> {
    const zipResult = await openZip(zipBytes, jsZip);
    if ("Reason" in zipResult) { return zipResult; }
    const manifestResult = await readManifest(zipResult);
    if ("Reason" in manifestResult) { return manifestResult; }
    const versionCheck = checkManifestVersion(manifestResult);
    if (versionCheck !== null) { return versionCheck; }
    const dbResult = await readAndVerifyDb(zipResult, manifestResult);
    if ("Reason" in dbResult) { return dbResult; }
    return { Manifest: manifestResult, DbBytes: dbResult };
}

async function openZip(
    zipBytes: Uint8Array,
    jsZip: typeof JSZipType,
): Promise<JSZipType | ImportFailure> {
    try {
        return await jsZip.loadAsync(zipBytes);
    } catch (err) {
        return {
            Reason: "BundleNotZip",
            Detail: err instanceof Error ? err.message : "JSZip.loadAsync rejected the bundle",
        };
    }
}

async function readManifest(zip: JSZipType): Promise<StepGroupExportManifest | ImportFailure> {
    const manifestEntry = zip.file(MANIFEST_FILE);
    if (manifestEntry === null) {
        return { Reason: "ManifestMissing", Detail: `Bundle has no ${MANIFEST_FILE}.` };
    }
    let manifestText: string;
    try {
        manifestText = await manifestEntry.async("string");
    } catch (err) {
        return {
            Reason: "ManifestMalformed",
            Detail: err instanceof Error ? err.message : "manifest.json could not be decoded",
        };
    }
    let manifest: StepGroupExportManifest;
    try {
        manifest = JSON.parse(manifestText) as StepGroupExportManifest;
    } catch (err) {
        return {
            Reason: "ManifestMalformed",
            Detail: err instanceof Error ? err.message : "manifest.json is not valid JSON",
        };
    }
    const validation = validateManifestShape(manifest);
    if (validation !== null) { return validation; }
    return manifest;
}

function checkManifestVersion(manifest: StepGroupExportManifest): ImportFailure | null {
    if (manifest.FormatVersion > STEP_GROUP_BUNDLE_FORMAT_VERSION) {
        return {
            Reason: "ManifestVersionUnsupported",
            Detail:
                `Bundle FormatVersion=${manifest.FormatVersion} is newer than this build supports ` +
                `(${STEP_GROUP_BUNDLE_FORMAT_VERSION}). Please update the extension.`,
        };
    }
    return null;
}

async function readAndVerifyDb(
    zip: JSZipType,
    manifest: StepGroupExportManifest,
): Promise<Uint8Array | ImportFailure> {
    const dbEntry = zip.file(manifest.DbFileName);
    if (dbEntry === null) {
        return {
            Reason: "DbFileMissing",
            Detail: `Bundle declares DbFileName="${manifest.DbFileName}" but the file is absent from the ZIP.`,
        };
    }
    let dbBytes: Uint8Array;
    try {
        dbBytes = await dbEntry.async("uint8array");
    } catch (err) {
        return {
            Reason: "DbCorrupt",
            Detail: err instanceof Error ? err.message : "embedded DB could not be decoded",
        };
    }
    if (dbBytes.length !== manifest.DbByteLength) {
        return {
            Reason: "DbChecksumMismatch",
            Detail:
                `Embedded DB is ${dbBytes.length} bytes but manifest claims ${manifest.DbByteLength}. ` +
                "Bundle was tampered with or truncated.",
        };
    }
    const observedSha = await sha256Hex(dbBytes);
    if (observedSha !== manifest.DbSha256) {
        return {
            Reason: "DbChecksumMismatch",
            Detail:
                `Embedded DB SHA-256 ${observedSha} does not match manifest ${manifest.DbSha256}. ` +
                "Bundle was tampered with or truncated.",
        };
    }
    return dbBytes;
}


function validateManifestShape(m: unknown): ImportFailure | null {
    if (m === null || typeof m !== "object") {
        return { Reason: "ManifestMalformed", Detail: "manifest.json is not an object." };
    }
    const required: ReadonlyArray<keyof StepGroupExportManifest> = [
        "FormatVersion",
        "GeneratedAt",
        "BundleName",
        "Project",
        "Selection",
        "Counts",
        "DbFileName",
        "DbByteLength",
        "DbSha256",
    ];
    const obj = m as Record<string, unknown>;
    for (const k of required) {
        if (!(k in obj)) {
            return {
                Reason: "ManifestMalformed",
                Detail: `manifest.json missing required field "${String(k)}".`,
            };
        }
    }
    if (typeof obj.FormatVersion !== "number" || !Number.isInteger(obj.FormatVersion)) {
        return { Reason: "ManifestMalformed", Detail: "FormatVersion must be an integer." };
    }
    if (typeof obj.DbByteLength !== "number" || obj.DbByteLength < 0) {
        return { Reason: "ManifestMalformed", Detail: "DbByteLength must be a non-negative integer." };
    }
    if (typeof obj.DbSha256 !== "string" || !/^[0-9a-f]{64}$/.test(obj.DbSha256)) {
        return { Reason: "ManifestMalformed", Detail: "DbSha256 must be 64 lowercase hex chars." };
    }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Conflict resolution                                                */
/* ------------------------------------------------------------------ */

function uniqueRenameFor(
    desired: string,
    existingLower: ReadonlySet<string>,
): string | null {
    if (!existingLower.has(desired.toLowerCase())) return desired;
    for (let n = 1; n <= RENAME_MAX_ATTEMPTS; n++) {
        const candidate = n === 1 ? `${desired} (imported)` : `${desired} (imported ${n})`;
        if (!existingLower.has(candidate.toLowerCase())) return candidate;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Source-DB readers (sql.js raw)                                     */
/* ------------------------------------------------------------------ */

function readGroupsFromSource(db: Database): StepGroupRow[] {
    const stmt = db.prepare(
        `SELECT StepGroupId, ProjectId, ParentStepGroupId, Name, Description,
                OrderIndex, IsArchived, CreatedAt, UpdatedAt
         FROM StepGroup
         ORDER BY ParentStepGroupId IS NULL DESC, ParentStepGroupId ASC,
                  OrderIndex ASC, StepGroupId ASC;`,
    );
    try {
        const rows: StepGroupRow[] = [];
        while (stmt.step()) {
            const r = stmt.getAsObject() as unknown as StepGroupRow;
            rows.push({ ...r, IsArchived: Boolean(r.IsArchived) });
        }
        return rows;
    } finally {
        stmt.free();
    }
}

function readStepsForGroup(db: Database, stepGroupId: number): StepRow[] {
    const stmt = db.prepare(
        `SELECT StepId, StepGroupId, OrderIndex, StepKindId, Label,
                PayloadJson, TargetStepGroupId, IsDisabled, CreatedAt, UpdatedAt
         FROM Step
         WHERE StepGroupId = ?
         ORDER BY OrderIndex ASC, StepId ASC;`,
    );
    try {
        stmt.bind([stepGroupId]);
        const rows: StepRow[] = [];
        while (stmt.step()) {
            const r = stmt.getAsObject() as unknown as StepRow;
            rows.push({ ...r, IsDisabled: Boolean(r.IsDisabled) });
        }
        return rows;
    } finally {
        stmt.free();
    }
}

/* ------------------------------------------------------------------ */
/*  Topological order (parents before children)                        */
/* ------------------------------------------------------------------ */

function orderByAncestry(rows: ReadonlyArray<StepGroupRow>): StepGroupRow[] {
    const ids = new Set(rows.map((r) => r.StepGroupId));
    const remaining = new Map(rows.map((r) => [r.StepGroupId, r]));
    const out: StepGroupRow[] = [];
    const placed = new Set<number>();
    while (remaining.size > 0) {
        let progressed = false;
        for (const [id, r] of remaining) {
            const parent = r.ParentStepGroupId;
            const parentReady =
                parent === null || !ids.has(parent) || placed.has(parent);
            if (parentReady) {
                out.push(r);
                placed.add(id);
                remaining.delete(id);
                progressed = true;
                break;
            }
        }
        if (!progressed) {
            for (const r of remaining.values()) out.push(r);
            break;
        }
    }
    return out;
}

/* ------------------------------------------------------------------ */
/*  Top-level entrypoint                                               */
/* ------------------------------------------------------------------ */

export async function runStepGroupImport(
    init: RunStepGroupImportInit,
): Promise<StepGroupImportResult> {
    const conflict: ConflictPolicy = init.OnNameConflict ?? "Rename";
    const attachUnder = init.AttachUnderStepGroupId ?? null;

    const unpacked = await unpackBundle(init.ZipBytes, init.JsZip);
    if ("Reason" in unpacked) return unpacked;
    const { Manifest: manifest, DbBytes: dbBytes } = unpacked;

    const sourceOpen = openSourceDb(dbBytes, init.SqlJs);
    if ("Reason" in sourceOpen) return sourceOpen;
    const sourceDb = sourceOpen;

    try {
        const schemaResult = applySourceSchema(sourceDb);
        if (schemaResult !== null) return schemaResult;

        const destCheck = validateDestination(init, attachUnder);
        if ("Reason" in destCheck) return destCheck;
        const { destGroups } = destCheck;

        const graph = collectSourceGraph(sourceDb);
        const runGroupCheck = checkRunGroupTargets(graph);
        if (runGroupCheck !== null) return runGroupCheck;

        const plan = resolveNameConflicts({
            sourceGroups: graph.sourceGroups,
            sourceIdSet: graph.sourceIdSet,
            destGroups,
            attachUnder,
            conflict,
        });
        if ("Reason" in plan) return plan;

        return performAtomicMerge({
            init,
            manifest,
            attachUnder,
            graph,
            plan,
        });
    } finally {
        sourceDb.close();
    }
}

function openSourceDb(dbBytes: Uint8Array, sqlJs: SqlJsStatic): Database | ImportFailure {
    try {
        return new sqlJs.Database(dbBytes);
    } catch (err) {
        return {
            Reason: "DbCorrupt",
            Detail: err instanceof Error ? err.message : "sql.js refused to open embedded DB",
        };
    }
}

function applySourceSchema(sourceDb: Database): ImportFailure | null {
    try {
        applySchema(sourceDb);
        return null;
    } catch (err) {
        return {
            Reason: "DbSchemaIncompatible",
            Detail: err instanceof Error ? err.message : "applySchema rejected embedded DB",
        };
    }
}

interface DestinationContext {
    readonly destGroups: ReadonlyArray<StepGroupRow>;
}

function validateDestination(
    init: RunStepGroupImportInit,
    attachUnder: number | null,
): DestinationContext | ImportFailure {
    const destLib = init.Destination;
    const destProject = destLib.listProjects()
        .find((p) => p.ProjectId === init.DestinationProjectId);
    if (destProject === undefined) {
        return {
            Reason: "DestinationProjectMissing",
            Detail: `DestinationProjectId=${init.DestinationProjectId} not found in destination DB.`,
            OffendingIds: [init.DestinationProjectId],
        };
    }
    const destGroups = destLib.listGroups(init.DestinationProjectId);
    if (attachUnder !== null) {
        const parent = destGroups.find((g) => g.StepGroupId === attachUnder);
        if (parent === undefined) {
            return {
                Reason: "AttachParentMissing",
                Detail: `AttachUnderStepGroupId=${attachUnder} not found in destination project.`,
                OffendingIds: [attachUnder],
            };
        }
        if (parent.ProjectId !== init.DestinationProjectId) {
            return {
                Reason: "AttachParentWrongProject",
                Detail: `AttachUnderStepGroupId=${attachUnder} belongs to a different project.`,
                OffendingIds: [attachUnder],
            };
        }
    }
    return { destGroups };
}

interface SourceGraph {
    readonly sourceGroups: ReadonlyArray<StepGroupRow>;
    readonly sourceIdSet: ReadonlySet<number>;
    readonly allSourceSteps: ReadonlyArray<StepRow>;
    readonly danglingRunGroupIds: ReadonlyArray<number>;
    readonly runGroupRefs: number;
}

function collectSourceGraph(sourceDb: Database): SourceGraph {
    const sourceGroups = orderByAncestry(readGroupsFromSource(sourceDb));
    const sourceIdSet = new Set(sourceGroups.map((g) => g.StepGroupId));
    const allSourceSteps: StepRow[] = [];
    const dangling: number[] = [];
    let runGroupRefs = 0;
    for (const g of sourceGroups) {
        for (const s of readStepsForGroup(sourceDb, g.StepGroupId)) {
            allSourceSteps.push(s);
            if (s.StepKindId === StepKindId.RunGroup) {
                runGroupRefs += 1;
                if (s.TargetStepGroupId === null || !sourceIdSet.has(s.TargetStepGroupId)) {
                    dangling.push(s.StepId);
                }
            }
        }
    }
    return { sourceGroups, sourceIdSet, allSourceSteps, danglingRunGroupIds: dangling, runGroupRefs };
}

function checkRunGroupTargets(graph: SourceGraph): ImportFailure | null {
    if (graph.danglingRunGroupIds.length === 0) { return null; }
    return {
        Reason: "RunGroupTargetMissing",
        Detail:
            `Step(s) ${graph.danglingRunGroupIds.join(", ")} are RunGroup invocations whose target ` +
            `is not present in the bundle. The bundle is corrupt.`,
        OffendingIds: [...graph.danglingRunGroupIds],
    };
}

interface NameConflictPlan {
    readonly effectiveName: ReadonlyMap<number, string>;
    readonly renamedRoots: ReadonlyArray<{ OldName: string; NewName: string }>;
    readonly skippedSubtree: ReadonlySet<number>;
}

interface ResolveNameConflictsInput {
    readonly sourceGroups: ReadonlyArray<StepGroupRow>;
    readonly sourceIdSet: ReadonlySet<number>;
    readonly destGroups: ReadonlyArray<StepGroupRow>;
    readonly attachUnder: number | null;
    readonly conflict: ConflictPolicy;
}

// Resolve name conflicts for the import roots (groups whose parent is null
// in the source OR whose parent is outside the bundle - both will land
// under `attachUnder` in the destination). We compare against the
// destination siblings of `attachUnder` (case-insensitive).
function resolveNameConflicts(input: ResolveNameConflictsInput): NameConflictPlan | ImportFailure {
    const { sourceGroups, sourceIdSet, destGroups, attachUnder, conflict } = input;
    const destSiblingNamesLower = new Set(
        destGroups
            .filter((g) => (g.ParentStepGroupId ?? null) === attachUnder)
            .map((g) => g.Name.toLowerCase()),
    );
    const renamedRoots: Array<{ OldName: string; NewName: string }> = [];
    const effectiveName = new Map<number, string>();
    const collisions: string[] = [];
    for (const g of sourceGroups) {
        const isRoot = g.ParentStepGroupId === null || !sourceIdSet.has(g.ParentStepGroupId);
        if (!isRoot) continue;
        const outcome = resolveRootNameConflict(g, destSiblingNamesLower, conflict);
        if ("Reason" in outcome) { return outcome; }
        applyRootOutcome(outcome, g, effectiveName, destSiblingNamesLower, renamedRoots, collisions);
    }
    if (conflict === "Fail" && collisions.length > 0) {
        return {
            Reason: "NameConflict",
            Detail:
                `OnNameConflict='Fail' and the following root group name(s) already exist ` +
                `in the destination: ${collisions.join(", ")}.`,
            OffendingNames: collisions,
        };
    }
    const skippedRootIds = new Set<number>();
    for (const [id, name] of effectiveName) {
        if (name === "") skippedRootIds.add(id);
    }
    const skippedSubtree = collectSubtree(sourceGroups, skippedRootIds);
    return { effectiveName, renamedRoots, skippedSubtree };
}

type RootOutcome =
    | { Kind: "Keep" | "Collision" | "Skip"; Name: string }
    | { Kind: "Rename"; OldName: string; NewName: string }
    | ImportFailure;

function resolveRootNameConflict(
    g: StepGroupRow,
    destSiblingNamesLower: ReadonlySet<string>,
    conflict: ConflictPolicy,
): RootOutcome {
    if (!destSiblingNamesLower.has(g.Name.toLowerCase())) {
        return { Kind: "Keep", Name: g.Name };
    }
    if (conflict === "Fail") { return { Kind: "Collision", Name: g.Name }; }
    if (conflict === "Skip") { return { Kind: "Skip", Name: g.Name }; }
    const renamed = uniqueRenameFor(g.Name, destSiblingNamesLower);
    if (renamed === null) {
        return {
            Reason: "NameConflict",
            Detail:
                `Could not find a free rename slot for "${g.Name}" after ` +
                `${RENAME_MAX_ATTEMPTS} attempts.`,
            OffendingNames: [g.Name],
        };
    }
    return { Kind: "Rename", OldName: g.Name, NewName: renamed };
}

function applyRootOutcome(
    outcome: { Kind: "Keep" | "Collision" | "Skip"; Name: string } | { Kind: "Rename"; OldName: string; NewName: string },
    g: StepGroupRow,
    effectiveName: Map<number, string>,
    destSiblingNamesLower: Set<string>,
    renamedRoots: Array<{ OldName: string; NewName: string }>,
    collisions: string[],
): void {
    if (outcome.Kind === "Keep") {
        effectiveName.set(g.StepGroupId, g.Name);
        destSiblingNamesLower.add(g.Name.toLowerCase());
        return;
    }
    if (outcome.Kind === "Collision") { collisions.push(g.Name); return; }
    if (outcome.Kind === "Skip") { effectiveName.set(g.StepGroupId, ""); return; }
    if (outcome.Kind === "Rename") {
        renamedRoots.push({ OldName: outcome.OldName, NewName: outcome.NewName });
        destSiblingNamesLower.add(outcome.NewName.toLowerCase());
        effectiveName.set(g.StepGroupId, outcome.NewName);
    }


}

interface AtomicMergeInput {
    readonly init: RunStepGroupImportInit;
    readonly manifest: StepGroupExportManifest;
    readonly attachUnder: number | null;
    readonly graph: SourceGraph;
    readonly plan: NameConflictPlan;
}

function performAtomicMerge(ctx: AtomicMergeInput): StepGroupImportResult {
    const { init, manifest, attachUnder, graph, plan } = ctx;
    const destLib = init.Destination;
    const idMap = new Map<number, number>();
    const rawDest = destLib.raw;
    rawDest.exec("BEGIN;");
    try {
        const { importedGroupCount, rootStepGroupIds } = insertGroups({
            init, attachUnder, graph, plan, idMap,
        });
        const stepCount = insertSteps({ destLib, graph, plan, idMap });
        rawDest.exec("COMMIT;");
        return {
            Reason: "Ok",
            Manifest: manifest,
            DestinationProjectId: init.DestinationProjectId,
            AttachedUnderStepGroupId: attachUnder,
            RootStepGroupIds: rootStepGroupIds,
            IdMap: Array.from(idMap.entries()).map(([OldId, NewId]) => ({ OldId, NewId })),
            RenamedRoots: [...plan.renamedRoots],
            Counts: {
                StepGroups: importedGroupCount,
                Steps: stepCount,
                RunGroupRefs: graph.runGroupRefs,
            },
        };
    } catch (err) {
        try {
            rawDest.exec("ROLLBACK;");
        } catch { // allow-swallow: ROLLBACK after merge failure - original err is returned; rollback failure is secondary.
            /* ignore - rollback failure is secondary to the original error */
        }
        return {
            Reason: "InternalError",
            Detail: err instanceof Error ? err.message : "merge transaction failed",
        };
    }
}

interface InsertGroupsInput {
    readonly init: RunStepGroupImportInit;
    readonly attachUnder: number | null;
    readonly graph: SourceGraph;
    readonly plan: NameConflictPlan;
    readonly idMap: Map<number, number>;
}

function insertGroups(
    input: InsertGroupsInput,
): { importedGroupCount: number; rootStepGroupIds: number[] } {
    const { init, attachUnder, graph, plan, idMap } = input;
    const rootStepGroupIds: number[] = [];
    let importedGroupCount = 0;
    for (const g of graph.sourceGroups) {
        if (plan.skippedSubtree.has(g.StepGroupId)) continue;
        const isRoot = g.ParentStepGroupId === null || !graph.sourceIdSet.has(g.ParentStepGroupId);
        const newParent = isRoot
            ? attachUnder
            : (idMap.get(g.ParentStepGroupId as number) ?? null);
        const name = isRoot
            ? (plan.effectiveName.get(g.StepGroupId) ?? g.Name)
            : g.Name;
        const newId = init.Destination.createGroup({
            ProjectId: init.DestinationProjectId,
            ParentStepGroupId: newParent,
            Name: name,
            Description: g.Description,
            OrderIndex: g.OrderIndex,
        });
        idMap.set(g.StepGroupId, newId);
        importedGroupCount += 1;
        if (isRoot) rootStepGroupIds.push(newId);
    }
    return { importedGroupCount, rootStepGroupIds };
}

interface InsertStepsInput {
    readonly destLib: StepLibraryDb;
    readonly graph: SourceGraph;
    readonly plan: NameConflictPlan;
    readonly idMap: ReadonlyMap<number, number>;
}

// Insert steps in two passes: non-RunGroup first, then RunGroup with
// rewritten TargetStepGroupId. This avoids depending on insertion order
// of group IDs (the runtime CHECK constraint requires a non-null target
// for RunGroup steps, so we cannot defer FK validation).
function insertSteps(input: InsertStepsInput): number {
    const { destLib, graph, idMap } = input;
    let stepCount = 0;
    const runGroupSteps: StepRow[] = [];
    for (const s of graph.allSourceSteps) {
        const newGroupId = idMap.get(s.StepGroupId);
        if (newGroupId === undefined) continue; // skipped subtree
        if (s.StepKindId === StepKindId.RunGroup) {
            runGroupSteps.push(s);
            continue;
        }
        destLib.appendStep({
            StepGroupId: newGroupId,
            StepKindId: s.StepKindId,
            Label: s.Label,
            PayloadJson: s.PayloadJson,
        });
        stepCount += 1;
    }
    for (const s of runGroupSteps) {
        const newGroupId = idMap.get(s.StepGroupId);
        if (newGroupId === undefined) continue;
        const oldTarget = s.TargetStepGroupId;
        const newTarget = oldTarget === null ? null : (idMap.get(oldTarget) ?? null);
        if (newTarget === null) {
            // Target was in a skipped subtree - bail and roll back.
            throw new Error(
                `RunGroup StepId=${s.StepId} targets a group that was skipped due to ` +
                `name conflict policy. Re-run with OnNameConflict='Rename' or 'Fail'.`,
            );
        }
        destLib.appendStep({
            StepGroupId: newGroupId,
            StepKindId: StepKindId.RunGroup,
            Label: s.Label,
            TargetStepGroupId: newTarget,
        });
        stepCount += 1;
    }
    return stepCount;
}


function collectSubtree(
    rows: ReadonlyArray<StepGroupRow>,
    rootIds: ReadonlySet<number>,
): Set<number> {
    if (rootIds.size === 0) return new Set();
    const out = new Set<number>(rootIds);
    let changed = true;
    while (changed) {
        changed = false;
        for (const r of rows) {
            if (r.ParentStepGroupId !== null && out.has(r.ParentStepGroupId) && !out.has(r.StepGroupId)) {
                out.add(r.StepGroupId);
                changed = true;
            }
        }
    }
    return out;
}
