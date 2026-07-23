/**
 * Marco Extension — Message Router (Registry)
 *
 * Maps message types to handler functions. Separated from
 * the dispatch logic to stay under 200 lines per file.
 *
 * @see spec/05-chrome-extension/18-message-protocol.md — Message type definitions
 * @see src/shared/messages.ts — MessageType enum (source of truth)
 */

import { MessageType, type MessageRequest } from "../shared/messages";

import { buildStatusResponse } from "./status-handler";
import { buildHealthResponse } from "./health-handler";
import { buildAuthHealthResponse } from "./auth-health-handler";
import { getInaccessibleSeedTargets, getInaccessibleSeedCooldownMs } from "./handlers/token-seeder";
import { handleNetworkStatus, handleNetworkRequest, getRecentNetworkRequests, getNetworkStats, clearNetworkRequests } from "./network-handler";
import { buildApiEndpointsResponse, buildApiStatusResponse } from "./api-explorer-handler";
import { getRecentTrackedMessages } from "./message-tracker";

import {
    handleGetConfig,
    handleGetToken,
    handleRefreshToken,
} from "./handlers/config-auth-handler";

import {
    handleGetLogStats,
    handleGetRecentLogs,
    handleLogEntry,
    handleLogError,
    handleGetSessionLogs,
    handleGetSessionReport,
    handleBrowseOpfsSessions,
    handleGetOpfsStatus,
} from "./handlers/logging-handler";

import {
    handleExportLogsJson,
    handleExportLogsZip,
    handlePurgeLogs,
} from "./handlers/logging-export-handler";

import {
    handleDeleteProject,
    handleDuplicateProject,
    handleExportProject,
    handleGetActiveProject,
    handleGetAllProjects,
    handleImportProject,
    handleSaveProject,
    handleSetActiveProject,
    handleGetAutoAttachDecisions,
} from "./handlers/project-handler";


import {
    handleDeleteConfig,
    handleDeleteScript,
    handleGetAllConfigs,
    handleGetAllScripts,
    handleGetScriptConfig,
    handleOptionsBootstrap,
    handleSaveConfig,
    handleSaveScript,
    handleToggleScript,
} from "./handlers/script-config-handler";

import {
    handleGetTabInjections,
    handleInjectScripts,
} from "./handlers/injection-handler";

import { handleGetOpenLovableTabs } from "./handlers/open-tabs-handler";

import {
    handleGetLogDetail,
    handleGetStorageStats,
    handleQueryLogs,
} from "./handlers/storage-handler";

import {
    handleClearRecordedXPaths,
    handleGetRecordedXPaths,
    handleTestXPath,
    handleToggleXPathRecorder,
} from "./handlers/xpath-handler";

import { handleValidateAllXPaths } from "./handlers/xpath-validation-handler";

import {
    handleRecorderDataSourceAdd,
    handleRecorderDataSourceList,
} from "./handlers/recorder-data-source-handler";

import {
    handleRecorderFieldBindingUpsert,
    handleRecorderFieldBindingList,
    handleRecorderFieldBindingDelete,
} from "./handlers/recorder-field-binding-handler";

import {
    handleRecorderStepInsert,
    handleRecorderStepList,
    handleRecorderStepDelete,
    handleRecorderStepResolve,
    handleRecorderStepRename,
    handleRecorderStepSelectorsList,
    handleRecorderStepUpdateMeta,
    handleRecorderStepTagsSet,
    handleRecorderStepLinkSet,
} from "./handlers/recorder-step-handler";

import { handleRecorderCapturePersist, handleRecorderCapturePersistBatch } from "./handlers/recorder-capture-handler";

import {
    handleRecorderJsSnippetUpsert,
    handleRecorderJsSnippetList,
    handleRecorderJsSnippetDelete,
    handleRecorderJsStepDryRun,
} from "./handlers/recorder-js-handler";

import {
    handleGetActiveErrors,
    handleUserScriptError,
    handleClearErrors,
} from "./handlers/error-handler";

import { handleUserScriptLog } from "./handlers/user-script-log-handler";

