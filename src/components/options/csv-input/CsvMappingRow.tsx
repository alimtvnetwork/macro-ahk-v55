/**
 * Single mapping row inside CsvInputDialog's mapping table. Composed
 * from two cell subcomponents to stay under the ESLint budget.
 */

import type {
    CoercionKind,
    ColumnMapping,
} from "@/background/recorder/step-library/csv-mapping";

import { CsvMappingVariableCell } from "./CsvMappingVariableCell";
import { CsvMappingCoerceCell } from "./CsvMappingCoerceCell";

export interface CsvMappingRowProps {
    readonly header: string;
    readonly cell: string;
    readonly mapping: ColumnMapping;
    readonly coercionOptions: ReadonlyArray<{ value: CoercionKind; label: string; hint: string }>;
    readonly onUpdate: (patch: Partial<Omit<ColumnMapping, "Column">>) => void;
}

export function CsvMappingRow(props: CsvMappingRowProps): JSX.Element {
    const { header, cell, mapping, coercionOptions, onUpdate } = props;
    return (
        <tr className="border-b last:border-0">
            <td className="px-2 py-1.5 align-middle font-medium">{header}</td>
            <td className="max-w-[14rem] truncate px-2 py-1.5 align-middle text-muted-foreground" title={cell}>
                {cell === "" ? <em className="opacity-50">empty</em> : cell}
            </td>
            <td className="px-2 py-1.5 align-middle">
                <CsvMappingVariableCell header={header} mapping={mapping} onUpdate={onUpdate} />
            </td>
            <td className="px-2 py-1.5 align-middle">
                <CsvMappingCoerceCell mapping={mapping} coercionOptions={coercionOptions} onUpdate={onUpdate} />
            </td>
        </tr>
    );
}
