/**
 * Marco Extension, Step Group List Panel: loaded-state body.
 *
 * Composition-only wrapper. Reads a single `state` bundle from
 * `useListPanelState` plus the shared `mutations` object.
 *
 * v4.213.0 (Plan-24 SS-04b Phase 9b): grid and dialog groups moved into
 * `ListPanelGrid.tsx` and `ListPanelDialogsGroup.tsx` so this function
 * stays under `max-lines-per-function`.
 */

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";

import { ListPanelHeader } from "./ListPanelHeader";
import { ListPanelGrid } from "./ListPanelGrid";
import { ListPanelDialogsGroup } from "./ListPanelDialogsGroup";
import type { ListPanelState } from "./use-list-panel-state";
import type { useListPanelMutations } from "./use-list-panel-mutations";

export interface ListPanelBodyProps {
    state: ListPanelState;
    mutations: ReturnType<typeof useListPanelMutations>;
}

export function ListPanelBody({ state: s, mutations: m }: ListPanelBodyProps) {
    return (
        <div className="flex h-full min-h-[600px] w-full flex-col gap-4 p-6">
            <Toaster />
            <ListPanelHeader
                projectName={s.projectName}
                filteredCount={s.filtered.length}
                totalCount={s.allGroups.length}
                selectedCount={s.selected.size}
                onClearSelection={s.clearSelection}
                onOpenBatchRename={() => s.setBatchRenameOpen(true)}
                onOpenBatchDelete={() => s.setBatchDeleteOpen(true)}
                onExportSelected={s.exportSelected}
                onOpenCreate={m.openCreate}
                onPickImportFile={() => s.fileInputRef.current?.click()}
                fileInputRef={s.fileInputRef}
                onImportFileChange={(file) => { void s.importApi.importFile(file); }}
            />
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={s.query}
                    onChange={(event) => s.setQuery(event.target.value)}
                    placeholder="Search by name or description…"
                    className="pl-9"
                    aria-label="Search step groups"
                />
            </div>
            <Separator />
            <ListPanelGrid state={s} mutations={m} />
            <ListPanelDialogsGroup state={s} mutations={m} />
        </div>
    );
}
