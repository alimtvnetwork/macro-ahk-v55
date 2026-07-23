
import React, { useState, useMemo, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileCode,
  Globe,
  Braces,
  Clock,
  Crosshair,
  Key,
  Database,
  Wifi,
  Cookie,
  Stethoscope,
  MoreHorizontal,
  RefreshCw,
  BookOpen,
  Info,
  FolderOpen,
  Activity,
} from "lucide-react";
import type { StoredProject, StoredScript, StoredConfig } from "@/hooks/use-projects-scripts";
import { ProjectScriptSelector, type ScriptBinding } from "./ProjectScriptSelector";
import { DevGuideSection } from "./DevGuideSection";
import { AutoAttachDiagnosticsPanel } from "./AutoAttachDiagnosticsPanel";
import { slugify, toSdkNamespace } from "@/lib/slug-utils";
import { DocsTab } from "./project-detail/DocsTab";
import { ScriptsTabContent } from "./project-detail/ScriptsTabContent";
import { ProjectHeader } from "./project-detail/ProjectHeader";
import { GeneralTabContent } from "./project-detail/GeneralTabContent";

/* ------------------------------------------------------------------ */
/*  Lazy-loaded sub-tab panels (EXT perf: split 314KB chunk)           */
/* ------------------------------------------------------------------ */

function TabFallback() {
  return <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">Loading…</div>;
}

const TimingPanel = lazy(() => import("./TimingPanel").then(m => ({ default: m.TimingPanel })));
const XPathPanel = lazy(() => import("./XPathPanel").then(m => ({ default: m.XPathPanel })));
const AuthConfigPanel = lazy(() => import("./AuthConfigPanel").then(m => ({ default: m.AuthConfigPanel })));
const ProjectStoragePanel = lazy(() => import("./ProjectStoragePanel").then(m => ({ default: m.ProjectStoragePanel })));
const NetworkPanel = lazy(() => import("./NetworkPanel").then(m => ({ default: m.NetworkPanel })));
const CookiesPanel = lazy(() => import("./CookiesPanel").then(m => ({ default: m.CookiesPanel })));
const BootDiagnosticsPanel = lazy(() => import("./BootDiagnosticsPanel").then(m => ({ default: m.BootDiagnosticsPanel })));
const ProjectUrlRulesEditor = lazy(() => import("./ProjectUrlRulesEditor").then(m => ({ default: m.ProjectUrlRulesEditor })));
const ProjectFilesPanel = lazy(() => import("./ProjectFilesPanel").then(m => ({ default: m.ProjectFilesPanel })));
const ProjectVariablesEditor = lazy(() => import("./ProjectVariablesEditor").then(m => ({ default: m.ProjectVariablesEditor })));
const UpdaterPanel = lazy(() => import("./UpdaterPanel").then(m => ({ default: m.UpdaterPanel })));
const RecorderVisualisationPanel = lazy(() => import("./recorder/RecorderVisualisationPanel"));

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProjectTab =
  | "general"
  | "scripts"
  | "urls"
  | "variables"
  | "xpath"
  | "cookies"
  | "updater"
  | "docs"
  | "files"
  | "timing"
  | "auth"
  | "storage"
  | "network"
  | "recorder"
  | "diagnostics";

