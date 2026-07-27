#!/usr/bin/env node
/**
 * resolve-repo-slug.mjs
 *
 * Single source of truth for "what is the current owner/repo slug?"
 *
 * Precedence:
 *   1. process.env.GITHUB_REPOSITORY   (set by every GitHub Actions runner)
 *   2. process.env.MARCO_DEFAULT_REPO  (operator override for local runs)
 *   3. `git config --get remote.origin.url` parsed to owner/repo
 *   4. optional fallback passed in     (typically installer-contract.json → repo.fallback)
 *
 * Never throws unless every source is missing AND no fallback is provided:
 * the release pipeline calls this in `setup` and must not fail on rename.
 *
 * See .lovable/memory/features/release-pipeline-repo-url-agnostic.md for the
 * full contract and rationale.
 */
import { execSync } from "node:child_process";

const SLUG_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/** Parse `owner/repo` out of an http(s) or ssh git remote URL. */
export function parseRemoteUrl(remoteUrl) {
    if (typeof remoteUrl !== "string" || remoteUrl.length === 0) return null;
    const trimmed = remoteUrl.trim().replace(/\.git$/, "");
    // https://github.com/owner/repo or http://.../owner/repo
    const httpMatch = trimmed.match(/[/:]([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
    if (httpMatch) {
        const slug = `${httpMatch[1]}/${httpMatch[2]}`;
        return SLUG_RE.test(slug) ? slug : null;
    }
    return null;
}

/**
 * @param {{ fallback?: string, cwd?: string }} [options]
 * @returns {{ slug: string, source: "env-github"|"env-marco"|"git-remote"|"fallback" }}
 */
export function resolveRepoSlug(options = {}) {
    const env = process.env;
    if (env.GITHUB_REPOSITORY && SLUG_RE.test(env.GITHUB_REPOSITORY)) {
        return { slug: env.GITHUB_REPOSITORY, source: "env-github" };
    }
    if (env.MARCO_DEFAULT_REPO && SLUG_RE.test(env.MARCO_DEFAULT_REPO)) {
        return { slug: env.MARCO_DEFAULT_REPO, source: "env-marco" };
    }
    try {
        const remote = execSync("git config --get remote.origin.url", {
            cwd: options.cwd || process.cwd(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        const slug = parseRemoteUrl(remote);
        if (slug) return { slug, source: "git-remote" };
    } catch {
        // no git remote → fall through
    }
    if (options.fallback && SLUG_RE.test(options.fallback)) {
        return { slug: options.fallback, source: "fallback" };
    }
    throw new Error(
        "resolveRepoSlug: no signal — set GITHUB_REPOSITORY, MARCO_DEFAULT_REPO, add a git remote, or pass options.fallback.",
    );
}

// CLI: `node scripts/resolve-repo-slug.mjs [fallback]` prints the slug.
if (import.meta.url === `file://${process.argv[1]}`) {
    const fallback = process.argv[2];
    const { slug, source } = resolveRepoSlug({ fallback });
    process.stdout.write(`${slug}\n`);
    if (process.env.DEBUG_RESOLVE_REPO_SLUG) {
        process.stderr.write(`[resolve-repo-slug] source=${source}\n`);
    }
}