import { MessageSquare } from "lucide-react";
import type { PromptEntry } from "@/hooks/use-prompts";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MonacoCodeEditor } from "./LazyMonacoCodeEditor";

export interface PromptFullViewProps {
    prompt: PromptEntry;
    isOpen: boolean;
    onClose: () => void;
}

export function PromptFullView({ prompt, isOpen, onClose }: PromptFullViewProps) {
    const hasCategory = prompt.category !== undefined && prompt.category !== null && prompt.category !== "";
    
    return (
        <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        {prompt.name}
                        {hasCategory && (
                            <Badge variant="secondary" className="text-[10px]">{prompt.category}</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-auto">
                    <MonacoCodeEditor
                        language="markdown"
                        value={prompt.text}
                        onChange={() => {}}
                        height="500px"
                        readOnly
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
