/**
 * Marco Extension , Webhook Settings Dialog
 *
 * Configures the per-project HTTP endpoint that receives execution
 * and recording results. State + handlers live in
 * `./webhook-settings/use-webhook-settings-state.ts`; this component is
 * now purely composition + layout, keeping it within the function-size cap.
 */

import { Webhook, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DeliveryLogSection } from "./webhook-settings/DeliveryLogSection";
import {
    EnableUrlTimeoutSection,
    EventsSection,
    HeadersSection,
    RepairCorruptDescription,
} from "./webhook-settings/ConfigSections";
import { useWebhookSettingsState } from "./webhook-settings/use-webhook-settings-state";

interface Props {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

type SettingsState = ReturnType<typeof useWebhookSettingsState>;

function DialogBody({ state }: { state: SettingsState }) {
    return (
        <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-5">
                <EnableUrlTimeoutSection draft={state.draft} setDraft={state.setDraft} />
                <HeadersSection
                    headers={state.draft.Headers}
                    onAdd={state.addHeader}
                    onUpdate={state.updateHeader}
                    onRemove={state.removeHeader}
                />
                <EventsSection events={state.draft.Events} eventSet={state.eventSet} onToggle={state.toggleEvent} />
                <DeliveryLogSection
                    log={state.log}
                    filteredLog={state.filteredLog}
                    logCounts={state.logCounts}
                    statusFilter={state.statusFilter}
                    setStatusFilter={state.setStatusFilter}
                    searchQuery={state.searchQuery}
                    setSearchQuery={state.setSearchQuery}
                    expandedIdx={state.expandedIdx}
                    setExpandedIdx={state.setExpandedIdx}
                    payloadOpenIdx={state.payloadOpenIdx}
                    setPayloadOpenIdx={state.setPayloadOpenIdx}
                    busy={state.busy}
                    repairBusy={state.repairBusy}
                    corruptCount={state.corruptCount}
                    onRefresh={state.refreshLog}
                    onTest={state.handleTest}
                    onClear={state.handleClearLog}
                    onOpenRepairConfirm={() => state.setRepairConfirmOpen(true)}
                    draftEnabled={state.draft.Enabled}
                    draftUrl={state.draft.Url}
                />
            </div>
        </ScrollArea>
    );
}

function RepairConfirmDialog({ state }: { state: SettingsState }) {
    return (
        <AlertDialog open={state.repairConfirmOpen} onOpenChange={state.setRepairConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-destructive" />
                        Repair corrupted webhook log?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <RepairCorruptDescription corruptCount={state.corruptCount} />
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={state.repairBusy}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); state.handleRepair(); }}
                        disabled={state.repairBusy}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {state.repairBusy ? "Repairing…" : "Repair log"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function WebhookSettingsDialog({ open, onOpenChange }: Props) {
    const state = useWebhookSettingsState(open, onOpenChange);
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Webhook className="h-4 w-4" />
                            Result webhook
                        </DialogTitle>
                        <DialogDescription>
                            Send group-run, batch-run, and recording results to an external HTTP endpoint
                            as JSON. Leave disabled to opt out entirely.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody state={state} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={state.handleSave}>Save settings</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <RepairConfirmDialog state={state} />
        </>
    );
}
