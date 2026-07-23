/**
 * Source panel for CsvInputDialog: composes the drop zone with the
 * (conditionally rendered) paste panel.
 */

import { CsvDropZone } from "./CsvDropZone";
import { CsvPastePanel } from "./CsvPastePanel";

export interface CsvSourcePanelProps {
    readonly hasParsed: boolean;
    readonly loadedFileName: string | null;
    readonly dragOver: boolean;
    readonly onDragOverChange: (over: boolean) => void;
    readonly onDropFile: (event: React.DragEvent<HTMLDivElement>) => void;
    readonly onPickFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly pasted: string;
    readonly onPastedChange: (value: string) => void;
    readonly parseError: string | null;
    readonly onParseClick: () => void;
}

export function CsvSourcePanel(props: CsvSourcePanelProps): JSX.Element {
    return (
        <>
            <CsvDropZone
                loadedFileName={props.loadedFileName}
                dragOver={props.dragOver}
                onDragOverChange={props.onDragOverChange}
                onDropFile={props.onDropFile}
                onPickFile={props.onPickFile}
            />
            {!props.hasParsed && (
                <CsvPastePanel
                    pasted={props.pasted}
                    onPastedChange={props.onPastedChange}
                    parseError={props.parseError}
                    onParseClick={props.onParseClick}
                />
            )}
        </>
    );
}
