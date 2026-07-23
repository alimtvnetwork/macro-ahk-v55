/**
 * Playwright bundle entry for the collection-level export -> import
 * round-trip regression (v4.192.0+).
 *
 * Re-exports just the symbols the harness page exercises, so esbuild
 * produces a single self-contained IIFE we can inject with
 * `page.addScriptTag`.
 */
export {
    exportPromptsToJson,
    performPromptImport,
    parsePromptsText,
} from '../../../standalone-scripts/macro-controller/src/ui/prompt-io';
export { writeJsonCopy, readJsonCopy } from '../../../standalone-scripts/macro-controller/src/ui/prompt-cache';
export { openPromptHistoryPanel } from '../../../standalone-scripts/macro-controller/src/ui/prompt-history-panel';
