import { useState } from "react";
import type { PromptEntry } from "@/hooks/use-prompts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, Tag, X, Save } from "lucide-react";
import { MonacoCodeEditor } from "./LazyMonacoCodeEditor";
import { toast } from "sonner";

const CATEGORY_SUGGESTIONS = ["Debug", "Memory", "Testing", "Deploy", "General"];

export interface EditFormProps {
    initial?: Partial<PromptEntry>;
    categories: string[];
    onSave: (data: Partial<PromptEntry>) => Promise<void>;
    onCancel: () => void;
}

export function PromptEditForm({ initial, categories, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [category, setCategory] = useState(initial?.category ?? "__none__");
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const allCategories = Array.from(new Set([...categories, ...CATEGORY_SUGGESTIONS])).sort();

  const handleSubmit = async () => {
    const isNameEmpty = !name.trim();
    const isTextEmpty = !text.trim();
    const isInvalid = isNameEmpty || isTextEmpty;
    if (isInvalid) {
      return;
    }

    setIsSaving(true);

    try {
      const isCategoryNone = category === "__none__";
      const trimmedCategory = category.trim();
      const finalCategory = isCategoryNone ? undefined : trimmedCategory || undefined;

      await onSave({
        ...initial,
        name: name.trim(),
        text: text.trim(),
        category: finalCategory,
      });
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : "Failed to save prompt";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const editorContent = (height: string) => (
    <MonacoCodeEditor
      language="markdown"
      value={text}
      onChange={(v) => setText(v)}
      height={height}
    />
  );

  const isNameEmpty = !name.trim();
  const isTextEmpty = !text.trim();
  const isSubmitDisabled = isSaving || isNameEmpty || isTextEmpty;
  const isUpdate = initial?.id !== undefined;

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Prompt name..."
          className="h-8 text-sm flex-1"
          autoFocus
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <Tag className="h-3 w-3 mr-1 shrink-0" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        Prompt Text (Markdown)
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsFullscreen(true)}
            title="Fullscreen editor"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        {editorContent("200px")}
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Prompt: {name || "Untitled"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {editorContent("100%")}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={isSubmitDisabled}>
          <Save className="h-3 w-3 mr-1" /> {isUpdate ? "Update" : "Add"}
        </Button>
      </div>
    </div>
  );
}