import {
    handleDataSet,
    handleDataGet,
    handleDataDelete,
    handleDataKeys,
    handleDataGetAll,
    handleDataClear,
    handleGetDataStoreAll,
} from "./handlers/data-bridge-handler";

import {
    handleRecordCycleMetric,
    handleGetRunStats,
    handleClearRunStats,
} from "./handlers/run-stats-handler";

import {
    handleGetPrompts,
    handleSavePrompt,
    handleDeletePrompt,
    handleReorderPrompts,
    reseedPrompts,
} from "./handlers/prompt-handler";

import { cacheClearAll, cacheStats } from "./injection-cache";
import { handleDynamicRequire } from "./handlers/dynamic-require-handler";

import {
    handleGetPromptChains,
    handleSavePromptChain,
    handleDeletePromptChain,
    handleExecuteChainStep,
} from "./handlers/prompt-chain-handler";

import {
    handleGetSettings,
    handleSaveSettings,
    handleGetPromptVariables,
    handleSavePromptVariables,
} from "./handlers/settings-handler";

import {
    handleKvGet,
    handleKvSet,
    handleKvDelete,
    handleKvList,
} from "./handlers/kv-handler";

import {
    handleGkvGet,
    handleGkvSet,
    handleGkvDelete,
    handleGkvList,
    handleGkvClearGroup,
} from "./handlers/grouped-kv-handler";

import {
    handleFileSave,
    handleFileGet,
    handleFileList,
    handleFileDelete,
} from "./handlers/file-storage-handler";

import {
    handleStorageListTables,
    handleStorageGetSchema,
    handleStorageQueryTable,
    handleStorageUpdateRow,
    handleStorageDeleteRow,
    handleStorageClearTable,
    handleStorageClearAll,
    handleStorageReseed,
} from "./handlers/storage-browser-handler";

import {
    handleStorageSessionList,
    handleStorageSessionSet,
    handleStorageSessionDelete,
    handleStorageSessionClear,
    handleStorageCookiesList,
    handleStorageCookiesSet,
    handleStorageCookiesDelete,
    handleStorageCookiesClear,
} from "./handlers/storage-surfaces-handler";

import {
    handleListUpdaters,
    handleGetUpdater,
    handleCreateUpdater,
    handleDeleteUpdater,
    handleCheckForUpdate,
    handleGetUpdateSettings,
    handleSaveUpdateSettings,
} from "./handlers/updater-handler";

import {
    handleSdkAuthGetToken,
    handleSdkAuthGetSource,
    handleSdkAuthRefresh,
    handleSdkAuthIsExpired,
    handleSdkAuthGetJwt,
    handleSdkCookiesGet,
    handleSdkCookiesGetDetail,
    handleSdkCookiesGetAll,
    handleSdkConfigGet,
    handleSdkConfigGetAll,
    handleSdkConfigSet,
    handleSdkXPathGet,
    handleSdkXPathGetAll,
    handleSdkFileRead,
} from "./handlers/sdk-bridge-handler";

import { handleProjectApi } from "./handlers/project-api-handler";
import {
    handleProjectConfigRead,
    handleProjectConfigUpdate,
    handleProjectConfigReconstruct,
} from "./handlers/project-config-handler";

import {
    handleApplyJsonSchema,
    handleGenerateSchemaDocs,
} from "./handlers/schema-meta-handler";

import {
    handleGetAutomationChains,
    handleSaveAutomationChain,
    handleDeleteAutomationChain,
    handleToggleAutomationChain,
    handleImportAutomationChains,
} from "./handlers/automation-chain-handler";

import {
    handleGetScriptInfo,
    handleHotReloadScript,
} from "./handlers/script-info-handler";

import {
    handleGetSharedAssets,
    handleGetSharedAsset,
    handleSaveSharedAsset,
    handleDeleteSharedAsset,
    handleGetAssetLinks,
    handleSaveAssetLink,
    handleDeleteAssetLink,
    handleSyncLibraryAsset,
    handlePromoteAsset,
    handleReplaceLibraryAsset,
    handleForkLibraryAsset,
    handleGetProjectGroups,
    handleSaveProjectGroup,
    handleDeleteProjectGroup,
    handleGetGroupMembers,
    handleAddGroupMember,
    handleRemoveGroupMember,
    handleExportLibrary,
    handleImportLibrary,
    handleGetAssetVersions,
    handleRollbackAssetVersion,
    handleCascadeGroupSettings,
} from "./handlers/library-handler";

