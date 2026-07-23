/**
 * Mapping section for CsvInputDialog: warnings, row navigator,
 * mapping table, and the build-result preview line.
 */

import type { CsvParseSuccess } from "@/background/recorder/step-library/csv-parse";
import type {
    BuildBagResult,
    CoercionKind,
    ColumnMapping,
} from "@/background/recorder/step-library/csv-mapping";

import { CsvRowNavigator } from "./CsvRowNavigator";
import { CsvMappingTable } from "./CsvMappingTable";
import { CsvBuildResultLine } from "./CsvBuildResultLine";

export interface CsvMappingSectionProps {
    readonly csv: CsvParseSuccess;
    readonly mappings: ReadonlyArray<ColumnMapping>;
    readonly rowIndex: number;
    readonly onRowIndexChange: (nextIndex: number) => void;
    readonly onUpdateMapping: (column: string, patch: Partial<Omit<ColumnMapping, "Column">>) => void;
    readonly coercionOptions: ReadonlyArray<{ value: CoercionKind; label: string; hint: string }>;
    readonly buildResult: BuildBagResult | null;
}

export function CsvMappingSection(props: CsvMappingSectionProps): JSX.Element {
    const { csv, mappings, rowIndex, onRowIndexChange, onUpdateMapping, coercionOptions, buildResult } = props;
    return (
        <div className="space-y-3">
            {csv.Warnings.length > 0 && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                    <div className="font-medium text-amber-600 dark:text-amber-300">Heads up</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {csv.Warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}
            <CsvRowNavigator
                headerCount={csv.Headers.length}
                totalRows={csv.Rows.length}
                delimiter={csv.Delimiter}
                rowIndex={rowIndex}
                onRowIndexChange={onRowIndexChange}
            />
            <CsvMappingTable
                csv={csv}
                mappings={mappings}
                rowIndex={rowIndex}
                coercionOptions={coercionOptions}
                onUpdateMapping={onUpdateMapping}
            />
            <CsvBuildResultLine buildResult={buildResult} rowIndex={rowIndex} />
        </div>
    );
}
