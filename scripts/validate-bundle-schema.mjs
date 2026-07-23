#!/usr/bin/env node
/**
 * Validate every prompts-bundle fixture against the JSON schema (plan 12 step 28).
 *
 * Runs `ajv` (draft-07) against `schemas/prompts-export-bundle.schema.json`
 * for every `.json` fixture under `test/fixtures/prompt-bundles/`.
 *
 * Files whose name starts with `valid-` MUST validate.
 * Files whose name starts with `invalid-` MUST NOT validate.
 *
 * Exit code is non-zero if any file's actual result disagrees with its
 * declared expectation, so this is safe to wire into a `pnpm build`
 * chain or a CI step (see `.github/workflows/ci.yml`).
 *
 * Error logs are printed with the offending file path + the raw ajv
 * error list + the invariant that was violated. No swallowed errors.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvPkg from 'ajv';

const Ajv = AjvPkg.default || AjvPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMA_PATH = resolve(ROOT, 'schemas/prompts-export-bundle.schema.json');
const FIXTURES_DIR = resolve(ROOT, 'test/fixtures/prompt-bundles');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const schema = loadJson(SCHEMA_PATH);
const EXPECTED_SCHEMA_VERSION = schema?.properties?.schemaVersion?.const;
if (typeof EXPECTED_SCHEMA_VERSION !== 'number') {
  console.error('[validate-bundle-schema] Schema is missing properties.schemaVersion.const at ' + SCHEMA_PATH);
  process.exit(2);
}
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const fixtures = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
if (fixtures.length === 0) {
  console.error('[validate-bundle-schema] No fixtures found in ' + FIXTURES_DIR);
  process.exit(2);
}

let failures = 0;
for (const filename of fixtures) {
  const path = resolve(FIXTURES_DIR, filename);
  const value = loadJson(path);
  const ok = validate(value);
  const expectValid = filename.startsWith('valid-');
  const expectInvalid = filename.startsWith('invalid-');
  const expectRuntimeInvalid = filename.startsWith('runtime-invalid-');

  if (!expectValid && !expectInvalid && !expectRuntimeInvalid) {
    console.error('[validate-bundle-schema] Fixture ' + filename + ' is neither valid-*, invalid-*, nor runtime-invalid-*; rename to declare intent.');
    failures += 1;
    continue;
  }

  // `runtime-invalid-*` fixtures are schema-valid by construction — they
  // exist to test cross-field runtime invariants (e.g. entryCount vs
  // entries.length) that a static JSON Schema cannot express. Schema
  // must accept them; the vitest runtime suite rejects them.
  if (expectRuntimeInvalid) {
    if (!ok) {
      console.error('[validate-bundle-schema] FAIL ' + filename + ' — declared runtime-invalid but the static schema also rejected it. Move to invalid-* or fix the fixture.');
      failures += 1;
      continue;
    }
    console.log('  [OK] ' + filename + ' (schema-valid, runtime-invalid — enforced by validatePromptsBundle)');
    continue;
  }

  if (expectValid && !ok) {
    console.error('[validate-bundle-schema] FAIL ' + filename + ' — declared valid but schema rejected it.');
    console.error('  Errors: ' + JSON.stringify(validate.errors, null, 2));
    failures += 1;
    continue;
  }
  if (expectInvalid && ok) {
    console.error('[validate-bundle-schema] FAIL ' + filename + ' — declared invalid but schema accepted it. Invariant broken.');
    failures += 1;
    continue;
  }
  console.log('  [OK] ' + filename + ' (' + (ok ? 'valid' : 'rejected as expected') + ')');
}

// Extra gate (also enforces step 29): no valid or runtime-invalid fixture may claim a mismatched schemaVersion.
// Version is sourced from the schema's `properties.schemaVersion.const` so there's exactly one place to bump.
for (const filename of fixtures) {
  if (filename.startsWith('invalid-')) continue;
  const value = loadJson(resolve(FIXTURES_DIR, filename));
  const sv = value && typeof value === 'object' ? value.schemaVersion : undefined;
  if (sv !== EXPECTED_SCHEMA_VERSION) {
    console.error('[validate-bundle-schema] FAIL ' + filename + ' - schemaVersion=' + String(sv) + ', expected ' + EXPECTED_SCHEMA_VERSION + '.');
    failures += 1;
  }
}

if (failures > 0) {
  console.error('[validate-bundle-schema] ' + failures + ' failure(s). See errors above.');
  process.exit(1);
}
console.log('[validate-bundle-schema] All ' + fixtures.length + ' fixture(s) matched their declared expectation.');
