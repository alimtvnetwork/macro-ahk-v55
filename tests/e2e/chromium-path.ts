import fs from 'fs';
import path from 'path';

/**
 * Chromium executable resolution, shared by playwright.config.ts and the
 * E2E fixtures.
 *
 * Why this exists: specs that build their own context through `launchExtension`
 * pass an explicit `executablePath`, while specs using the default Playwright
 * `page` fixture fell back to `channel: 'chromium'`. When the installed browser
 * registry does not match the Playwright version's expected build number, those
 * default-fixture specs die with:
 *   browserType.launch: Executable doesn't exist at
 *   /opt/ms-playwright/chromium-<build>/chrome-linux64/chrome
 * One resolver, used everywhere, keeps both launch paths on the same binary.
 */

const SYSTEM_CHROMIUM_CANDIDATES = [
  '/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

/** Scan the Playwright browser registry for any installed chromium build. */
function resolveFromPlaywrightRegistry(): string | undefined {
  const registry = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/ms-playwright';

  if (!fs.existsSync(registry)) {
    return undefined;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(registry);
  } catch {
    return undefined;
  }

  const builds = entries
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

  for (const build of builds) {
    for (const layout of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const candidate = path.join(registry, build, layout);

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

/**
 * Resolve a usable Chromium binary, or `undefined` to let Playwright pick its
 * own default (correct when the matching browser build is installed).
 */
export function resolveChromiumExecutablePath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }

  for (const candidate of SYSTEM_CHROMIUM_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return resolveFromPlaywrightRegistry();
}