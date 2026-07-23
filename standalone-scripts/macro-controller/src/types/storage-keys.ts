/**
 * LocalStorage and cache key constants.
 */
export enum StorageKey {
  PanelState = 'ml_panel_state',
  PanelGeometry = 'ml_panel_geometry',
  BackdropOpacity = 'marco_backdrop_opacity',
  RenameHistory = 'ml_rename_history',
  LogManagerConfig = 'marco_log_manager_config',
  LogStorage = 'ahk_macroloop_logs',
  TokenSavedAt = 'marco_token_saved_at',
  RenamePresetPrefix = 'MacroController.RenamePresets.',
  WsHistory = 'ml_workspace_history',
  WsShared = 'ml_known_workspaces',
  WsCachePrefix = 'marco_ws_cache_',
  WsLastProject = 'marco_last_project_id',
  ReinjectPrefix = '__marco_reinject_',
  GkvForbiddenGroup = 'rename_forbidden',
  ForcedTheme = 'dark',
  TaskQueue = 'marco_task_queue',
  LastSeedTelemetry = 'marco_last_seed_telemetry',
  /** Ring buffer of the last N prompt-seed/editor prefill trace events (v4.170.5). */
  PromptSeedTrace = 'marco_prompt_seed_trace',
  /** Ring buffer of the last N diagnostic-toast trace events (v4.298.0). */
  DiagnosticToastTrace = 'marco_diagnostic_toast_trace',
  /** Last Plan/Next seeding boot snapshot for the diagnostics panel (v4.405.0). */
  SeedStatusSnapshot = 'marco_seed_status_snapshot',
  /** Ring buffer of the last N PROMPT_EDIT_E005 role-diagnostic snapshots. */
  PromptEditE005Store = 'marco_prompt_edit_e005_store',
}
