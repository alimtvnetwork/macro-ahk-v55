#!/usr/bin/env node
/**
 * Tests for scripts/resolve-repo-slug.mjs — the repo-URL-agnostic
 * resolver behind installer-contract autoResolve mode. See
 * .lovable/memory/features/release-pipeline-repo-url-agnostic.md.
 *
 * Uses node:test so no npm install is needed (matches sibling
 * scripts/__tests__/*.test.mjs convention).
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseRemoteUrl, resolveRepoSlug } from "../resolve-repo-slug.mjs";

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

test("prefers GITHUB_REPOSITORY when set", () => {
    process.env.GITHUB_REPOSITORY = "alimtvnetwork/macro-ahk-v55";
    const { slug, source } = resolveRepoSlug({ fallback: "x/y" });
    assert.equal(slug, "alimtvnetwork/macro-ahk-v55");
    assert.equal(source, "env-github");
});

test("falls through to MARCO_DEFAULT_REPO when GITHUB_REPOSITORY missing", () => {
    process.env.MARCO_DEFAULT_REPO = "acme/foo";
    const { slug, source } = resolveRepoSlug({ fallback: "x/y" });
    assert.equal(slug, "acme/foo");
    assert.equal(source, "env-marco");
});

test("uses the fallback when no env or git remote is available", () => {
    const { slug } = resolveRepoSlug({
        cwd: "/tmp",
        fallback: "alimtvnetwork/macro-ahk-v55",
    });
    assert.equal(slug, "alimtvnetwork/macro-ahk-v55");
});

test("throws when every source is missing and no fallback is passed", () => {
    assert.throws(() => resolveRepoSlug({ cwd: "/tmp" }), /no signal/);
});

test("parses https remote URLs", () => {
    assert.equal(
        parseRemoteUrl("https://github.com/alimtvnetwork/macro-ahk-v55.git"),
        "alimtvnetwork/macro-ahk-v55",
    );
    assert.equal(parseRemoteUrl("https://github.com/acme/foo"), "acme/foo");
});

test("parses ssh remote URLs", () => {
    assert.equal(
        parseRemoteUrl("git@github.com:alimtvnetwork/macro-ahk-v55.git"),
        "alimtvnetwork/macro-ahk-v55",
    );
});

test("rejects obviously invalid remotes", () => {
    assert.equal(parseRemoteUrl(""), null);
    assert.equal(parseRemoteUrl("not-a-url"), null);
});