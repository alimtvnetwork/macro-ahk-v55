def apply_line_replacement(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Sort replacements in reverse order so we don't mess up line numbers
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    for start, end, new_lines in replacements:
        lines[start-1:end] = [new_lines]
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

rep1 = """        <SelectorTesterInput expression={expression} setExpression={setExpression} kind={kind} setKind={setKind} />\n"""

rep2 = """        <SelectorTesterResult result={result} matched={matched} errored={errored} />
      </CardContent>
    </Card>
  );
}

function SelectorTesterInput({ expression, setExpression, kind, setKind }: {
  readonly expression: string;
  readonly setExpression: (value: string) => void;
  readonly kind: SelectorTestKind;
  readonly setKind: (value: SelectorTestKind) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        placeholder="#go    or    //button[@id='go']"
        className="font-mono text-xs"
        aria-label="Selector expression"
        spellCheck={false}
      />
      <div className="flex rounded-md border border-border overflow-hidden shrink-0">
        {KIND_OPTIONS.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant={kind === o.value ? "default" : "ghost"}
            size="sm"
            className="rounded-none h-9 px-2 text-[11px]"
            onClick={() => setKind(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SelectorTesterResult({ result, matched, errored }: {
  readonly result: ReturnType<typeof testSelector> | null;
  readonly matched: boolean;
  readonly errored: boolean;
}) {
  if (result === null) {
    return (
      <p className="text-xs text-muted-foreground italic py-2 text-center">
                        Paste a CSS or XPath selector to test it against the current page.
      </p>
    );
  }
  if (errored) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{result.Error}</span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {matched
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
          : <XCircle className="h-4 w-4 text-destructive" aria-hidden />}
        <Badge
          variant={matched ? "secondary" : "destructive"}
          className="text-[10px] px-1.5 py-0"
        >
          {result.MatchCount} match{result.MatchCount === 1 ? "" : "es"}
        </Badge>
      </div>
      <SelectorTesterFirstMatch matched={matched} result={result} />
    </div>
  );
}

function SelectorTesterFirstMatch({ matched, result }: {
  readonly matched: boolean;
  readonly result: ReturnType<typeof testSelector>;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2 text-xs">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                First match
      </div>
      <code className={`break-all ${matched ? "text-foreground" : "text-muted-foreground italic"}`}>
        {elementSummary(result.FirstMatch)}
      </code>
      {result.FirstMatch !== null && result.FirstMatch.OuterHtmlSnippet.length > 0 && (
        <pre className="mt-1.5 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
          {result.FirstMatch.OuterHtmlSnippet}
        </pre>
      )}
    </div>
  );
}\n"""

apply_line_replacement("src/components/recorder/SelectorTesterPanel.tsx", [
    (88, 111, rep1),
    (122, 162, rep2)
])
print("Done")
