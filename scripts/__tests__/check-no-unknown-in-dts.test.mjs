#!/usr/bin/env node
/**
 * Unit + integration test for `scripts/check-no-unknown-in-dts.mjs`.
 *
 * Verifies:
 *   1. `countUnknown` excludes the canonical `type CaughtError = unknown;`
 *      allow-leaf.
 *   2. `countUnknown` ignores `unknown` mentions inside line and block
 *      comments (prose only, not code tokens).
 *   3. `countUnknown` counts every code-level `unknown` outside the leaf.
 *   4. End-to-end: the scanner exits 0 on the real repo (baseline holds).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { countUnknown } from "../check-no-unknown-in-dts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-no-unknown-in-dts.mjs");

test("countUnknown — CaughtError declaration is excluded", () => {
    const src = `type CaughtError = unknown;`;
    assert.equal(countUnknown(src), 0);
});

test("countUnknown — comments do not count", () => {
    const src = `
        // This file does not use unknown.
        /* unknown is forbidden here */
        export type Foo = string;
    `;
    assert.equal(countUnknown(src), 0);
});

test("countUnknown — bare unknown in code counts", () => {
    const src = `
        type CaughtError = unknown;
        export type Bag = Record<string, unknown>;
        export type Cb = (e: unknown) => void;
    `;
    assert.equal(countUnknown(src), 2);
});

test("countUnknown — substring 'unknownThing' does not false-positive", () => {
    const src = `export type Foo = { unknownField: string };`;
    assert.equal(countUnknown(src), 0);
});

test("scanner exits 0 on the real repo (baseline holds)", () => {
    const r = spawnSync("node", [SCRIPT], { encoding: "utf-8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /OK — no-unknown-in-dts/);
});
