/**
 * One-line preview of the CSV row -> bag build result.
 */

import type { BuildBagResult } from "@/background/recorder/step-library/csv-mapping";

export interface CsvBuildResultLineProps {
    readonly buildResult: BuildBagResult | null;
    readonly rowIndex: number;
}

export function CsvBuildResultLine(props: CsvBuildResultLineProps): JSX.Element {
    const { buildResult, rowIndex } = props;
    return (
        <div className="min-h-[1.25rem] text-xs">
            {buildResult === null ? (
                <span className="text-muted-foreground">Pick a row to preview the resulting bag.</span>
            ) : buildResult.Ok ? (
                <span className="text-emerald-500">
                    &#10003; Will bind {buildResult.UsedColumns} variable(s) from row {rowIndex + 1}.
                </span>
            ) : (
                <span className="text-destructive">{buildResult.Reason}</span>
            )}
        </div>
    );
}
