# Interpolator Pseudo-code

```ts
const TOKEN = /\{\{\s*([A-Z][A-Za-z0-9]*)\s*\}\}/g;

export function interpolate(template: string, ctx: InterpolationContext, declared: VarDecl[]): string {
  return template.replace(TOKEN, (_, name) => {
    const decl = declared.find(d => d.Name === name);
    if (!decl) throw new SpecError("UndeclaredVariable", name);

    const raw = resolveWaterfall(name, ctx);
    if (raw === undefined) {
      if (decl.Required) throw new SpecError("MissingVariable", name);
      return String(decl.Default ?? "");
    }

    const coerced = coerce(raw, decl);
    if (decl.Sensitive) ctx.recordSensitive(name);
    return stringify(coerced);
  });
}

function resolveWaterfall(name: string, ctx: InterpolationContext) {
  return ctx.stepScope[name]
    ?? ctx.macroScope[name]
    ?? ctx.uiInput[name]
    ?? ctx.builtIn[name]
    ?? undefined;
}
```

## Coercion

```ts
function coerce(raw: JsonValue, decl: VarDecl): JsonValue {
  switch (decl.Type) {
    case "integer": { const n = Number(raw); if (!Number.isInteger(n)) throw new SpecError("VarTypeMismatch", `${decl.Name}=integer`); return n; }
    case "number":  { const n = Number(raw); if (Number.isNaN(n)) throw new SpecError("VarTypeMismatch", `${decl.Name}=number`); return n; }
    case "boolean": return raw === true || raw === "true";
    case "enum":    if (!decl.Values?.includes(raw)) throw new SpecError("VarEnumMismatch", `${decl.Name}`); return raw;
    case "path":    assertSafePath(String(raw)); return String(raw);
    case "string":  return String(raw);
  }
}
```

## Masking on emit

```ts
function maskForLog(rendered: string, sensitiveNames: Set<string>, varSnapshot: Record<string, JsonValue>): string {
  let out = rendered;
  for (const n of sensitiveNames) {
    const v = String(varSnapshot[n] ?? "");
    if (v.length) out = out.split(v).join("***");
  }
  return out;
}
```
