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

function usePromptFormState(initial: Partial<PromptEntry> | undefined, onSave: (data: Partial<PromptEntry>) => Promise<void>) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [category, setCategory] = useState(initial?.category ?? "__none__");
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSubmit = async () => {
    const isInvalid = !name.trim() || !text.trim();
    if (isInvalid) {
      return;
    }

    setIsSaving(true);
    try {
      const finalCategory = category === "__none__" ? undefined : category.trim() || undefined;
      await onSave({ ...initial, name: name.trim(), text: text.trim(), category: finalCategory });
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  };

  return { name, setName, text, setText, category, setCategory, isSaving, isFullscreen, setIsFullscreen, handleSubmit };
}

function FullscreenEditorDialog({ isOpen, onOpenChange, name, text, onTextChange }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  text: string;
  onTextChange: (value: string) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Prompt: {name || "Untitled"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <MonacoCodeEditor
            language="markdown"
            value={text}
            onChange={onTextChange}
            height="100%"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromptFormHeader({ name, setName, category, setCategory, categories }: {
  name: string; setName: (n: string) => void;
  category: string; setCategory: (c: string) => void;
  categories: string[];
}) {
  const allCategories = Array.from(new Set([...categories, ...CATEGORY_SUGGESTIONS])).sort();

  return (
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
  );
}

function PromptFormActions({
  onCancel,
  handleSubmit,
  isSubmitDisabled,
  isUpdate,
}: {
  onCancel: () => void;
  handleSubmit: () => void;
  isSubmitDisabled: boolean;
  isUpdate: boolean;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
        <X className="h-3 w-3 mr-1" /> Cancel
      </Button>
      <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={isSubmitDisabled}>
        <Save className="h-3 w-3 mr-1" /> {isUpdate ? "Update" : "Add"}
      </Button>
    </div>
  );
}

export function PromptEditForm({ initial, categories, onSave, onCancel }: EditFormProps) {
  const state = usePromptFormState(initial, onSave);

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <PromptFormHeader
        name={state.name}
        setName={state.setName}
        category={state.category}
        setCategory={state.setCategory}
        categories={categories}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        Prompt Text (Markdown)
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => state.setIsFullscreen(true)}
            title="Fullscreen editor"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        <MonacoCodeEditor
          language="markdown"
          value={state.text}
          onChange={state.setText}
          height="200px"
        />
      </div>

      <FullscreenEditorDialog
        isOpen={state.isFullscreen}
        onOpenChange={state.setIsFullscreen}
        name={state.name}
        text={state.text}
        onTextChange={state.setText}
      />

      <PromptFormActions
        onCancel={onCancel}
        handleSubmit={state.handleSubmit}
        isSubmitDisabled={state.isSaving || !state.name.trim() || !state.text.trim()}
        isUpdate={initial?.id !== undefined}
      />
    </div>
  );
}
