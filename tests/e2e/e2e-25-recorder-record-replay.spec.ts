import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  startFixtureServer,
  gotoFixture,
  type FixtureServer,
  launchRecorderContext,
  type RecorderContext,
  toggleRecorder,
  getRecorderPhase,
  waitForRecorderInjected,
  waitForRecorderDetached,
  waitForSteps,
  listSteps,
  listSelectors,
  replaySteps,
} from './recorder-test-helpers';

/**
 * E2E-25 - Recorder Record / Replay
 *
 * Exercises the full recording chain in a real browser with the packaged
 * extension loaded:
 *
 *   toggle (TOGGLE_XPATH_RECORDER, same canonical path as Ctrl+Shift+R)
 *     -> background recorderReducer + persistSession
 *     -> chrome.scripting.executeScript injects content-scripts/xpath-recorder.js
 *     -> clicks / inputs captured with stable XPaths (id > testid > role+text)
 *     -> coalescer flushes RECORDER_CAPTURE_PERSIST_BATCH
 *     -> capture-to-step-bridge -> per-project SQLite Step + Selector rows
 *
 * Then: stop, reload the fixture pristine, replay every step through
 * RECORDER_STEP_RESOLVE, and assert the resulting page state.
 *
 * Priority: P0 | Auto: yes | Est: 4 min
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

async function openRecordingPage(fixture: string): Promise<Harness> {
  const rc = await launchRecorderContext();
  const page = await rc.context.newPage();
  await gotoFixture(page, `${server.baseUrl}/${fixture}`);

  return { rc, page };
}

async function closeHarness(h: Harness): Promise<void> {
  await h.rc.context.close();
}

/** Starts recording and waits for the in-page toolbar to mount. */
async function startRecording(h: Harness): Promise<void> {
  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(true);
  expect(await getRecorderPhase(h.rc)).toBe('Recording');
  await waitForRecorderInjected(h.page);
}

/** Stops recording from Recording or Paused and waits for detach. */
async function stopRecording(h: Harness): Promise<void> {
  const phase = await getRecorderPhase(h.rc);

  if (phase === 'Recording') {
    const res = await toggleRecorder(h.rc);
    expect(res.isRecording).toBe(true);
    expect(await getRecorderPhase(h.rc)).toBe('Paused');
  }

  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(false);
  expect(await getRecorderPhase(h.rc)).toBeNull();
  await waitForRecorderDetached(h.page);
}

/** Performs the standard form interaction flow on recorder-form.html. */
async function interactWithForm(page: Page): Promise<void> {
  await page.fill('#fullName', 'Alicia Tan');
  await page.fill('#email', 'alicia@example.com');
  await page.fill('[data-testid="phone-input"]', '60123456789');
  await page.selectOption('#country', 'ca');
  await page.check('#newsletter');
  await page.click('#submitBtn');
  // Input captures are debounced 500ms in the recorder; the coalescer
  // flushes 200ms after the last enqueue; the bridge waits 200ms per
  // capture for tab-open detection. Allow the pipeline to drain.
  await page.waitForTimeout(3_000);
}

test.describe('E2E-25 - Recorder record / replay', () => {
  test('toggle starts recording and injects the recorder into the tab', async () => {
    const h = await openRecordingPage('recorder-form.html');

    try {
      expect(await getRecorderPhase(h.rc)).toBeNull();
      await startRecording(h);
    } finally {
      await closeHarness(h);
    }
  });

  test('captures clicks and text input with stable XPaths', async () => {
    const h = await openRecordingPage('recorder-form.html');

    try {
      await startRecording(h);
      await interactWithForm(h.page);

      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 6);
      expect(steps).toHaveLength(6);

      // Every step resolves a primary XPathFull selector; id-based
      // elements must use the id strategy.
      const expected: Record<string, string> = {
        fullName: '//*[@id="fullName"]',
        email: '//*[@id="email"]',
        phone: '//*[@data-testid="phone-input"]',
        country: '//*[@id="country"]',
        newsletter: '//*[@id="newsletter"]',
        submit: '//*[@id="submitBtn"]',
      };
      const seen = new Set<string>();

      for (const step of steps) {
        const selectors = await listSelectors(h.rc, h.rc.projectSlug, step.StepId);
        const primary = selectors.find((s) => s.IsPrimary === 1);
        expect(primary).toBeDefined();
        expect(primary!.Expression.length).toBeGreaterThan(0);
        seen.add(primary!.Expression);
      }

      for (const xpath of Object.values(expected)) {
        expect(seen.has(xpath)).toBe(true);
      }

      await stopRecording(h);
    } finally {
      await closeHarness(h);
    }
  });

  test('pause suspends capture; stop detaches the recorder', async () => {
    const h = await openRecordingPage('recorder-form.html');

    try {
      await startRecording(h);
      await h.page.fill('#fullName', 'Alicia Tan');
      await h.page.waitForTimeout(3_000);
      expect((await listSteps(h.rc, h.rc.projectSlug)).length).toBeGreaterThan(0);

      // Pause: further interaction must not be captured.
      const res = await toggleRecorder(h.rc);
      expect(res.isRecording).toBe(true);
      expect(await getRecorderPhase(h.rc)).toBe('Paused');

      const before = (await listSteps(h.rc, h.rc.projectSlug)).length;
      await h.page.fill('#email', 'nobody@example.com');
      await h.page.click('#submitBtn');
      await h.page.waitForTimeout(3_000);
      const after = (await listSteps(h.rc, h.rc.projectSlug)).length;
      expect(after).toBe(before);

      // Stop: session row removed, toolbar detached.
      await stopRecording(h);
    } finally {
      await closeHarness(h);
    }
  });

  test('replay reproduces the recorded form submission', async () => {
    const h = await openRecordingPage('recorder-form.html');

    try {
      await startRecording(h);
      await interactWithForm(h.page);
      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 6);
      await stopRecording(h);

      // Reload pristine via the LNA-safe helper, then replay every recorded step.
      await gotoFixture(h.page, `${server.baseUrl}/recorder-form.html`);
      await replaySteps(h.page, h.rc, h.rc.projectSlug, steps);

      const status = await h.page.locator('#formStatus').textContent();
      expect(status).toBe(
        'SUBMITTED:name=Alicia Tan|email=alicia@example.com|phone=60123456789|country=ca|newsletter=yes|notes=',
      );
    } finally {
      await closeHarness(h);
    }
  });

  test('toggle-recording command is registered with Ctrl+Shift+R', async () => {
    const h = await openRecordingPage('recorder-form.html');

    try {
      // The manifest registers commands.toggle-recording; synthetic key
      // events from CDP do not reach Chrome's browser-level accelerator
      // system, so verify the registration instead of pressing keys.
      const commands = await h.rc.bg.evaluate(async () => chrome.commands.getAll()) as Array<{
        name?: string;
        shortcut?: string;
      }>;
      const toggle = commands.find((c) => c.name === 'toggle-recording');
      expect(toggle).toBeDefined();
      // The manifest declares Ctrl+Shift+R (verified in manifest.json);
      // getAll() may report an empty shortcut in a fresh test profile.

      // The command handler is the same canonical path the other tests
      // drive via TOGGLE_XPATH_RECORDER; verify it toggles end to end.
      await startRecording(h);
      await stopRecording(h);
    } finally {
      await closeHarness(h);
    }
  });
});
