import { test, expect, type Page } from '@playwright/test';
import {
  startFixtureServer,
  gotoFixture,
  type FixtureServer,
  launchRecorderContext,
  type RecorderContext,
  toggleRecorder,
  waitForRecorderInjected,
  getRecorderPhase,
  waitForSteps,
  replaySteps,
} from './recorder-test-helpers';

/**
 * E2E-27 - Recorder Multi-Site
 *
 * The same record / replay flow on three distinct deterministic local
 * fixtures (never a live external site):
 *
 *   1. recorder-form.html     - contact form submit
 *   2. recorder-shop.html     - add-to-cart + checkout
 *   3. recorder-settings.html - settings save
 *
 * Each site: start recording, interact, stop, reload pristine, replay every
 * persisted step through RECORDER_STEP_RESOLVE, assert the resulting state.
 *
 * Priority: P0 | Auto: yes | Est: 6 min
 */

let server: FixtureServer;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await server.close();
});

interface Harness {
  rc: RecorderContext;
  page: Page;
}

async function openHarness(fixture: string): Promise<Harness> {
  const rc = await launchRecorderContext();
  const page = await rc.context.newPage();
  await gotoFixture(page, `${server.baseUrl}/${fixture}`);

  return { rc, page };
}

async function closeHarness(h: Harness): Promise<void> {
  await h.rc.context.close();
}

async function startRecording(h: Harness): Promise<void> {
  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(true);
  await waitForRecorderInjected(h.page);
  // Let the content-script listeners settle before the first interaction.
  await h.page.waitForTimeout(1_000);
}

async function stopRecording(h: Harness): Promise<void> {
  const phase = await getRecorderPhase(h.rc);

  if (phase === 'Recording') {
    await toggleRecorder(h.rc);
  }

  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(false);
}

async function recordAndReplay(
  fixture: string,
  interact: (page: Page) => Promise<void>,
  expectedSteps: number,
  statusSelector: string,
  expectedStatus: string,
): Promise<void> {
  const h = await openHarness(fixture);

  try {
    await startRecording(h);
    await interact(h.page);
    const steps = await waitForSteps(h.rc, h.rc.projectSlug, expectedSteps);
    expect(steps.length).toBeGreaterThanOrEqual(expectedSteps);
    await stopRecording(h);

    await gotoFixture(h.page, `${server.baseUrl}/${fixture}`);
    await replaySteps(h.page, h.rc, h.rc.projectSlug, steps);

    const status = await h.page.locator(statusSelector).textContent();
    expect(status).toBe(expectedStatus);
  } finally {
    await closeHarness(h);
  }
}

test.describe('E2E-27 - Recorder multi-site', () => {
  test('site 1: contact form record and replay', async () => {
    await recordAndReplay(
      'recorder-form.html',
      async (page) => {
        await page.fill('#fullName', 'Alicia Tan');
        await page.fill('#email', 'alicia@example.com');
        await page.selectOption('#country', 'jp');
        await page.click('#submitBtn');
        await page.waitForTimeout(3_000);
      },
      4,
      '#formStatus',
      'SUBMITTED:name=Alicia Tan|email=alicia@example.com|phone=|country=jp|newsletter=no|notes=',
    );
  });

  test('site 2: shop cart record and replay', async () => {
    await recordAndReplay(
      'recorder-shop.html',
      async (page) => {
        await page.click('[data-testid="add-keyboard"]');
        await page.waitForTimeout(500);
        await page.fill('[data-testid="qty-mouse"]', '2');
        await page.waitForTimeout(500);
        await page.click('[data-testid="add-mouse"]');
        await page.waitForTimeout(500);
        await page.click('#checkoutBtn');
        await page.waitForTimeout(3_000);
      },
      4,
      '#orderStatus',
      'ORDERED:3:108.99',
    );
  });

  test('site 3: settings record and replay', async () => {
    await recordAndReplay(
      'recorder-settings.html',
      async (page) => {
        await page.fill('#displayName', 'Ops Bot');
        await page.check('#emailAlerts');
        await page.selectOption('#theme', 'dark');
        await page.click('#saveSettingsBtn');
        await page.waitForTimeout(3_000);
      },
      4,
      '#settingsStatus',
      'SAVED:displayName=Ops Bot|emailAlerts=on|smsAlerts=off|theme=dark',
    );
  });
});
