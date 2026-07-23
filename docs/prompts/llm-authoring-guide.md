# Prompts Bundle: LLM Authoring Guide

**Audience:** any LLM (or human) asked to produce a prompts bundle that this
Chrome extension can import via its Prompts dropdown.

**Goal:** generate a JSON file that passes
`schemas/prompts-export-bundle.schema.json` and imports cleanly.

---

## 1. The envelope

Every bundle is a single JSON object with this exact top-level shape:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1,
  "exportedAt": "2026-07-17T12:00:00.000Z",
  "exporterVersion": "4.49.0",
  "entryCount": 2,
  "format": "json",
  "entries": [ /* prompt entries, see §2 */ ]
}
```

Rules:

- `id`: any RFC-4122 UUID (lowercase hex, hyphenated).
- `schemaVersion`: MUST be `1` (integer, not string).
- `exportedAt`: UTC ISO-8601 timestamp.
- `exporterVersion`: semver `x.y.z` string. If unknown, use `"0.0.0"`.
- `entryCount`: MUST equal `entries.length`. Import rejects mismatches.
- `format`: `"json"` when the envelope is inline JSON. Omit or use
  `"zip"` / `"sqlite"` when produced by the ZIP or SQLite exporters.
- `entries`: array of prompt objects (§2). May be empty.

No extra top-level keys are allowed. `additionalProperties: false`.

---

## 2. Prompt entry

Minimum viable entry:

```json
{ "name": "Fix typos", "text": "Proofread the following passage..." }
```

Full entry with every optional field:

```json
{
  "id": "prompt-fix-typos",
  "slug": "fix-typos",
  "name": "Fix typos",
  "text": "Proofread the following passage and fix any typos.",
  "category": "editing",
  "tags": ["proofread", "grammar"],
  "isFavorite": false,
  "isDefault": false,
  "excludeFromExport": false,
  "order": 10,
  "version": "1.0.0",
  "isDynamic": false,
  "replaceKey": "",
  "replaceValues": [],
  "slugTemplate": "",
  "parentTitle": "",
  "parentSlug": "",
  "variantValue": ""
}
```

Required: `name` (non-empty string), `text` (string, may be empty).
Recommended: `slug` (stable merge key; kebab-case, unique per bundle).

### Dynamic-expansion entries

Used for series like `Next 1`, `Next 2`, `Plan 5`. The parent carries
`isDynamic: true`, a `replaceKey` (token found inside `text`, e.g. `${N}`),
`replaceValues` (list of substitutions), and `slugTemplate` (template with
the same token for generating child slugs).

```json
{
  "name": "Next ${N}",
  "text": "Do the next ${N} steps.",
  "slug": "next-n",
  "isDynamic": true,
  "replaceKey": "${N}",
  "replaceValues": ["1", "2", "3", "5", "10"],
  "slugTemplate": "next-${N}"
}
```

Children are generated at runtime; do NOT emit each child as a separate
entry unless the parent is absent.

---

## 3. Worked example — minimal, valid, importable

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1,
  "exportedAt": "2026-07-17T12:00:00.000Z",
  "exporterVersion": "4.49.0",
  "entryCount": 2,
  "format": "json",
  "entries": [
    {
      "slug": "proofread",
      "name": "Proofread",
      "text": "Proofread the passage. Return only the corrected version.",
      "category": "editing",
      "tags": ["proofread"],
      "order": 1
    },
    {
      "slug": "summarize",
      "name": "Summarize",
      "text": "Summarize the passage in 3 bullet points.",
      "category": "reading",
      "tags": ["summary"],
      "order": 2
    }
  ]
}
```

Save as `my-prompts.json` and drag into the Prompts Import / Export dialog.

---

## 4. Do

- Keep `slug` stable across exports so re-imports overwrite cleanly.
- Use UTF-8 without BOM. Use `\n` newlines inside `text`.
- Keep each `text` under ~8000 characters when possible.
- Set `excludeFromExport: true` on entries the user should never share.
- Sort `entries` by `order` ascending for predictable UI display.

## 5. Don't

- Don't invent new top-level keys. The schema rejects them.
- Don't use `schemaVersion: "1"` (string). It must be integer `1`.
- Don't include HTML in `text` unless the entry is meant to render HTML.
- Don't ship duplicate slugs. The importer treats them as conflicts.
- Don't rely on `entryCount` being auto-corrected. Set it yourself.

---

## 6. Alternative formats

The importer also accepts:

- **`.md`** — a markdown file whose fenced ```json block contains the
  envelope above. The importer extracts the first JSON code fence.
- **`.zip`** — a ZIP that contains `bundle.json` at its root plus optional
  per-prompt markdown files.
- **`.db` / `.sqlite`** — a SQLite database produced by the extension's
  own SQLite exporter. Third parties should prefer JSON.

When in doubt, produce **JSON**. It is the reference format.

---

## 7. Validating before shipping

If you have `ajv`:

```bash
npx ajv-cli validate \
  -s schemas/prompts-export-bundle.schema.json \
  -d my-prompts.json
```

Any error message points at the exact JSON path that failed.
