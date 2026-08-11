def apply_line_replacement(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Sort replacements in reverse order so we don't mess up line numbers
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    for start, end, new_lines in replacements:
        lines[start-1:end] = [new_lines]
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

rep1 = """function SelectorReplayTracePanelBody({ trace, report }: { readonly trace: ReturnType<typeof buildReplayTrace>; readonly report: FailureReport }) {
  return (
    <div className="space-y-2.5" data-testid="selector-replay-trace">
      <SummaryBar
        total={trace.Summary.Total}
        evaluated={trace.Summary.Evaluated}
        skipped={trace.Summary.Skipped}
        stoppedAt={trace.Summary.StoppedAt}
        outcome={trace.Summary.Outcome}
        snapshot={report.FormSnapshot}
      />
      {trace.Steps.length === 0 ? (
        <p
          data-testid="trace-empty"
          className="text-xs italic text-muted-foreground py-3 text-center"
        >
                    No selector attempts were recorded for this failure.
        </p>
      ) : (
        <ScrollArea className="max-h-72 pr-2">
          <ol className="space-y-1.5">
            {trace.Steps.map((s) => (
              <TraceStepRow key={s.Order} step={s} />
            ))}
          </ol>
        </ScrollArea>
      )}
    </div>
  );
}

export function SelectorReplayTracePanel({ report, embedded }: SelectorReplayTracePanelProps) {
  const trace = buildReplayTrace(report.Selectors);

  const body = <SelectorReplayTracePanelBody trace={trace} report={report} />;

  if (embedded === true) {
    return (
      <section
        aria-label="Selector replay trace"
        data-testid="selector-replay-trace-panel"
        className="rounded-md border border-border bg-card/40 p-3"
      >
        <header className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          <ListOrdered className="h-3 w-3" aria-hidden />
                    Replay trace
        </header>
        {body}
      </section>
    );
  }

  return (
    <Card data-testid="selector-replay-trace-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-primary" />
                    Selector replay trace
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}\n"""

rep2 = """function TraceStepRow({ step }: { readonly step: TraceStep }) {
  return (
    <li
      data-testid="trace-step-row"
      data-order={step.Order}
      data-status={step.Status}
      data-role={step.Role}
      className={`relative rounded-md border ${STATUS_TONE[step.Status]} p-2 text-xs space-y-1`}
    >
      <TraceStepRowHeader step={step} />
      <TraceStepRowDetails step={step} />
    </li>
  );
}

function TraceStepRowHeader({ step }: { readonly step: TraceStep }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                  #{step.Order}
      </Badge>
      <StatusIcon status={step.Status} />
      <Badge
        variant={step.Status === "matched" ? "default" : "outline"}
        className="text-[10px] px-1.5 py-0"
      >
        {STATUS_LABEL[step.Status]}
      </Badge>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        {step.Role}
      </Badge>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        {step.Strategy}
      </Badge>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
        {step.MatchCount} match{step.MatchCount === 1 ? "" : "es"}
      </Badge>
    </div>
  );
}

function TraceStepRowDetails({ step }: { readonly step: TraceStep }) {
  const showResolvedDistinct =
        step.ResolvedExpression !== step.Expression && step.Expression.length > 0;

  return (
    <>
      <div className="pl-5">
        <code
          className="block break-all font-mono text-foreground"
          title={step.ResolvedExpression}
        >
          {step.ResolvedExpression}
        </code>
        {showResolvedDistinct && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
                        Stored: <code className="break-all">{step.Expression}</code>
          </div>
        )}
      </div>

      <div className="pl-5 flex items-start gap-1 text-[11px] text-muted-foreground">
        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
        <span>
          {step.Note}
          {(step.Status === "missed" || step.Status === "errored") && (
            <>
              {" "}
              <span className="font-mono text-destructive">
                                ({step.FailureReason})
              </span>
            </>
          )}
        </span>
      </div>
    </>
  );
}\n"""

apply_line_replacement("src/components/recorder/SelectorReplayTracePanel.tsx", [
    (77, 136, rep1),
    (194, 258, rep2)
])
print("Done")
