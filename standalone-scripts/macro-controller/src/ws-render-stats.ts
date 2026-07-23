/**
 * ws-render-stats.ts — leaf module for the workspace dropdown render counters.
 *
 * Plan-17 step 19: previously `wsRenderStats` lived inside `ws-list-renderer.ts`
 * (as getters over a class singleton). `MacroController.ts` imported it via
 * the `ws-selection-ui` barrel, seeding madge cycles #2, #4, #6 (all
 * `MacroController → ws-selection-ui → ...` paths). Hosting the counters in
 * a zero-import leaf breaks every downstream cycle without changing runtime
 * semantics — the writer (`ws-list-renderer`) mutates the shared object; the
 * reader (`MacroController`) reads the same shared object. Both hit the same
 * mutable state because ES modules cache module-level bindings.
 *
 * No imports. No side effects.
 */

export interface WsRenderStats {
  executed: number;
  skipped: number;
}

/** Mutable shared counter object — written by ws-list-renderer, read by MacroController. */
export const wsRenderStats: WsRenderStats = {
  executed: 0,
  skipped: 0,
};
