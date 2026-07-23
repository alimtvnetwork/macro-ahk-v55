/**
 * Header toolbar for RecorderVisualisationPanel: data-source chips
 * on the left, self-test button + export dropdown on the right.
 */

import { Database, Download, FlaskConical, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ExportFormat } from "./recorder-export";

export interface RecorderVisualisationHeaderProps {
    readonly dataSources: ReadonlyArray<{
        readonly DataSourceId: number;
        readonly FilePath: string;
        readonly RowCount: number;
        readonly Columns: ReadonlyArray<unknown>;
    }>;
    readonly stepCount: number;
    readonly selfTestRunning: boolean;
    readonly onSelfTest: () => void;
    readonly onExport: (format: ExportFormat) => void;
}

export function RecorderVisualisationHeader(props: RecorderVisualisationHeaderProps): JSX.Element {
    const { dataSources, stepCount, selfTestRunning, onSelfTest, onExport } = props;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Data Sources:
            </span>
            {dataSources.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">none attached</span>
            ) : (
                dataSources.map((ds) => (
                    <Badge key={ds.DataSourceId} variant="outline" className="gap-1.5 font-mono text-[10px]">
                        <Database className="h-3 w-3" />
                        {ds.FilePath} &middot; {ds.RowCount}r &times; {ds.Columns.length}c
                    </Badge>
                ))
            )}
            <div className="ml-auto flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={onSelfTest}
                    disabled={selfTestRunning}
                    title="Insert a dummy step, verify it appears, and clean it up. Failures land in the Error Drawer."
                >
                    {selfTestRunning
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FlaskConical className="h-3.5 w-3.5" />}
                    Run self-test
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            disabled={stepCount === 0}
                            title={stepCount === 0
                                ? "Record at least one step before exporting"
                                : `Export ${stepCount} step(s)`}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onExport("json")}>Download as JSON</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport("csv")}>Download as CSV</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
