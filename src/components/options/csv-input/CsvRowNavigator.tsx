/**
 * Row navigator + summary header for CsvInputDialog. Sits above the
 * mapping table and lets the user page through data rows.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CsvRowNavigatorProps {
    readonly headerCount: number;
    readonly totalRows: number;
    readonly delimiter: string;
    readonly rowIndex: number;
    readonly onRowIndexChange: (nextIndex: number) => void;
}

export function CsvRowNavigator(props: CsvRowNavigatorProps): JSX.Element {
    const { headerCount, totalRows, delimiter, rowIndex, onRowIndexChange } = props;
    const canStepBack = rowIndex > 0;
    const canStepFwd = rowIndex < totalRows - 1;
    return (
        <div className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2 text-xs">
            <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{headerCount}</span> column(s),{" "}
                <span className="font-medium text-foreground">{totalRows}</span> data row(s),{" "}
                delimiter <code className="rounded bg-muted px-1">{delimiter}</code>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    disabled={!canStepBack}
                    onClick={() => onRowIndexChange(Math.max(0, rowIndex - 1))}
                    aria-label="Previous row"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                    Row{" "}
                    <Input
                        type="number"
                        value={rowIndex + 1}
                        min={1}
                        max={Math.max(1, totalRows)}
                        onChange={(event) => {
                            const nextValue = Math.max(1, Math.min(totalRows, Number(event.target.value) || 1));
                            onRowIndexChange(nextValue - 1);
                        }}
                        className="inline-block h-7 w-16 text-center"
                    />
                    {" / "}{totalRows}
                </span>
                <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    disabled={!canStepFwd}
                    onClick={() => onRowIndexChange(Math.min(totalRows - 1, rowIndex + 1))}
                    aria-label="Next row"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
