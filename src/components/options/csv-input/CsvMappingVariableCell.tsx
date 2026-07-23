/**
 * Variable-name input + skip/use toggle cell for a CSV mapping row.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
    suggestVariableName,
    validateVariableName,
    type ColumnMapping,
} from "@/background/recorder/step-library/csv-mapping";

export interface CsvMappingVariableCellProps {
    readonly header: string;
    readonly mapping: ColumnMapping;
    readonly onUpdate: (patch: Partial<Omit<ColumnMapping, "Column">>) => void;
}

export function CsvMappingVariableCell(props: CsvMappingVariableCellProps): JSX.Element {
    const { header, mapping, onUpdate } = props;
    const skipped = mapping.Variable === null;
    const validation = !skipped && mapping.Variable !== null
        ? validateVariableName(mapping.Variable)
        : null;
    return (
        <div className="flex items-center gap-1">
            <Input
                value={mapping.Variable ?? ""}
                disabled={skipped}
                placeholder={skipped ? "(skipped)" : suggestVariableName(header)}
                onChange={(event) => onUpdate({ Variable: event.target.value })}
                className={["h-7", validation !== null ? "border-destructive" : ""].join(" ")}
                aria-invalid={validation !== null}
                title={validation ?? undefined}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onUpdate({ Variable: skipped ? suggestVariableName(header) : null })}
                title={skipped ? "Include this column" : "Skip this column"}
            >
                {skipped ? "Use" : "Skip"}
            </Button>
        </div>
    );
}
