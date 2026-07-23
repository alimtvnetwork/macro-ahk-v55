/**
 * Marco Extension — Single failure-report row for FailureReportsPanel.
 *
 * Renders one <li> with checkbox, badges, summary, and an optional
 * expanded details block.
 */

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FailureReport } from "@/background/recorder/failure-logger";
import { FailureDetailsPanel } from "../FailureDetailsPanel";
import { SelectorReplayTracePanel } from "../SelectorReplayTracePanel";

interface Props {
    readonly report: FailureReport;
    readonly rowKey: string;
    readonly index: number;
    readonly checked: boolean;
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly onToggleExpanded: () => void;
}

function RowBadges({ report }: { readonly report: FailureReport }) {
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={report.Phase === "Replay" ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                {report.Phase}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {report.Reason}
            </Badge>
            {report.StepKind !== null && <span className="text-muted-foreground">{report.StepKind}</span>}
            {report.StepId !== null && <span className="text-muted-foreground">· Step #{report.StepId}</span>}
            <span className="text-muted-foreground ml-auto">{report.Timestamp}</span>
        </div>
    );
}

export function FailureReportRow(props: Props) {
    const { report, rowKey, index, checked, expanded, onToggle, onToggleExpanded } = props;
    const ChevronIcon = expanded ? ChevronDown : ChevronRight;
    return (
        <li className="rounded-md border border-border bg-card px-2.5 py-2 space-y-2">
            <div className="flex items-start gap-2">
                <Checkbox
                    id={`fr-${rowKey}`}
                    checked={checked}
                    onCheckedChange={onToggle}
                    aria-label={`Select failure report ${index + 1}`}
                />
                <label htmlFor={`fr-${rowKey}`} className="flex-1 cursor-pointer text-xs space-y-0.5">
                    <RowBadges report={report} />
                    <p className="text-foreground line-clamp-2">{report.Message}</p>
                </label>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 -mt-0.5"
                    onClick={onToggleExpanded}
                    aria-label={expanded ? `Hide details for failure ${index + 1}` : `Show details for failure ${index + 1}`}
                    aria-expanded={expanded}
                >
                    <ChevronIcon className="h-3.5 w-3.5" />
                    <span className="ml-1 text-[10px]">{expanded ? "Hide" : "Details"}</span>
                </Button>
            </div>
            {expanded && (
                <div className="space-y-2">
                    <FailureDetailsPanel report={report} embedded />
                    <SelectorReplayTracePanel report={report} embedded />
                </div>
            )}
        </li>
    );
}
