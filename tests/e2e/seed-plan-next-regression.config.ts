/**
 * Playwright config for the seed-plan-next regression spec.
 *
 * The main `playwright.config.ts` uses a globalSetup that builds every
 * extension bundle (macro-controller, marco-sdk, etc.) before any test runs.
 * The seed-plan-next regression harness is self-contained: it bundles the
 * seeder in-process with esbuild and launches its own headless chromium,
 * so it does not need the full extension build. This config runs only that
 * spec and skips globalSetup entirely, making CI/dev runs fast.
 *
 * Run with:
 *   npx playwright test --config=tests/e2e/seed-plan-next-regression.config.ts
 */
import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    testDir: __dirname,
    testMatch: /seed-plan-next-regression\.spec\.ts$/,
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    retries: 0,
    timeout: 60_000,
});