import {
    handleSdkSelfTestReport,
    handleGetSdkSelfTest,
} from "./handlers/sdk-selftest-handler";

/** Handler function that takes message and sender. */
export type MessageHandler = (
    message: MessageRequest,
    sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

/** Broadcast-only types that need no processing. */
export const BROADCAST_TYPES = new Set<MessageType>([
    MessageType.INJECTION_RESULT,
    MessageType.LOGGING_DEGRADED,
    MessageType.STORAGE_FULL,
    MessageType.CONFIG_UPDATED,
    MessageType.CONFIG_CHANGED,
    MessageType.TOKEN_EXPIRED,
    MessageType.TOKEN_UPDATED,
]);

function getProjectIdHint(message: MessageRequest): string | undefined {
    const maybeProjectId = (message as Record<string, string | undefined>).projectId;
    return typeof maybeProjectId === "string" && maybeProjectId.length > 0
        ? maybeProjectId
        : undefined;
}

function getTabUrlHint(
    message: MessageRequest,
    sender: chrome.runtime.MessageSender,
): string | undefined {
    const senderUrl = sender.tab?.url;
    if (typeof senderUrl === "string" && senderUrl.length > 0) {
        return senderUrl;
    }

    const maybeTabUrl = (message as Record<string, string | undefined>).tabUrl;
    if (typeof maybeTabUrl === "string" && maybeTabUrl.length > 0) {
        return maybeTabUrl;
    }

    const maybePageUrl = (message as Record<string, string | undefined>).pageUrl;
    return typeof maybePageUrl === "string" && maybePageUrl.length > 0
        ? maybePageUrl
        : undefined;
}

/** Registry mapping each message type to its handler. */
export const HANDLER_REGISTRY = new Map<MessageType, MessageHandler>([
    [MessageType.GET_CONFIG, async () => handleGetConfig()],
    [MessageType.GET_TOKEN, async (payload, sender) => handleGetToken(
        getProjectIdHint(payload),
        getTabUrlHint(payload, sender),
    )],
    [MessageType.REFRESH_TOKEN, async (payload, sender) => handleRefreshToken(
        getProjectIdHint(payload),
        getTabUrlHint(payload, sender),
    )],
    [MessageType.LOG_ENTRY, async (payload) => handleLogEntry(payload)],
    [MessageType.LOG_ERROR, async (payload) => handleLogError(payload)],
    [MessageType.GET_RECENT_LOGS, async (payload) => handleGetRecentLogs(payload)],
    [MessageType.GET_LOG_STATS, async () => handleGetLogStats()],
    [MessageType.PURGE_LOGS, async (payload) => handlePurgeLogs(payload)],
    [MessageType.EXPORT_LOGS_JSON, async () => handleExportLogsJson()],
    [MessageType.EXPORT_LOGS_ZIP, async () => handleExportLogsZip()],
    [MessageType.GET_ACTIVE_PROJECT, async (_msg, sender) => handleGetActiveProject(sender)],
    [MessageType.SET_ACTIVE_PROJECT, async (payload, sender) => handleSetActiveProject(payload, sender)],
    [MessageType.GET_ALL_PROJECTS, async () => handleGetAllProjects()],
    [MessageType.SAVE_PROJECT, async (payload) => handleSaveProject(payload)],
    [MessageType.DELETE_PROJECT, async (payload) => handleDeleteProject(payload)],
    [MessageType.DUPLICATE_PROJECT, async (payload) => handleDuplicateProject(payload)],
    [MessageType.IMPORT_PROJECT, async (payload) => handleImportProject(payload)],
    [MessageType.EXPORT_PROJECT, async (payload) => handleExportProject(payload)],
    [MessageType.GET_AUTO_ATTACH_DECISIONS, async (payload) => handleGetAutoAttachDecisions(payload)],
    [MessageType.GET_ALL_SCRIPTS, async () => handleGetAllScripts()],
    [MessageType.SAVE_SCRIPT, async (payload) => handleSaveScript(payload)],
    [MessageType.DELETE_SCRIPT, async (payload) => handleDeleteScript(payload)],
    [MessageType.TOGGLE_SCRIPT, async (payload) => handleToggleScript(payload)],
    [MessageType.GET_ALL_CONFIGS, async () => handleGetAllConfigs()],
    [MessageType.SAVE_CONFIG, async (payload) => handleSaveConfig(payload)],
    [MessageType.DELETE_CONFIG, async (payload) => handleDeleteConfig(payload)],
    [MessageType.GET_SCRIPT_CONFIG, async (payload) => handleGetScriptConfig(payload)],
    [MessageType.GET_OPTIONS_BOOTSTRAP, async () => handleOptionsBootstrap()],
    [MessageType.INJECT_SCRIPTS, async (payload) => handleInjectScripts(payload)],
    [MessageType.GET_TAB_INJECTIONS, async (payload) => handleGetTabInjections(payload)],
    [MessageType.GET_OPEN_LOVABLE_TABS, async () => handleGetOpenLovableTabs()],
    [MessageType.GET_STATUS, async () => buildStatusResponse()],
    [MessageType.GET_HEALTH_STATUS, async () => buildHealthResponse()],
    [MessageType.GET_AUTH_HEALTH, async () => buildAuthHealthResponse()],
    [MessageType.GET_TOKEN_SEEDER_DIAGNOSTICS, async () => ({
        targets: getInaccessibleSeedTargets(),
        cooldownMs: getInaccessibleSeedCooldownMs(),
        capturedAt: new Date().toISOString(),
    })],
    [MessageType.GET_API_STATUS, async () => buildApiStatusResponse()],
    [MessageType.GET_API_ENDPOINTS, async () => buildApiEndpointsResponse()],
    [MessageType.GET_ACTIVE_ERRORS, async () => handleGetActiveErrors()],
    [MessageType.CLEAR_ERRORS, async () => handleClearErrors()],
    [MessageType.NETWORK_STATUS, async (payload) => handleNetworkStatus(payload)],
    [MessageType.NETWORK_REQUEST, async (payload) => handleNetworkRequest(payload)],
    [MessageType.GET_NETWORK_REQUESTS, async () => ({ requests: getRecentNetworkRequests() })],
    [MessageType.GET_NETWORK_STATS, async () => getNetworkStats()],
    [MessageType.CLEAR_NETWORK_REQUESTS, async () => { clearNetworkRequests(); return { isOk: true }; }],
    [MessageType.GET_STORAGE_STATS, async () => handleGetStorageStats()],
    [MessageType.QUERY_LOGS, async (payload) => handleQueryLogs(payload)],
    [MessageType.GET_LOG_DETAIL, async (payload) => handleGetLogDetail(payload)],
    [MessageType.TOGGLE_XPATH_RECORDER, async (payload, sender) => handleToggleXPathRecorder(payload, sender)],
    [MessageType.GET_RECORDED_XPATHS, async (payload, sender) => handleGetRecordedXPaths(payload, sender)],
    [MessageType.CLEAR_RECORDED_XPATHS, async (payload, sender) => handleClearRecordedXPaths(payload, sender)],
    [MessageType.TEST_XPATH, async (payload) => handleTestXPath(payload)],
    [MessageType.VALIDATE_ALL_XPATHS, async (payload) => handleValidateAllXPaths(payload)],
    [MessageType.RECORDER_DATA_SOURCE_ADD, async (payload) => handleRecorderDataSourceAdd(payload)],
    [MessageType.RECORDER_DATA_SOURCE_LIST, async (payload) => handleRecorderDataSourceList(payload)],
    [MessageType.RECORDER_FIELD_BINDING_UPSERT, async (payload) => handleRecorderFieldBindingUpsert(payload)],
    [MessageType.RECORDER_FIELD_BINDING_LIST, async (payload) => handleRecorderFieldBindingList(payload)],
    [MessageType.RECORDER_FIELD_BINDING_DELETE, async (payload) => handleRecorderFieldBindingDelete(payload)],
    [MessageType.RECORDER_CAPTURE_PERSIST, async (payload) => handleRecorderCapturePersist(payload)],
    [MessageType.RECORDER_CAPTURE_PERSIST_BATCH, async (payload) => handleRecorderCapturePersistBatch(payload)],
    [MessageType.RECORDER_STEP_INSERT, async (payload) => handleRecorderStepInsert(payload)],
    [MessageType.RECORDER_STEP_LIST, async (payload) => handleRecorderStepList(payload)],
    [MessageType.RECORDER_STEP_DELETE, async (payload) => handleRecorderStepDelete(payload)],
    [MessageType.RECORDER_STEP_RESOLVE, async (payload) => handleRecorderStepResolve(payload)],
    [MessageType.RECORDER_STEP_RENAME, async (payload) => handleRecorderStepRename(payload)],
    [MessageType.RECORDER_STEP_SELECTORS_LIST, async (payload) => handleRecorderStepSelectorsList(payload)],
    [MessageType.RECORDER_STEP_UPDATE_META, async (payload) => handleRecorderStepUpdateMeta(payload)],
    [MessageType.RECORDER_STEP_TAGS_SET, async (payload) => handleRecorderStepTagsSet(payload)],
    [MessageType.RECORDER_STEP_LINK_SET, async (payload) => handleRecorderStepLinkSet(payload)],
    [MessageType.RECORDER_JS_SNIPPET_UPSERT, async (payload) => handleRecorderJsSnippetUpsert(payload)],
    [MessageType.RECORDER_JS_SNIPPET_LIST, async (payload) => handleRecorderJsSnippetList(payload)],
    [MessageType.RECORDER_JS_SNIPPET_DELETE, async (payload) => handleRecorderJsSnippetDelete(payload)],
    [MessageType.RECORDER_JS_STEP_DRYRUN, async (payload) => handleRecorderJsStepDryRun(payload)],
    [MessageType.USER_SCRIPT_ERROR, async (payload) => handleUserScriptError(payload)],
    [MessageType.USER_SCRIPT_LOG, async (payload) => handleUserScriptLog(payload)],
    [MessageType.USER_SCRIPT_DATA_SET, async (payload) => handleDataSet(payload)],
    [MessageType.USER_SCRIPT_DATA_GET, async (payload) => handleDataGet(payload)],
    [MessageType.USER_SCRIPT_DATA_DELETE, async (payload) => handleDataDelete(payload)],
    [MessageType.USER_SCRIPT_DATA_KEYS, async (payload) => handleDataKeys(payload)],
    [MessageType.USER_SCRIPT_DATA_GET_ALL, async (payload) => handleDataGetAll(payload)],
    [MessageType.USER_SCRIPT_DATA_CLEAR, async (payload) => handleDataClear(payload)],
    [MessageType.GET_DATA_STORE_ALL, async () => handleGetDataStoreAll()],
    [MessageType.RECORD_CYCLE_METRIC, async (payload) => handleRecordCycleMetric(payload)],
    [MessageType.GET_RUN_STATS, async () => handleGetRunStats()],
    [MessageType.CLEAR_RUN_STATS, async () => handleClearRunStats()],
    [MessageType.GET_PROMPTS, async () => handleGetPrompts()],
    [MessageType.SAVE_PROMPT, async (payload) => handleSavePrompt(payload)],
    [MessageType.DELETE_PROMPT, async (payload) => handleDeletePrompt(payload)],
    [MessageType.REORDER_PROMPTS, async (payload) => handleReorderPrompts(payload)],
    [MessageType.RESEED_PROMPTS, async () => { await reseedPrompts(); return { isOk: true }; }],
    [MessageType.GET_PROMPT_CHAINS, async () => handleGetPromptChains()],
    [MessageType.SAVE_PROMPT_CHAIN, async (payload) => handleSavePromptChain(payload)],
    [MessageType.DELETE_PROMPT_CHAIN, async (payload) => handleDeletePromptChain(payload)],
    [MessageType.EXECUTE_CHAIN_STEP, async (payload) => handleExecuteChainStep(payload)],
    [MessageType.GET_RECENT_MESSAGES, async (payload) => {
        const limit = (payload as Record<string, unknown>).limit as number ?? 10;
        return { messages: getRecentTrackedMessages(limit) };
    }],
    [MessageType.GET_SESSION_LOGS, async () => handleGetSessionLogs()],
    [MessageType.GET_SESSION_REPORT, async (payload) => handleGetSessionReport(payload)],
    [MessageType.BROWSE_OPFS_SESSIONS, async () => handleBrowseOpfsSessions()],
    [MessageType.GET_OPFS_STATUS, async () => handleGetOpfsStatus()],
    [MessageType.GET_SETTINGS, async () => handleGetSettings()],
    [MessageType.SAVE_SETTINGS, async (payload) => handleSaveSettings(payload)],
    [MessageType.GET_PROMPT_VARIABLES, async () => handleGetPromptVariables()],
    [MessageType.SAVE_PROMPT_VARIABLES, async (payload) => handleSavePromptVariables(payload)],
    [MessageType.KV_GET, async (payload) => handleKvGet(payload)],
    [MessageType.KV_SET, async (payload) => handleKvSet(payload)],
    [MessageType.KV_DELETE, async (payload) => handleKvDelete(payload)],
    [MessageType.KV_LIST, async (payload) => handleKvList(payload)],
    [MessageType.GKV_GET, async (payload) => handleGkvGet(payload)],
    [MessageType.GKV_SET, async (payload) => handleGkvSet(payload)],
    [MessageType.GKV_DELETE, async (payload) => handleGkvDelete(payload)],
    [MessageType.GKV_LIST, async (payload) => handleGkvList(payload)],
    [MessageType.GKV_CLEAR_GROUP, async (payload) => handleGkvClearGroup(payload)],
    [MessageType.FILE_SAVE, async (payload) => handleFileSave(payload)],
    [MessageType.FILE_GET, async (payload) => handleFileGet(payload)],
    [MessageType.FILE_LIST, async (payload) => handleFileList(payload)],
    [MessageType.FILE_DELETE, async (payload) => handleFileDelete(payload)],
    [MessageType.STORAGE_LIST_TABLES, async () => handleStorageListTables()],
    [MessageType.STORAGE_GET_SCHEMA, async (payload) => handleStorageGetSchema(payload)],
    [MessageType.STORAGE_QUERY_TABLE, async (payload) => handleStorageQueryTable(payload)],
    [MessageType.STORAGE_UPDATE_ROW, async (payload) => handleStorageUpdateRow(payload)],
    [MessageType.STORAGE_DELETE_ROW, async (payload) => handleStorageDeleteRow(payload)],
    [MessageType.STORAGE_CLEAR_TABLE, async (payload) => handleStorageClearTable(payload)],
    [MessageType.STORAGE_CLEAR_ALL, async () => handleStorageClearAll()],
    [MessageType.STORAGE_RESEED, async () => handleStorageReseed()],
    [MessageType.STORAGE_SESSION_LIST, async (payload) => handleStorageSessionList(payload)],
    [MessageType.STORAGE_SESSION_SET, async (payload) => handleStorageSessionSet(payload)],
    [MessageType.STORAGE_SESSION_DELETE, async (payload) => handleStorageSessionDelete(payload)],
    [MessageType.STORAGE_SESSION_CLEAR, async (payload) => handleStorageSessionClear(payload)],
    [MessageType.STORAGE_COOKIES_LIST, async (payload) => handleStorageCookiesList(payload)],
    [MessageType.STORAGE_COOKIES_SET, async (payload) => handleStorageCookiesSet(payload)],
    [MessageType.STORAGE_COOKIES_DELETE, async (payload) => handleStorageCookiesDelete(payload)],
    [MessageType.STORAGE_COOKIES_CLEAR, async (payload) => handleStorageCookiesClear(payload)],
    // ─── Updater (Spec 58) ───
    [MessageType.LIST_UPDATERS, async () => ({ updaters: handleListUpdaters() })],
    [MessageType.GET_UPDATER, async (payload) => ({ updater: handleGetUpdater((payload as Record<string, unknown>).updaterId as number) })],
    [MessageType.CREATE_UPDATER, async (payload) => ({ updaterId: handleCreateUpdater((payload as Record<string, unknown>).data as Record<string, unknown>) })],
    [MessageType.DELETE_UPDATER, async (payload) => { handleDeleteUpdater((payload as Record<string, unknown>).updaterId as number); return { isOk: true }; }],
    [MessageType.CHECK_FOR_UPDATE, async (payload) => handleCheckForUpdate((payload as Record<string, unknown>).updaterId as number)],
    [MessageType.GET_UPDATE_SETTINGS, async () => ({ settings: handleGetUpdateSettings() })],
    [MessageType.SAVE_UPDATE_SETTINGS, async (payload) => { handleSaveUpdateSettings((payload as Record<string, unknown>).data as Record<string, unknown>); return { isOk: true }; }],
    // ─── SDK Bridge (marco.*) ───
    [MessageType.AUTH_GET_TOKEN, async () => handleSdkAuthGetToken()],
    [MessageType.AUTH_GET_SOURCE, async () => handleSdkAuthGetSource()],
    [MessageType.AUTH_REFRESH, async () => handleSdkAuthRefresh()],
    [MessageType.AUTH_IS_EXPIRED, async () => handleSdkAuthIsExpired()],
    [MessageType.AUTH_GET_JWT, async () => handleSdkAuthGetJwt()],
    [MessageType.COOKIES_GET, async (payload) => handleSdkCookiesGet(payload)],
    [MessageType.COOKIES_GET_DETAIL, async (payload) => handleSdkCookiesGetDetail(payload)],
    [MessageType.COOKIES_GET_ALL, async (payload) => handleSdkCookiesGetAll(payload)],
    [MessageType.CONFIG_GET, async () => handleSdkConfigGet()],
    [MessageType.CONFIG_GET_ALL, async () => handleSdkConfigGetAll()],
    [MessageType.CONFIG_SET, async (payload) => handleSdkConfigSet(payload)],
    [MessageType.XPATH_GET, async (payload, sender) => handleSdkXPathGet(payload, sender)],
    [MessageType.XPATH_GET_ALL, async (payload, sender) => handleSdkXPathGetAll(payload, sender)],
    [MessageType.FILE_READ, async (payload) => handleSdkFileRead(payload)],
    // ─── Project Database API (Spec 67) ───
    [MessageType.PROJECT_API, async (payload) => handleProjectApi(payload)],
    [MessageType.PROJECT_DB_CREATE_TABLE, async (payload) => handleProjectApi({ ...payload as object, method: "SCHEMA", endpoint: "createTable" })],
    [MessageType.PROJECT_DB_DROP_TABLE, async (payload) => handleProjectApi({ ...payload as object, method: "SCHEMA", endpoint: "dropTable" })],
    [MessageType.PROJECT_DB_LIST_TABLES, async (payload) => handleProjectApi({ ...payload as object, method: "SCHEMA", endpoint: "listTables" })],
    // ─── Project Config DB (Issue 85) ───
    [MessageType.PROJECT_CONFIG_READ, async (payload) => handleProjectConfigRead(payload)],
    [MessageType.PROJECT_CONFIG_UPDATE, async (payload) => handleProjectConfigUpdate(payload)],
    [MessageType.PROJECT_CONFIG_RECONSTRUCT, async (payload) => handleProjectConfigReconstruct(payload)],
    // ─── Script Hot-Reload (Issue 77) ───
    [MessageType.GET_SCRIPT_INFO, async (payload) => handleGetScriptInfo(payload)],
    [MessageType.HOT_RELOAD_SCRIPT, async (payload) => handleHotReloadScript(payload)],
    // ─── Schema Meta Engine (Issue 85) ───
    [MessageType.APPLY_JSON_SCHEMA, async (payload) => handleApplyJsonSchema(payload)],
    [MessageType.GENERATE_SCHEMA_DOCS, async (payload) => handleGenerateSchemaDocs(payload)],
    // ─── Automation Chains (Spec 21) ───
    [MessageType.GET_AUTOMATION_CHAINS, async (payload) => handleGetAutomationChains(payload)],
    [MessageType.SAVE_AUTOMATION_CHAIN, async (payload) => handleSaveAutomationChain(payload)],
    [MessageType.DELETE_AUTOMATION_CHAIN, async (payload) => handleDeleteAutomationChain(payload)],
    [MessageType.TOGGLE_AUTOMATION_CHAIN, async (payload) => handleToggleAutomationChain(payload)],
    [MessageType.IMPORT_AUTOMATION_CHAINS, async (payload) => handleImportAutomationChains(payload)],
    // ─── Cache Management (Issue 88) ───
    [MessageType.INVALIDATE_CACHE, async () => {
        const result = await cacheClearAll();
        return { isOk: true, cleared: result.cleared };
    }],
    [MessageType.GET_CACHE_STATS, async () => {
        const stats = await cacheStats();
        return { isOk: true, ...stats };
    }],
    // ─── Dynamic Script Loading ───
    [MessageType.DYNAMIC_REQUIRE, async (payload) => {
        return handleDynamicRequire(payload);
    }],
    // ─── Cross-Project Sync (Spec 13) ───
    [MessageType.LIBRARY_GET_ASSETS, async (payload) => handleGetSharedAssets(payload)],
    [MessageType.LIBRARY_GET_ASSET, async (payload) => handleGetSharedAsset(payload)],
    [MessageType.LIBRARY_SAVE_ASSET, async (payload) => handleSaveSharedAsset(payload)],
    [MessageType.LIBRARY_DELETE_ASSET, async (payload) => handleDeleteSharedAsset(payload)],
    [MessageType.LIBRARY_GET_LINKS, async (payload) => handleGetAssetLinks(payload)],
    [MessageType.LIBRARY_SAVE_LINK, async (payload) => handleSaveAssetLink(payload)],
    [MessageType.LIBRARY_DELETE_LINK, async (payload) => handleDeleteAssetLink(payload)],
    [MessageType.LIBRARY_SYNC_ASSET, async (payload) => handleSyncLibraryAsset(payload)],
    [MessageType.LIBRARY_PROMOTE_ASSET, async (payload) => handlePromoteAsset(payload)],
    [MessageType.LIBRARY_REPLACE_ASSET, async (payload) => handleReplaceLibraryAsset(payload)],
    [MessageType.LIBRARY_FORK_ASSET, async (payload) => handleForkLibraryAsset(payload)],
    [MessageType.LIBRARY_GET_GROUPS, async () => handleGetProjectGroups()],
    [MessageType.LIBRARY_SAVE_GROUP, async (payload) => handleSaveProjectGroup(payload)],
    [MessageType.LIBRARY_DELETE_GROUP, async (payload) => handleDeleteProjectGroup(payload)],
    [MessageType.LIBRARY_GET_GROUP_MEMBERS, async (payload) => handleGetGroupMembers(payload)],
    [MessageType.LIBRARY_ADD_GROUP_MEMBER, async (payload) => handleAddGroupMember(payload)],
    [MessageType.LIBRARY_REMOVE_GROUP_MEMBER, async (payload) => handleRemoveGroupMember(payload)],
    [MessageType.LIBRARY_EXPORT, async () => handleExportLibrary()],
    [MessageType.LIBRARY_IMPORT, async (payload) => handleImportLibrary(payload)],
    [MessageType.LIBRARY_GET_VERSIONS, async (payload) => handleGetAssetVersions(payload)],
    [MessageType.LIBRARY_ROLLBACK_VERSION, async (payload) => handleRollbackAssetVersion(payload)],
    [MessageType.LIBRARY_CASCADE_GROUP_SETTINGS, async (payload) => handleCascadeGroupSettings(payload)],
    // ─── SDK Self-Test (Popup ✅/❌ panel) ───
    [MessageType.SDK_SELFTEST_REPORT, async (payload) => handleSdkSelfTestReport(payload)],
    [MessageType.GET_SDK_SELFTEST, async () => handleGetSdkSelfTest()],
]);