interface Props {
  project: StoredProject;
  allProjects: StoredProject[];
  availableScripts: StoredScript[];
  availableConfigs: StoredConfig[];
  onSave: (project: Partial<StoredProject>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const primaryTabs: Array<{ id: ProjectTab; label: string; icon: typeof FileCode }> = [
  { id: "general", label: "General", icon: Info },
  { id: "scripts", label: "Scripts", icon: FileCode },
  { id: "urls", label: "URL Rules", icon: Globe },
  { id: "variables", label: "Variables", icon: Braces },
  { id: "xpath", label: "XPath", icon: Crosshair },
  { id: "cookies", label: "Cookies", icon: Cookie },
  { id: "updater", label: "Update", icon: RefreshCw },
  { id: "docs", label: "Docs", icon: BookOpen },
];

const overflowTabs: Array<{ id: ProjectTab; label: string; icon: typeof FileCode }> = [
  { id: "files", label: "Files & Storage", icon: FolderOpen },
  { id: "timing", label: "Timing", icon: Clock },
  { id: "auth", label: "Auth", icon: Key },
  { id: "storage", label: "Storage", icon: Database },
  { id: "network", label: "Network", icon: Wifi },
  { id: "recorder", label: "Recorder", icon: Activity },
  { id: "diagnostics", label: "Diagnostics", icon: Stethoscope },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface TabListProps {
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
}

function OverflowTabMenu({ activeTab, setActiveTab }: TabListProps) {
  const isOverflowTab = overflowTabs.some((tab) => tab.id === activeTab);
  const activeOverflowItem = overflowTabs.find((tab) => tab.id === activeTab);
  const triggerClass = `inline-flex items-center justify-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 transition-all duration-200 hover:bg-primary/15 hover:text-primary ${
    isOverflowTab ? "bg-primary text-primary-foreground" : "text-muted-foreground"
  }`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={triggerClass}>
          <MoreHorizontal className="h-3.5 w-3.5" />
          {isOverflowTab && activeOverflowItem ? activeOverflowItem.label : "More"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {overflowTabs.map((tab) => (
          <DropdownMenuItem
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`gap-2 text-xs cursor-pointer ${activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : ""}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectTabsList({ activeTab, setActiveTab }: TabListProps) {
  return (
    <TabsList className="w-full justify-start bg-card border border-border flex-wrap h-auto gap-0.5 p-1">
      {primaryTabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          className="gap-1.5 text-xs transition-all duration-200 hover:bg-primary/15 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <tab.icon className="h-3.5 w-3.5" />
          {tab.label}
        </TabsTrigger>
      ))}
      <OverflowTabMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </TabsList>
  );
}

interface TabsBodyProps {
  activeTab: ProjectTab;
  project: StoredProject;
  allProjects: StoredProject[];
  availableScripts: StoredScript[];
  availableConfigs: StoredConfig[];
  onSave: (project: Partial<StoredProject>) => Promise<void>;
  sdkNamespace: string;
  projectSlug: string;
}

function LazyTabContent({ value, activeTab, children }: { value: ProjectTab; activeTab: ProjectTab; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-4" forceMount={activeTab === value ? true : undefined}>
      <Suspense fallback={<TabFallback />}>{children}</Suspense>
    </TabsContent>
  );
}

function PrimaryTabPanels({ activeTab, project, allProjects, availableScripts, availableConfigs, onSave, sdkNamespace, projectSlug }: TabsBodyProps) {
  const targetUrls = project.targetUrls ?? [];
  return (
    <>
      <TabsContent value="general" className="mt-4" forceMount={activeTab === "general" ? true : undefined}>
        <GeneralTabContent project={project} allProjects={allProjects} onSave={onSave} />
      </TabsContent>
      <TabsContent value="scripts" className="mt-4" forceMount={activeTab === "scripts" ? true : undefined}>
        <AutoAttachDiagnosticsPanel
          projectId={project.id}
          autoStart={project.settings?.autoStart === true}
          refreshKey={project.updatedAt ? new Date(project.updatedAt).getTime() : 0}
        />
        <ScriptsTabContent project={project} availableScripts={availableScripts} availableConfigs={availableConfigs} onSave={onSave} />
        <DevGuideSection namespace={sdkNamespace} section="scripts" targetUrls={targetUrls} />
      </TabsContent>
      <LazyTabContent value="urls" activeTab={activeTab}>
        <ProjectUrlRulesEditor targetUrls={targetUrls} onChange={(urls) => onSave({ id: project.id, targetUrls: urls })} />
        <DevGuideSection namespace={sdkNamespace} section="urls" targetUrls={targetUrls} />
      </LazyTabContent>
      <LazyTabContent value="variables" activeTab={activeTab}>
        <ProjectVariablesEditor
          variables={((project as unknown as Record<string, unknown>).variables as string) ?? "{}"}
          onChange={(vars) => onSave({ id: project.id, variables: vars } as Partial<StoredProject> & { variables: string })}
        />
        <DevGuideSection namespace={sdkNamespace} section="variables" targetUrls={targetUrls} />
      </LazyTabContent>
      <LazyTabContent value="xpath" activeTab={activeTab}>
        <XPathPanel
          chatBoxXPath={project.settings?.chatBoxXPath}
          onSaveChatBoxXPath={(xpath) => onSave({ id: project.id, settings: { ...project.settings, chatBoxXPath: xpath } })}
        />
        <DevGuideSection namespace={sdkNamespace} section="xpath" targetUrls={targetUrls} />
      </LazyTabContent>
      <LazyTabContent value="cookies" activeTab={activeTab}>
        <CookiesPanel
          bindings={project.cookies ?? []}
          onChange={(cookies) => onSave({ id: project.id, cookies })}
          sdkNamespace={sdkNamespace}
          legacyRules={(project as unknown as Record<string, unknown>).cookieRules as import("./CookiesPanel").CookieRule[] | undefined}
        />
        <DevGuideSection namespace={sdkNamespace} section="cookies" targetUrls={targetUrls} />
      </LazyTabContent>
      <LazyTabContent value="updater" activeTab={activeTab}>
        <UpdaterPanel projectId={project.id} />
      </LazyTabContent>
      <TabsContent value="docs" className="mt-4" forceMount={activeTab === "docs" ? true : undefined}>
        <DocsTab namespace={sdkNamespace} slug={projectSlug} targetUrls={targetUrls} />
      </TabsContent>
    </>
  );
}

function OverflowTabPanels({ activeTab, project, sdkNamespace, projectSlug }: TabsBodyProps) {
  const targetUrls = project.targetUrls ?? [];
  return (
    <>
      <LazyTabContent value="files" activeTab={activeTab}>
        <ProjectFilesPanel projectId={project.id} />
        <DevGuideSection namespace={sdkNamespace} section="files" targetUrls={targetUrls} />
      </LazyTabContent>
      <LazyTabContent value="timing" activeTab={activeTab}><TimingPanel /></LazyTabContent>
      <LazyTabContent value="auth" activeTab={activeTab}><AuthConfigPanel /></LazyTabContent>
      <LazyTabContent value="storage" activeTab={activeTab}>
        <ProjectStoragePanel projectId={project.id} projectSlug={projectSlug} />
      </LazyTabContent>
      <LazyTabContent value="network" activeTab={activeTab}><NetworkPanel /></LazyTabContent>
      <LazyTabContent value="recorder" activeTab={activeTab}>
        <RecorderVisualisationPanel projectSlug={projectSlug} />
      </LazyTabContent>
      <LazyTabContent value="diagnostics" activeTab={activeTab}><BootDiagnosticsPanel /></LazyTabContent>
    </>
  );
}

function ProjectTabsBody(props: TabsBodyProps) {
  return (
    <div key={props.activeTab} className="page-enter">
      <PrimaryTabPanels {...props} />
      <OverflowTabPanels {...props} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProjectDetailView({ project, allProjects, availableScripts, availableConfigs, onSave, onDelete, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("general");
  const projectSlug = project.slug || slugify(project.name);
  const sdkNamespace = useMemo(() => toSdkNamespace(projectSlug), [projectSlug]);
  return (
    <div className="space-y-4">
      <ProjectHeader
        project={project}
        onSave={onSave}
        onDelete={onDelete}
        onBack={onBack}
        onSwitchTab={(tab) => setActiveTab(tab as ProjectTab)}
      />
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProjectTab)}>
        <ProjectTabsList activeTab={activeTab} setActiveTab={setActiveTab} />
        <ProjectTabsBody
          activeTab={activeTab}
          project={project}
          allProjects={allProjects}
          availableScripts={availableScripts}
          availableConfigs={availableConfigs}
          onSave={onSave}
          sdkNamespace={sdkNamespace}
          projectSlug={projectSlug}
        />
      </Tabs>
    </div>
  );
}

export default ProjectDetailView;
