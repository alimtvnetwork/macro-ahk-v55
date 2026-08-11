/**
 * State + handlers for CsvInputDialog. Composed from focused sub-hooks so
 * each function fits inside the max-lines-per-function budget.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/hooks/use-toast";

import {
  parseCsv,
  type CsvParseSuccess,
  MAX_BYTES,
} from "@/background/recorder/step-library/csv-parse";
import {
  buildBagFromRow,
  suggestVariableName,
  type BuildBagResult,
  type CoercionKind,
  type ColumnMapping,
} from "@/background/recorder/step-library/csv-mapping";
import type { GroupInputBag } from "@/background/recorder/step-library/group-inputs";

export interface ParsedCsvState {
    readonly Csv: CsvParseSuccess;
    readonly FileName: string | null;
}

export interface CsvInputController {
    readonly pasted: string;
    readonly parsed: ParsedCsvState | null;
    readonly parseError: string | null;
    readonly mappings: ReadonlyArray<ColumnMapping>;
    readonly rowIndex: number;
    readonly dragOver: boolean;
    readonly buildResult: BuildBagResult | null;
    readonly setPasted: (value: string) => void;
    readonly setRowIndex: (value: number) => void;
    readonly setDragOver: (value: boolean) => void;
    readonly handleParseClick: () => void;
    readonly handleFilePick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    readonly updateMapping: (column: string, patch: Partial<Omit<ColumnMapping, "Column">>) => void;
    readonly handleApply: () => void;
    readonly resetParsed: () => void;
}

export interface UseCsvInputControllerOptions {
    readonly open: boolean;
    readonly groupId: number | null;
    readonly groupName: string | null;
    readonly onApply: (groupId: number, bag: GroupInputBag) => void;
    readonly onOpenChange: (open: boolean) => void;
}

function buildInitialMappings(headers: ReadonlyArray<string>): ColumnMapping[] {
  const seen = new Set<string>();

  return headers.map((header) => {
    let candidate = suggestVariableName(header);
    let index = 2;
    while (seen.has(candidate)) {
      candidate = `${suggestVariableName(header)}_${index++}`;
    }

    seen.add(candidate);

    return { Column: header, Variable: candidate, Coerce: "auto" as CoercionKind };
  });
}

interface ParseState {
    parsed: ParsedCsvState | null;
    parseError: string | null;
    mappings: ReadonlyArray<ColumnMapping>;
    rowIndex: number;
    setRowIndex: (value: number) => void;
    acceptText: (text: string, fileName: string | null) => void;
    updateMapping: (column: string, patch: Partial<Omit<ColumnMapping, "Column">>) => void;
    resetParsed: () => void;
}

function useCsvAcceptText(
  setParsed: React.Dispatch<React.SetStateAction<ParsedCsvState | null>>,
  setParseError: React.Dispatch<React.SetStateAction<string | null>>,
  setMappings: React.Dispatch<React.SetStateAction<ReadonlyArray<ColumnMapping>>>,
  setRowIndex: React.Dispatch<React.SetStateAction<number>>
) {
  return useCallback((text: string, fileName: string | null): void => {
    const result = parseCsv(text);

    if (result.Ok === false) {
      setParsed(null);
      setMappings([]);
      setParseError(result.Reason);

      return;
    }

    setParseError(null);
    setParsed({ Csv: result, FileName: fileName });
    setMappings(buildInitialMappings(result.Headers));
    setRowIndex(0);
  }, [setParsed, setParseError, setMappings, setRowIndex]);
}

function useCsvUpdateMapping(setMappings: React.Dispatch<React.SetStateAction<ReadonlyArray<ColumnMapping>>>) {
  return useCallback((column: string, patch: Partial<Omit<ColumnMapping, "Column">>) => {
    setMappings((prev) => prev.map((entry) => {
      return entry.Column === column ? { ...entry, ...patch } : entry;
    }));
  }, [setMappings]);
}

function useCsvParseState(open: boolean): ParseState {
  const [parsed, setParsed] = useState<ParsedCsvState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ReadonlyArray<ColumnMapping>>([]);
  const [rowIndex, setRowIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setParsed(null);
    setParseError(null);
    setMappings([]);
    setRowIndex(0);
  }, [open]);

  const acceptText = useCsvAcceptText(setParsed, setParseError, setMappings, setRowIndex);
  const updateMapping = useCsvUpdateMapping(setMappings);

  const resetParsed = useCallback(() => {
    setParsed(null);
    setMappings([]);
    setRowIndex(0); 
  }, []);

  return { parsed, parseError, mappings, rowIndex, setRowIndex, acceptText, updateMapping, resetParsed };
}

interface FileHandlers {
    handleFilePick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

function useCsvFileReader(
  acceptText: (text: string, fileName: string | null) => void,
  setPasted: (value: string) => void,
): (file: File) => Promise<void> {
  const { toast } = useToast();

  return useCallback(async (file: File): Promise<void> => {
    if (file.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "File too large", description: "CSV files must be 5 MB or smaller." });

      return;
    }

    try {
      const text = await file.text();
      setPasted("");
      acceptText(text, file.name);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not read file",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [acceptText, setPasted, toast]);
}

function useCsvFileHandlers(
  acceptText: (text: string, fileName: string | null) => void,
  setPasted: (value: string) => void,
  setDragOver: (value: boolean) => void,
): FileHandlers {
  const handleFile = useCsvFileReader(acceptText, setPasted);
  const handleFilePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file !== null) {
      void handleFile(file);
    }
  }, [handleFile]);
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0] ?? null;
    if (file !== null) {
      void handleFile(file);
    }
  }, [handleFile, setDragOver]);

  return { handleFilePick, handleDrop };
}

interface ApplyHandler {
    buildResult: BuildBagResult | null;
    handleApply: () => void;
}

interface UseApplyOptions {
    readonly parsed: ParsedCsvState | null;
    readonly mappings: ReadonlyArray<ColumnMapping>;
    readonly rowIndex: number;
    readonly groupId: number | null;
    readonly groupName: string | null;
    readonly onApply: (groupId: number, bag: GroupInputBag) => void;
    readonly onOpenChange: (open: boolean) => void;
}

function useCsvBuildResult(
  parsed: ParsedCsvState | null,
  mappings: ReadonlyArray<ColumnMapping>,
  rowIndex: number
): BuildBagResult | null {
  return useMemo<BuildBagResult | null>(() => {
    if (parsed === null) {
      return null;
    }

    const row = parsed.Csv.Rows[rowIndex] ?? null;
    if (row === null) {
      return null;
    }

    return buildBagFromRow({ Headers: parsed.Csv.Headers, Row: row, Mappings: mappings });
  }, [parsed, mappings, rowIndex]);
}

function useCsvApplyHandler(options: UseApplyOptions): ApplyHandler {
  const { parsed, mappings, rowIndex, groupId, groupName, onApply, onOpenChange } = options;
  const { toast } = useToast();
  const buildResult = useCsvBuildResult(parsed, mappings, rowIndex);

  const handleApply = useCallback(() => {
    if (groupId === null || buildResult === null || buildResult.Ok === false) {
      return;
    }

    onApply(groupId, buildResult.Bag);
    toast({
      title: "CSV input applied",
      description: `Bound ${buildResult.UsedColumns} variable(s) from row ${rowIndex + 1} to "${groupName ?? "(unknown)"}".`,
    });
    onOpenChange(false);
  }, [groupId, groupName, buildResult, rowIndex, onApply, onOpenChange, toast]);

  return { buildResult, handleApply };
}

function useCsvResetEffect(open: boolean, setPasted: (s: string) => void, setDragOver: (b: boolean) => void) {
  useEffect(() => {
    if (open) {
      setPasted("");
      setDragOver(false); 
    } 
  }, [open, setPasted, setDragOver]);
}

export function useCsvInputController(opts: UseCsvInputControllerOptions): CsvInputController {
  const { open, groupId, groupName, onApply, onOpenChange } = opts;
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  useCsvResetEffect(open, setPasted, setDragOver);

  const parseState = useCsvParseState(open);
  const { acceptText, parsed, parseError, mappings, rowIndex, setRowIndex, updateMapping, resetParsed } = parseState;
  const fileHandlers = useCsvFileHandlers(acceptText, setPasted, setDragOver);
  const apply = useCsvApplyHandler({
    parsed, mappings, rowIndex,
    groupId, groupName, onApply, onOpenChange,
  });
  const handleParseClick = useCallback(() => acceptText(pasted, null), [pasted, acceptText]);

  return {
    pasted, parsed, parseError,
    mappings, rowIndex, dragOver,
    buildResult: apply.buildResult,
    setPasted, setRowIndex, setDragOver,
    handleParseClick, handleFilePick: fileHandlers.handleFilePick, handleDrop: fileHandlers.handleDrop,
    updateMapping, handleApply: apply.handleApply,
    resetParsed,
  };
}
