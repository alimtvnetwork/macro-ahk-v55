/**
 * Paste-CSV textarea + Parse button for CsvInputDialog. Shown until
 * a file is loaded.
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface CsvPastePanelProps {
    readonly pasted: string;
    readonly onPastedChange: (value: string) => void;
    readonly parseError: string | null;
    readonly onParseClick: () => void;
}

export function CsvPastePanel(props: CsvPastePanelProps): JSX.Element {
    const { pasted, onPastedChange, parseError, onParseClick } = props;
    return (
        <div className="space-y-2">
            <Textarea
                value={pasted}
                onChange={(event) => onPastedChange(event.target.value)}
                placeholder={"Email,Age,Active\nyou@example.com,42,true"}
                spellCheck={false}
                className="h-32 font-mono text-xs"
                aria-label="Paste CSV contents"
            />
            <div className="flex items-center justify-between">
                <div className="text-xs text-destructive">
                    {parseError !== null ? parseError : ""}
                </div>
                <Button size="sm" onClick={onParseClick} disabled={pasted.trim() === ""}>
                    Parse pasted CSV
                </Button>
            </div>
        </div>
    );
}
