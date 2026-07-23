/**
 * Marco Extension — Failure Reports Panel
 *
 * Renders a list of structured {@link FailureReport}s with per-row
 * checkboxes and export controls. State, handlers, and side effects
 * live in `./failure-reports-panel/use-failure-reports-panel.ts`;
 * the header toolbar and row live in sibling files. This file is a
 * thin shell so it can stay under the 50-line component cap.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";
import type { FailureReport } from "@/background/recorder/failure-logger";
import { useFailureReportsPanel, rowKey } from "./failure-reports-panel/use-failure-reports-panel";
import { FailureReportsToolbar } from "./failure-reports-panel/FailureReportsToolbar";
import { FailureReportRow } from "./failure-reports-panel/FailureReportRow";

interface FailureReportsPanelProps {
    readonly reports: ReadonlyArray<FailureReport>;
    readonly onDownload?: (filename: string, contents: string) => void;
    readonly onCopy?: (contents: string) => Promise<void>;
}

export function FailureReportsPanel({ reports, onDownload, onCopy }: FailureReportsPanelProps) {
    const s = useFailureReportsPanel({ reports, onDownload, onCopy });
    return (
        <Card>
            <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Failure Reports
                    <Badge variant="secondary" className="ml-1">{reports.length}</Badge>
                </CardTitle>
                <FailureReportsToolbar
                    reportsLength={reports.length}
                    allSelected={s.allSelected}
                    noneSelected={s.noneSelected}
                    exportFormat={s.exportFormat}
                    setExportFormat={s.setExportFormat}
                    validPickedStep={s.validPickedStep}
                    setPickedStep={s.setPickedStep}
                    stepOptions={s.stepOptions}
                    toggleAll={s.toggleAll}
                    onExport={s.handleExport}
                    onExportLast={s.handleExportLast}
                    onCopyLast={s.handleCopyLast}
                    onExportByStep={s.handleExportByStep}
                />
            </CardHeader>
            <CardContent>
                {reports.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">
                        No failures recorded.
                    </p>
                ) : (
                    <ScrollArea className="h-64 pr-2">
                        <ul className="space-y-1.5">
                            {reports.map((r, i) => {
                                const key = rowKey(r, i);
                                return (
                                    <FailureReportRow
                                        key={key}
                                        report={r}
                                        rowKey={key}
                                        index={i}
                                        checked={s.selected.has(key)}
                                        expanded={s.expanded.has(key)}
                                        onToggle={() => s.toggle(key)}
                                        onToggleExpanded={() => s.toggleExpanded(key)}
                                    />
                                );
                            })}
                        </ul>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
