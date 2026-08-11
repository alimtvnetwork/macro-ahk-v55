import sys

file = 'standalone-scripts/macro-controller/src/rename-bulk.ts'
with open(file, 'r', encoding='utf8') as f:
    content = f.read()

target = '''    if (isForbidden) {
      log('[Rename] ⛔ ' + (idx + 1) + '/' + entries.length + ' — "' + entry.oldName + '" SKIPPED (forbidden cache)', 'warn');
      results.skipped++;

      if (onProgress) {
        onProgress(results, false);
      }

      setTimeout(() => {
        this._doNextRename(idx + 1, entries, results, onProgress, forceRetry, consecutiveFailures); 
      }, MODAL_ANIMATION_DELAY_MS);

      return;
    }'''

replacement = '''    if (isForbidden) {
      this._handleForbidden(idx, entry, entries, results, onProgress, forceRetry, consecutiveFailures);
      return;
    }'''

new_method = '''  private _handleForbidden(
    idx: number,
    entry: BulkRenameEntry,
    entries: BulkRenameEntry[],
    results: BulkRenameResults,
    onProgress: (results: BulkRenameResults, done: boolean) => void,
    forceRetry: boolean | undefined,
    consecutiveFailures: number,
  ): void {
    log('[Rename] ⛔ ' + (idx + 1) + '/' + entries.length + ' — "' + entry.oldName + '" SKIPPED (forbidden cache)', 'warn');
    results.skipped++;

    if (onProgress) {
      onProgress(results, false);
    }

    setTimeout(() => {
      this._doNextRename(idx + 1, entries, results, onProgress, forceRetry, consecutiveFailures); 
    }, MODAL_ANIMATION_DELAY_MS);
  }

  private _doNextRename('''

content = content.replace(target, replacement)
content = content.replace("  private _doNextRename(", new_method)

with open(file, 'w', encoding='utf8') as f:
    f.write(content)
print('done')
