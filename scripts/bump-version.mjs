#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_JSON = resolve(ROOT, "version.json");
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function readVersionFile() {
  return JSON.parse(readFileSync(VERSION_JSON, "utf8"));
}

function assertSemver(version) {
  if (typeof version !== "string" || !SEMVER_PATTERN.test(version)) {
    throw new Error(`version.json version must be X.Y.Z (got ${JSON.stringify(version)})`);
  }
}

function bumpVersion(current, bumpType) {
  const parts = current.split(".").map(Number);
  if (bumpType === "patch") return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  if (bumpType === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  if (bumpType === "major") return `${parts[0] + 1}.0.0`;
  return bumpType;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/bump-version.mjs <version|patch|minor|major>");
  const versionFile = readVersionFile();
  assertSemver(versionFile.version);
  const nextVersion = bumpVersion(versionFile.version, input);
  assertSemver(nextVersion);
  versionFile.version = nextVersion;
  versionFile.releaseDate = todayUtc();
  writeFileSync(VERSION_JSON, `${JSON.stringify(versionFile, null, 2)}\n`, "utf8");
  console.log(`version.json updated to ${nextVersion}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bump-version] ${message}`);
  process.exit(1);
}