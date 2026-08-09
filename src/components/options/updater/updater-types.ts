import { InstructionStepType, ResourceType, UpdaterEntryStatusType } from "../../../types/enums";

export interface UpdaterEndpoint {
  id: number;
  url: string;
  sortOrder: number;
  expectedStatusCode: number;
  isRedirectable: boolean;
  maxRedirectDepth: number;
}

export interface UpdaterStep {
  id: number;
  stepId: string;
  sortOrder: number;
  type: InstructionStepType;
  condition?: string;
  resourceType?: ResourceType;
  sourceUrl?: string;
  expectedStatus?: number;
  isRedirectable?: boolean;
  maxRedirectDepth?: number;
  destination?: string;
  postProcess?: string;
  executionCommand?: string;
  validationRule?: string;
}

export interface UpdaterEntry {
  id: number;
  name: string;
  description?: string;
  scriptUrl: string;
  versionInfoUrl?: string;
  instructionUrl?: string;
  changelogUrl?: string;
  isGit: boolean;
  isRedirectable: boolean;
  maxRedirectDepth: number;
  isInstructionRedirect: boolean;
  instructionRedirectDepth: number;
  hasInstructions: boolean;
  hasChangelogFromVersionInfo: boolean;
  hasUserConfirmBeforeUpdate: boolean;
  isEnabled: boolean;
  autoCheckIntervalMinutes: number;
  cacheExpiryMinutes: number;
  cachedRedirectUrl?: string;
  cachedRedirectAt?: string;
  currentVersion?: string;
  latestVersion?: string;
  lastCheckedAt?: string;
  lastUpdatedAt?: string;
  categories: string[];
  endpoints: UpdaterEndpoint[];
  steps: UpdaterStep[];
  status?: UpdaterEntryStatusType;
}

export const INTERVAL_OPTIONS = [
  { label: "Hourly", value: 60 },
  { label: "Every 5 hours", value: 300 },
  { label: "Every 12 hours", value: 720 },
  { label: "Daily", value: 1440 },
  { label: "Every 2 days", value: 2880 },
  { label: "Every 3 days", value: 4320 },
  { label: "Every 5 days", value: 7200 },
  { label: "Weekly", value: 10080 },
  { label: "Every 15 days", value: 21600 },
  { label: "Monthly", value: 43200 },
  { label: "Every 2 months", value: 86400 },
  { label: "Every 3 months", value: 129600 },
  { label: "Yearly", value: 525600 },
] as const;

export const STEP_TYPES = ["Download", "Execute", "Update", "Validate"] as const;
export const RESOURCE_TYPES = ["Script", "Binary", "ChromeExtension"] as const;

export const AVAILABLE_CATEGORIES = ["Script", "Binary", "ChromeExtension", "Security", "Feature", "Bugfix", "Core"] as const;

export function intervalLabel(minutes: number): string {
  return INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes}m`;
}

export const STATUS_UP_TO_DATE = "up-to-date" as const;
export const STATUS_UPDATE_AVAILABLE = "update-available" as const;

export function mapBackendEntry(u: Record<string, unknown>): UpdaterEntry {
  const cats = typeof u.Categories === "string" && u.Categories
    ? (u.Categories as string).split(", ").filter(Boolean)
    : [];

  const computeStatus = (): UpdaterEntry["status"] => {
    if (!u.LastCheckedAt) return "unchecked";
    if (u.CurrentVersion && u.LatestVersion && u.CurrentVersion !== u.LatestVersion) return STATUS_UPDATE_AVAILABLE;
    if (u.LatestVersion) return STATUS_UP_TO_DATE;

    return "unchecked";
  };

  return {
    id: (u.UpdaterId ?? u.Id ?? 0) as number,
    name: (u.Name ?? "") as string,
    description: (u.Description as string) ?? undefined,
    scriptUrl: (u.ScriptUrl ?? "") as string,
    versionInfoUrl: (u.VersionInfoUrl as string) ?? undefined,
    instructionUrl: (u.InstructionUrl as string) ?? undefined,
    changelogUrl: (u.ChangelogUrl as string) ?? undefined,
    isGit: u.IsGit === 1 || u.IsGit === true,
    isRedirectable: u.IsRedirectable !== 0 && u.IsRedirectable !== false,
    maxRedirectDepth: (u.MaxRedirectDepth ?? 2) as number,
    isInstructionRedirect: u.IsInstructionRedirect === 1 || u.IsInstructionRedirect === true,
    instructionRedirectDepth: (u.InstructionRedirectDepth ?? 2) as number,
    hasInstructions: u.HasInstructions === 1 || u.HasInstructions === true,
    hasChangelogFromVersionInfo: u.HasChangelogFromVersionInfo !== 0 && u.HasChangelogFromVersionInfo !== false,
    hasUserConfirmBeforeUpdate: u.HasUserConfirmBeforeUpdate === 1 || u.HasUserConfirmBeforeUpdate === true,
    isEnabled: u.IsEnabled !== 0 && u.IsEnabled !== false,
    autoCheckIntervalMinutes: (u.AutoCheckIntervalMinutes ?? 1440) as number,
    cacheExpiryMinutes: (u.CacheExpiryMinutes ?? 10080) as number,
    cachedRedirectUrl: (u.CachedRedirectUrl as string) ?? undefined,
    cachedRedirectAt: (u.CachedRedirectAt as string) ?? undefined,
    currentVersion: (u.CurrentVersion as string) ?? undefined,
    latestVersion: (u.LatestVersion as string) ?? undefined,
    lastCheckedAt: (u.LastCheckedAt as string) ?? undefined,
    lastUpdatedAt: (u.LastUpdatedAt as string) ?? undefined,
    categories: cats,
    endpoints: [],
    steps: [],
    status: computeStatus(),
  };
}
