/**
 * db/extension-bridge.ts — thin re-export of `sendToExtension` so `db/*`
 * never imports `ui/*`. Breaks the `sql-bridge -> prompt-loader -> ...`
 * circular-dependency chain (madge P0-09). Tests mock this module directly
 * to intercept bridge traffic.
 */
export { sendToExtension } from '../ui/extension-relay';