/**
 * LLM Authoring Guide - downloadable asset.
 *
 * Ships the docs/prompts/llm-authoring-guide.md content inline as a string
 * so the extension can offer a "Download LLM Guide" action from the
 * Prompts Import/Export dialog without any network fetch. When a user
 * hands this .md file to any LLM, that LLM has the full contract required
 * to author a valid prompts bundle for import.
 *
 * Keep this string in sync with docs/prompts/llm-authoring-guide.md.
 * A CI check (future work) will diff the two.
 */

export const LLM_GUIDE_FILENAME = 'prompts-llm-authoring-guide.md';

export const LLM_GUIDE_MARKDOWN = `# Prompts Bundle: LLM Authoring Guide

Audience: any LLM (or human) asked to produce a prompts bundle that this
Chrome extension can import via its Prompts dropdown.

Goal: generate a JSON file that passes
schemas/prompts-export-bundle.schema.json and imports cleanly.

## 1. Envelope

\`\`\`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "schemaVersion": 1,
  "exportedAt": "2026-07-17T12:00:00.000Z",
  "exporterVersion": "4.49.0",
  "entryCount": 2,
  "format": "json",
  "entries": []
}
\`\`\`

- id: any RFC-4122 UUID (lowercase, hyphenated).
- schemaVersion: MUST be integer 1.
- exportedAt: UTC ISO-8601 timestamp.
- exporterVersion: semver string x.y.z.
- entryCount: MUST equal entries.length.
- format: "json" for inline JSON envelopes.
- entries: array of prompt objects (may be empty).

No extra top-level keys allowed.

## 2. Prompt entry

Minimum:

\`\`\`json
{ "name": "Fix typos", "text": "Proofread the passage." }
\`\`\`

Full entry with every optional field:

\`\`\`json
{
  "id": "prompt-fix-typos",
  "slug": "fix-typos",
  "name": "Fix typos",
  "text": "Proofread the passage.",
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
\`\`\`

Required: name, text. Recommended: slug (kebab-case, unique).

### Dynamic entries (Next N, Plan N patterns)

\`\`\`json
{
  "name": "Next \${N}",
  "text": "Do the next \${N} steps.",
  "slug": "next-n",
  "isDynamic": true,
  "replaceKey": "\${N}",
  "replaceValues": ["1", "2", "3", "5", "10"],
  "slugTemplate": "next-\${N}"
}
\`\`\`

Children are expanded at runtime. Do NOT emit expanded children as
separate entries when the dynamic parent is present.

## 3. Worked example

\`\`\`json
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
      "text": "Proofread the passage. Return the corrected version.",
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
\`\`\`

## 4. Do

- Keep slug stable across exports so re-imports overwrite cleanly.
- UTF-8 without BOM. Use \\n newlines inside text.
- Keep each text under ~8000 characters when possible.
- Set excludeFromExport: true on entries that should never be shared.
- Sort entries by order ascending for predictable UI.

## 5. Don't

- No new top-level keys. Schema rejects them.
- No "1" string for schemaVersion. It must be integer 1.
- No HTML inside text unless the entry is meant to render HTML.
- No duplicate slugs. Importer treats them as conflicts.
- Don't rely on entryCount being auto-corrected. Set it yourself.

## 6. Alternative import formats

Importer also accepts:
- .md: markdown containing a fenced \`\`\`json block with the envelope.
- .zip: a ZIP with bundle.json at root plus optional per-prompt .md files.
- .db / .sqlite: SQLite produced by the extension's own exporter.

When in doubt, produce JSON. It is the reference format.

## 7. Validate before shipping

\`\`\`bash
npx ajv-cli validate \\
  -s schemas/prompts-export-bundle.schema.json \\
  -d my-prompts.json
\`\`\`
`;

export function downloadLlmGuide(): void {
  const blob = new Blob([LLM_GUIDE_MARKDOWN], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = LLM_GUIDE_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
