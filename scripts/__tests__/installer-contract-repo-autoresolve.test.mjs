/**
 * Tests for scripts/resolve-repo-slug.mjs — the repo-URL-agnostic
 * resolver behind installer-contract autoResolve mode. See
 * .lovable/memory/features/release-pipeline-repo-url-agnostic.md.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseRemoteUrl, resolveRepoSlug } from "../resolve-repo-slug.mjs";

describe("resolve-repo-slug", () => {
    const savedGithub = process.env.GITHUB_REPOSITORY;
    const savedMarco = process.env.MARCO_DEFAULT_REPO;

    beforeEach(() => {
        delete process.env.GITHUB_REPOSITORY;
        delete process.env.MARCO_DEFAULT_REPO;
    });
    afterEach(() => {
        if (savedGithub === undefined) delete process.env.GITHUB_REPOSITORY;
        else process.env.GITHUB_REPOSITORY = savedGithub;
        if (savedMarco === undefined) delete process.env.MARCO_DEFAULT_REPO;
        else process.env.MARCO_DEFAULT_REPO = savedMarco;
    });

    it("prefers GITHUB_REPOSITORY when set", () => {
        process.env.GITHUB_REPOSITORY = "alimtvnetwork/macro-ahk-v53";
        const { slug, source } = resolveRepoSlug({ fallback: "x/y" });
        expect(slug).toBe("alimtvnetwork/macro-ahk-v53");
        expect(source).toBe("env-github");
    });

    it("falls through to MARCO_DEFAULT_REPO when GITHUB_REPOSITORY missing", () => {
        process.env.MARCO_DEFAULT_REPO = "acme/foo";
        const { slug, source } = resolveRepoSlug({ fallback: "x/y" });
        expect(slug).toBe("acme/foo");
        expect(source).toBe("env-marco");
    });

    it("uses the fallback when no env or git remote is available", () => {
        const { slug } = resolveRepoSlug({
            cwd: "/tmp",
            fallback: "alimtvnetwork/macro-ahk-v53",
        });
        expect(slug).toBe("alimtvnetwork/macro-ahk-v53");
    });

    it("throws when every source is missing and no fallback is passed", () => {
        expect(() => resolveRepoSlug({ cwd: "/tmp" })).toThrow(/no signal/);
    });

    it("parses https remote URLs", () => {
        expect(parseRemoteUrl("https://github.com/alimtvnetwork/macro-ahk-v53.git")).toBe(
            "alimtvnetwork/macro-ahk-v53",
        );
        expect(parseRemoteUrl("https://github.com/acme/foo")).toBe("acme/foo");
    });

    it("parses ssh remote URLs", () => {
        expect(parseRemoteUrl("git@github.com:alimtvnetwork/macro-ahk-v53.git")).toBe(
            "alimtvnetwork/macro-ahk-v53",
        );
    });

    it("rejects obviously invalid remotes", () => {
        expect(parseRemoteUrl("")).toBeNull();
        expect(parseRemoteUrl("not-a-url")).toBeNull();
    });
});