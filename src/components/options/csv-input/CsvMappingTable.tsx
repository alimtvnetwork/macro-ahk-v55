/**
 * Mapping table (header + body) for CsvInputDialog. Extracted so the
 * outer CsvMappingSection can stay within the ESLint budget.
 */

import { ScrollArea } from "@/components/ui/scroll-area";

import type { CsvParseSuccess } from "@/background/recorder/step-library/csv-parse";
import type {
    CoercionKind,
    ColumnMapping,
} from "@/background/recorder/step-library/csv-mapping";

import { CsvMappingRow } from "./CsvMappingRow";

export interface CsvMappingTableProps {
    readonly csv: CsvParseSuccess;
    readonly mappings: ReadonlyArray<ColumnMapping>;
    readonly rowIndex: number;
    readonly coercionOptions: ReadonlyArray<{ value: CoercionKind; label: string; hint: string }>;
    readonly onUpdateMapping: (column: string, patch: Partial<Omit<ColumnMapping, "Column">>) => void;
}

export function CsvMappingTable(props: CsvMappingTableProps): JSX.Element {
    const { csv, mappings, rowIndex, coercionOptions, onUpdateMapping } = props;
    return (
        <ScrollArea className="h-72 rounded border">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                    <tr className="border-b">
                        <th className="px-2 py-2 text-left font-medium">Column</th>
                        <th className="px-2 py-2 text-left font-medium">Cell value (row {rowIndex + 1})</th>
                        <th className="px-2 py-2 text-left font-medium">Variable</th>
                        <th className="px-2 py-2 text-left font-medium">Type</th>
                    </tr>
                </thead>
                <tbody>
                    {csv.Headers.map((header) => {
                        const mapping = mappings.find((entry) => entry.Column === header);
                        if (mapping === undefined) return null;
                        const cell = csv.Rows[rowIndex]?.[csv.Headers.indexOf(header)] ?? "";
                        return (
                            <CsvMappingRow
                                key={header}
                                header={header}
                                cell={cell}
                                mapping={mapping}
                                coercionOptions={coercionOptions}
                                onUpdate={(patch) => onUpdateMapping(header, patch)}
                            />
                        );
                    })}
                </tbody>
            </table>
        </ScrollArea>
    );
}
