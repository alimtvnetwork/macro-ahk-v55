def apply_line_replacement(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Sort replacements in reverse order so we don't mess up line numbers
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    for start, end, new_lines in replacements:
        lines[start-1:end] = [new_lines]
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

rep1 = """function AttemptRow({ attempt, history, showHistory, onPromote, isPromoting }: AttemptRowProps) {
  const matched = attempt.Matched;
  const border = attempt.IsPrimary
    ? matched ? "border-emerald-500/40" : "border-destructive/40"
    : "border-border";

  return (
    <li className={`rounded-md border ${border} bg-card p-2.5 text-xs space-y-1`}>
      <AttemptRowHeader attempt={attempt} onPromote={onPromote} isPromoting={isPromoting} />
      <AttemptRowDetails attempt={attempt} history={history} showHistory={showHistory} />
    </li>
  );
}

function AttemptRowHeader({
  attempt,
  onPromote,
  isPromoting,
}: {
  readonly attempt: SelectorEvaluationAttempt;
  readonly onPromote: ((selectorId: number) => void) | null;
  readonly isPromoting: boolean;
}) {
  const matched = attempt.Matched;
  const Icon = matched ? CheckCircle2 : XCircle;
  const tone = matched ? "text-emerald-500" : "text-destructive";
  const canPromote = onPromote !== null && matched && !attempt.IsPrimary;

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{attempt.Kind}</Badge>
      {attempt.IsPrimary && (
        <Badge variant="default" className="text-[10px] px-1.5 py-0">PRIMARY</Badge>
      )}
      <code className="text-muted-foreground truncate" title={attempt.Expression}>
        {attempt.Expression}
      </code>
      <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
        {attempt.MatchCount} match{attempt.MatchCount === 1 ? "" : "es"}
      </Badge>
      {canPromote && (
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px]"
          onClick={() => onPromote!(attempt.SelectorId)}
          disabled={isPromoting}
          aria-label={`Promote selector ${attempt.SelectorId} to primary`}
          title="Promote this fallback to primary for this step"
        >
          <Star className="h-3 w-3 mr-1" />
          {isPromoting ? "Promoting…" : "Promote to primary"}
        </Button>
      )}
    </div>
  );
}

function AttemptRowDetails({
  attempt,
  history,
  showHistory,
}: {
  readonly attempt: SelectorEvaluationAttempt;
  readonly history: SelectorHistoryBucket | null;
  readonly showHistory: boolean;
}) {
  const matched = attempt.Matched;
  return (
    <>
      {attempt.ResolvedExpression !== attempt.Expression && (
        <div className="text-[11px] text-muted-foreground pl-5">
                    Resolved: <code>{attempt.ResolvedExpression}</code>
        </div>
      )}

      <div className="flex items-start gap-2 pl-5">
        <Crosshair className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
        <code className={`${matched ? "text-foreground" : "text-muted-foreground italic"} break-all`}>
          {elementSummary(attempt.Element)}
        </code>
      </div>

      {attempt.Error !== null && (
        <div className="pl-5 text-destructive text-[11px]">Error: {attempt.Error}</div>
      )}

      {showHistory && history !== null && <HistoryBlock bucket={history} />}
      {showHistory && history === null && (
        <div className="ml-5 mt-1 text-[11px] text-muted-foreground italic">
                    No prior replay history for this selector.
        </div>
      )}
    </>
  );
}\n"""

rep2 = """export function SelectorComparisonPanel({ comparison, stepId, url, history, onPromoteToPrimary, failureReport, onDownload }: SelectorComparisonPanelProps) {
  const { Attempts, PrimaryMatched, AnyFallbackMatched, DriftDetected } = comparison;
  const hasHistory = history !== undefined;
  const [showHistory, setShowHistory] = useState(false);
  const [promotingId, setPromotingId] = useState<number | null>(null);

  const handleExport = () => {
    const bundle = buildSelectorComparisonBundle(comparison, { StepId: stepId, Url: url });
    const filename = buildSelectorComparisonFilename(stepId ?? null);
    const contents = serializeSelectorComparisonBundle(bundle);
    (onDownload ?? defaultDownload)(filename, contents);
    toast.success(`Exported selector comparison (${Attempts.length} attempt${Attempts.length === 1 ? "" : "s"})`);
  };

  const handlePromote = onPromoteToPrimary
    ? async (selectorId: number) => {
      setPromotingId(selectorId);
      try {
        await onPromoteToPrimary(selectorId);
        toast.success(`Promoted selector #${selectorId} to primary`);
      } catch (err) {
        toast.error(
          `Failed to promote selector: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setPromotingId(null);
      }
    }
    : null;

  return (
    <Card>
      <SelectorComparisonPanelHeader
        PrimaryMatched={PrimaryMatched}
        AnyFallbackMatched={AnyFallbackMatched}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        hasHistory={hasHistory}
        AttemptsLength={Attempts.length}
        handleExport={handleExport}
      />
      <CardContent className="space-y-3">
        {DriftDetected && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Selector drift:</strong> the primary selector no longer matches,
                            but a fallback resolved. Consider promoting the fallback or repairing the primary.
            </span>
          </div>
        )}
        {failureReport !== undefined && (
          <FailureDetailsPanel report={failureReport} embedded />
        )}
        {Attempts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2 text-center">
                        No selectors recorded for this step.
          </p>
        ) : (
          <ul className="space-y-2">
            {Attempts.map((a) => (
              <AttemptRow
                key={a.SelectorId}
                attempt={a}
                history={hasHistory ? findHistoryForSelector(history, a.ResolvedExpression) : null}
                showHistory={showHistory && hasHistory}
                onPromote={handlePromote}
                isPromoting={promotingId === a.SelectorId}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SelectorComparisonPanelHeader({
  PrimaryMatched,
  AnyFallbackMatched,
  showHistory,
  setShowHistory,
  hasHistory,
  AttemptsLength,
  handleExport,
}: {
  readonly PrimaryMatched: boolean;
  readonly AnyFallbackMatched: boolean;
  readonly showHistory: boolean;
  readonly setShowHistory: (v: boolean) => void;
  readonly hasHistory: boolean;
  readonly AttemptsLength: number;
  readonly handleExport: () => void;
}) {
  return (
    <CardHeader className="pb-2 flex flex-row items-center justify-between">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-primary" />
                  Selector Comparison
        <Badge
          variant={PrimaryMatched ? "secondary" : "destructive"}
          className="ml-1 text-[10px]"
        >
          {PrimaryMatched ? "Primary OK" : "Primary failed"}
        </Badge>
        {AnyFallbackMatched && (
          <Badge variant="outline" className="text-[10px]">Fallback found</Badge>
        )}
      </CardTitle>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Switch
            id="show-history"
            checked={showHistory && hasHistory}
            onCheckedChange={(v) => setShowHistory(Boolean(v))}
            disabled={!hasHistory}
            aria-label="Show prior replay outcomes per selector"
          />
          <LabelType
            htmlFor="show-history"
            className={`text-[11px] flex items-center gap-1 ${hasHistory ? "" : "text-muted-foreground"}`}
          >
            <History className="h-3 w-3" aria-hidden />
                          History
          </LabelType>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={AttemptsLength === 0}
          aria-label="Export selector comparison as JSON"
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                      Export selector comparison
        </Button>
      </div>
    </CardHeader>
  );
}\n"""

apply_line_replacement("src/components/recorder/SelectorComparisonPanel.tsx", [
    (153, 218, rep1),
    (220, 328, rep2)
])
print("Done")
