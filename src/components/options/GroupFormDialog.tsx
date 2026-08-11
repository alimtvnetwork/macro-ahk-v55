import { useState, useCallback } from "react";
import { sendMessage } from "@/lib/message-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelType } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectGroup } from "./project-group-types";

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editGroup?: ProjectGroup | null;
}

function useGroupSubmit(
  name: string,
  settings: string,
  editGroup: ProjectGroup | null | undefined,
  onOpenChange: (open: boolean) => void,
  onSaved: () => void,
) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!editGroup?.Id;

  const handleSave = useCallback(async () => {
    const isInvalidName = !name.trim();
    if (isInvalidName) {
      toast.error("Group name is required");

      return;
    }

    setSaving(true);
    try {
      const result = await sendMessage<{ groupId: number; cascadedCount: number }>({
        type: "LIBRARY_SAVE_GROUP" as never,
        group: {
          ...(isEdit ? { Id: editGroup!.Id } : {}),
          Name: name.trim(),
          SharedSettingsJson: settings.trim() || null,
        },
      } as never);
      const hasCascaded = result.cascadedCount > 0;
      let cascadeMsg = "";
      if (hasCascaded) {
        cascadeMsg = ` — settings pushed to ${result.cascadedCount} project(s)`;
      }

      const actionMsg = isEdit ? `Group "${name}" updated` : `Group "${name}" created`;
      toast.success(actionMsg + cascadeMsg);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Save failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [name, settings, isEdit, editGroup, onOpenChange, onSaved]);

  return { saving, isEdit, handleSave };
}

// eslint-disable-next-line max-lines-per-function
export function GroupFormDialog({ open, onOpenChange, onSaved, editGroup }: GroupFormDialogProps) {
  const [name, setName] = useState(editGroup?.Name ?? "");
  const [settings, setSettings] = useState(editGroup?.SharedSettingsJson ?? "");
  const { saving, isEdit, handleSave } = useGroupSubmit(name, settings, editGroup, onOpenChange, onSaved);

  const hasName = !!name.trim();
  const shouldDisableSave = saving || !hasName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Edit Group" : "Create Group"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update group name and shared settings." : "Create a new project group for shared configuration."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <LabelType className="text-xs">Group Name</LabelType>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Sites"
              className="h-8 text-sm"
              data-testid="project-group-name-input"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <LabelType className="text-xs">Shared Settings (JSON, optional)</LabelType>
            <Textarea
              value={settings}
              onChange={e => setSettings(e.target.value)}
              placeholder='{"logLevel": "warn", "retryOnNavigate": true}'
              className="min-h-[80px] font-mono text-xs"
              data-testid="project-group-settings-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={shouldDisableSave} data-testid="project-group-save-button">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
