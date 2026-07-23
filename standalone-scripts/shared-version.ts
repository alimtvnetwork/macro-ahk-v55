/**
 * Shared version module for standalone-scripts packages.
 *
 * Single source of truth is `version.json` at the repo root.
 * DO NOT hand-edit a version literal anywhere else — import from here.
 * See plan `.lovable/plans/pending/29-version-json-single-source-of-truth.md`.
 */
import * as pkg from "../version.json";

export const VERSION: string = pkg.version;
