/**
 * Coercion-kind select cell for a CSV mapping row.
 */

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { CoercionKind, ColumnMapping } from "@/background/recorder/step-library/csv-mapping";

export interface CsvMappingCoerceCellProps {
    readonly mapping: ColumnMapping;
    readonly coercionOptions: ReadonlyArray<{ value: CoercionKind; label: string; hint: string }>;
    readonly onUpdate: (patch: Partial<Omit<ColumnMapping, "Column">>) => void;
}

export function CsvMappingCoerceCell(props: CsvMappingCoerceCellProps): JSX.Element {
    const { mapping, coercionOptions, onUpdate } = props;
    const skipped = mapping.Variable === null;
    return (
        <Select
            value={mapping.Coerce}
            onValueChange={(v) => onUpdate({ Coerce: v as CoercionKind })}
            disabled={skipped}
        >
            <SelectTrigger className="h-7 w-[110px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {coercionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} title={opt.hint}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
