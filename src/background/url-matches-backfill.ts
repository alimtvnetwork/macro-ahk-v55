/**
 * Marco Extension — urlMatches Backfill (P2)
 *
 * Populates `StoredScript.urlMatches` for user-imported scripts that pre-date
 * the manifest-seeder field. For each script with missing/empty `urlMatches`,
 * we look up every project that binds it via `project.scripts[].path`, union
 * the project's `targetUrls[].pattern` values, and persist the result so the
 * auto-attach evaluator (C2) can match without an instruction.json lookup.
 *
 * @see mem://features/auto-attach-policy.md — C2 url-match condition
 * @see src/background/auto-attach.ts — consumer of `urlMatches`
 * @see src/background/manifest-seeder.ts — populates `urlMatches` for seed scripts
 */

import type { StoredScript } from "../shared/script-config-types";
import type { StoredProject } from "../shared/project-types";

const STORAGE_KEY_SCRIPTS = "marco_scripts";
const STORAGE_KEY_PROJECTS = "marco_projects";

interface BackfillResult {
    scanned: number;
    updated: number;
    skippedAlreadyPopulated: number;
    skippedNoBindingFound: number;
}

/** Normalizes a script identifier (basename, lowercased) for cross-matching. */
function basename(path: string): string {
    const slash = path.replace(/\\/g, "/").split("/").pop() ?? path;
    return slash.split(/[?#]/)[0]!.toLowerCase();
}

/** Returns true if a project's script entry refers to the given stored script. */
function projectBindsScript(
    project: StoredProject,
    script: StoredScript,
): boolean {
    const scriptKeys = new Set<string>();
    if (script.name) scriptKeys.add(basename(script.name));
    if (script.filePath) scriptKeys.add(basename(script.filePath));

    return (project.scripts ?? []).some((entry) => {
        if (entry.path === script.id) return true;
        if (entry.path === script.name) return true;
        return scriptKeys.has(basename(entry.path));
    });
}

async function readStoredArrays(): Promise<{ scripts: StoredScript[]; projects: StoredProject[] }> {
    const [scriptsRaw, projectsRaw] = await Promise.all([
        chrome.storage.local.get(STORAGE_KEY_SCRIPTS),
        chrome.storage.local.get(STORAGE_KEY_PROJECTS),
    ]);
    const scripts: StoredScript[] = Array.isArray(scriptsRaw[STORAGE_KEY_SCRIPTS])
        ? (scriptsRaw[STORAGE_KEY_SCRIPTS] as StoredScript[])
        : [];
    const projects: StoredProject[] = Array.isArray(projectsRaw[STORAGE_KEY_PROJECTS])
        ? (projectsRaw[STORAGE_KEY_PROJECTS] as StoredProject[])
        : [];
    return { scripts, projects };
}

function collectPatternsForScript(script: StoredScript, projects: StoredProject[]): Set<string> {
    const patterns = new Set<string>();
    for (const project of projects) {
        if (!projectBindsScript(project, script)) continue;
        for (const rule of project.targetUrls ?? []) {
            if (rule?.pattern) patterns.add(rule.pattern);
        }
    }
    return patterns;
}

function applyPatternsToScript(script: StoredScript, patterns: Set<string>): void {
    script.urlMatches = Array.from(patterns);
    script.updatedAt = new Date().toISOString();
    console.log(
        "[url-matches-backfill] Backfilled urlMatches for script id=%s name=%s (%d pattern(s))",
        script.id,
        script.name,
        patterns.size,
    );
}

function processScript(
    script: StoredScript,
    projects: StoredProject[],
    result: BackfillResult,
): boolean {
    const hasMatches = Array.isArray(script.urlMatches) && script.urlMatches.length > 0;
    if (hasMatches) { result.skippedAlreadyPopulated += 1; return false; }

    const patterns = collectPatternsForScript(script, projects);
    if (patterns.size === 0) {
        result.skippedNoBindingFound += 1;
        console.log(
            "[url-matches-backfill] No binding found, skipping script id=%s name=%s",
            script.id,
            script.name,
        );
        return false;
    }

    applyPatternsToScript(script, patterns);
    result.updated += 1;
    return true;
}

/**
 * Backfills `urlMatches` for every stored script with missing/empty value.
 * Idempotent: scripts already carrying a non-empty `urlMatches` are skipped.
 */
export async function backfillScriptUrlMatches(): Promise<BackfillResult> {
    const { scripts, projects } = await readStoredArrays();
    const result: BackfillResult = {
        scanned: scripts.length,
        updated: 0,
        skippedAlreadyPopulated: 0,
        skippedNoBindingFound: 0,
    };

    let mutated = false;
    for (const script of scripts) {
        if (processScript(script, projects, result)) { mutated = true; }
    }

    if (mutated) {
        await chrome.storage.local.set({ [STORAGE_KEY_SCRIPTS]: scripts });
    }
    return result;
}
