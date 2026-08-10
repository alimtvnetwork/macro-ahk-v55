/**
 * Shared build-output resolution for Chrome extension E2E.
 *
 * The extension can live in two places depending on how the suite is run:
 *   - `chrome-extension/` when built locally by `pnpm run build:extension`
 *   - `dist/` when CI downloads the `chrome-extension-dist` artifact
 *
 * Every consumer (playwright.config.ts, global-setup.ts, fixtures.ts) must use
 * this resolver so the three never drift apart.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');

export const EXTENSION_CANDIDATES = [
  path.join(REPO_ROOT, 'chrome-extension'),
  path.join(REPO_ROOT, 'dist'),
];

/** True when the given directory holds a built extension. */
export function hasBuiltExtension(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'manifest.json'));
}

/** First candidate containing a manifest, else the canonical build dir. */
export function resolveExtensionDir(): string {
  for (const candidate of EXTENSION_CANDIDATES) {
    if (hasBuiltExtension(candidate)) return candidate;
  }

  return EXTENSION_CANDIDATES[0];
}

/** True when a prebuilt extension is already on disk (CI artifact download). */
export function prebuiltExtensionExists(): boolean {
  return EXTENSION_CANDIDATES.some(hasBuiltExtension);
}
