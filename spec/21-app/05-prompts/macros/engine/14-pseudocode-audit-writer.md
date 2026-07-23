# Audit Writer Pseudo-code

```ts
export async function writeAuditArtifacts(runId: string, output: AuditOutput): Promise<void> {
  const dir = `spec/audit/${runId}`;

  // 1. Gap analysis markdown (human)
  await fs.write(`${dir}/01-gap-analysis.md`, renderMarkdown(output));

  // 2. Findings JSON (machine)
  const masked = maskSensitiveInFindings(output);
  await fs.write(`${dir}/02-findings.json`, JSON.stringify(masked, null, 2));

  // 3. Append run log (jsonl)
  await fs.append(`${dir}/_log.jsonl`, JSON.stringify({ at: nowIso(), event: "AuditWritten", count: output.Findings.length }) + "\n");
}

export async function writeFinalReport(runId: string, output: AuditOutput): Promise<void> {
  const dir = `spec/audit/${runId}`;
  await fs.write(`${dir}/99-final-report.md`, renderFinalMarkdown(output));
}
```

## Naming rule

- Sequential prefix `01-`, `02-`, …, `98-`; final report is always `99-final-report.md`.
- Subsequent `audit` runs overwrite their own numbered file but never `99-…`.

## Migration on read

```ts
export function migrateAuditOutput(raw: JsonValue): AuditOutput {
  const v = (raw as { SchemaVersion?: number })?.SchemaVersion ?? 0;
  if (v === 1) return raw as AuditOutput;
  if (v === 0) return upgradeFromV0(raw);
  throw new SpecError("UnknownAuditSchemaVersion", `v=${v}`);
}
```
