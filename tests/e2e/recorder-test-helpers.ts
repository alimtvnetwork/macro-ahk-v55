import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BrowserContext, Page } from '@playwright/test';
import { launchExtension, getExtensionId, openPopup } from './fixtures';

/**
 * Shared helpers for the recorder E2E specs (e2e-25/26/27).
 *
 * The recorder chain under test:
 *   toggle (TOGGLE_XPATH_RECORDER message, same path as Ctrl+Shift+R)
 *     -> background recorderReducer + persistSession
 *     -> chrome.scripting.executeScript injects content-scripts/xpath-recorder.js
 *     -> clicks/inputs captured with XPathFull (+ XPathRelative/AnchorXPath)
 *     -> xpath-capture-coalescer flushes RECORDER_CAPTURE_PERSIST_BATCH
 *     -> background capture handler -> capture-to-step-bridge
 *     -> per-project SQLite Step + Selector rows
 *
 * Fixtures are served over loopback HTTP so scripting injection works and
 * no live external site is ever touched.
 */

/* ------------------------------------------------------------------ */
/*  Fixture server                                                     */
/* ------------------------------------------------------------------ */

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'test', 'fixtures');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
};

export interface FixtureServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

/**
 * Navigates to a fixture URL. A direct CDP goto to loopback is rejected by
 * this Chromium's Local Network Access checks
 * (net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS), but a renderer-
 * initiated link click from an about:blank document navigates fine.
 */
export async function gotoFixture(page: Page, url: string): Promise<void> {
  // NB: do NOT page.goto('about:blank') here: a CDP-driven navigation (even to
  // about:blank) makes this Chromium reject the following loopback navigation
  // with ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS. A fresh page is already
  // about:blank; for anything else the caller should use page.reload().
  await page.setContent(`<a id="fixture-link" href="${url}">fixture</a>`);
  await Promise.all([
    page.waitForNavigation({ timeout: 30_000 }),
    page.click('#fixture-link'),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

/** Serves test/fixtures over http://127.0.0.1:<ephemeral>. */
export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const safe = path.normalize(urlPath).replace(/^[/\\]+/, '');

      if (safe.includes('..') || !safe.endsWith('.html')) {
        res.writeHead(404);
        res.end('not found');

        return;
      }

      const body = await readFile(path.join(FIXTURE_DIR, safe));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('fixture server failed to bind');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Extension context + service-worker messaging                       */
/* ------------------------------------------------------------------ */

export interface RecorderContext {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly projectSlug: string;
  /** Extension popup page used as the message bridge to the background. */
  readonly bg: Page;
}

/**
 * Sends a runtime message to the background. The message is dispatched from
 * the extension popup page: a service worker cannot reliably sendMessage to
 * itself ("Could not establish connection. Receiving end does not exist"),
 * but an extension page reaches the worker's onMessage router every time.
 */
export async function bgSend(rc: RecorderContext, message: Record<string, unknown>): Promise<unknown> {
  return rc.bg.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
}

/** Launches the extension and resolves the default active project slug. */
export async function launchRecorderContext(): Promise<RecorderContext> {
  const { chromium } = await import('@playwright/test');
  const context = await launchExtension(chromium);
  const extensionId = await getExtensionId(context);
  const bg = await openPopup(context, extensionId);
  const rc = { context, extensionId, projectSlug: '', bg };

  // The worker's project store initializes asynchronously after startup;
  // poll until GET_ACTIVE_PROJECT yields a slug. The popup bridge can also
  // be momentarily unavailable while the worker starts, so tolerate errors.
  // Some seeded projects have no slug; pin the known "lovable-common"
  // project as active so the suite is deterministic.
  let projectSlug = '';
  let lastResponse = 'none';

  for (let attempt = 0; attempt < 60 && !projectSlug; attempt++) {
    try {
      const res = await bgSend(rc, { type: 'GET_ACTIVE_PROJECT' }) as {
        activeProject?: { slug?: string };
        allProjects?: Array<{ id?: string; slug?: string }>;
      };
      lastResponse = JSON.stringify(res?.activeProject?.slug ?? null);

      const pinned = (res?.allProjects ?? []).find((p) => p.slug === 'lovable-common');

      if (pinned?.slug) {
        await bgSend(rc, { type: 'SET_ACTIVE_PROJECT', projectId: pinned.id ?? pinned.slug });
        projectSlug = pinned.slug;
      } else {
        projectSlug = res?.activeProject?.slug ?? '';
      }
    } catch (err) {
      lastResponse = `threw: ${(err as Error).message.slice(0, 120)}`;
    }

    if (!projectSlug) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!projectSlug) {
    throw new Error(`GET_ACTIVE_PROJECT returned no active project slug (last: ${lastResponse})`);
  }

  return { context, extensionId, projectSlug, bg };
}

/** Reads the canonical recorder session row from the worker's storage. */
export async function getRecorderPhase(rc: RecorderContext): Promise<string | null> {
  // Canonical key, see src/background/recorder/recorder-session-types.ts
  const result = await rc.bg.evaluate(async () => {
    const data = await chrome.storage.local.get('marco_recorder_session_v1');
    const s = data['marco_recorder_session_v1'] as { Phase?: string } | undefined;

    return s?.Phase ?? null;
  });

  return result as string | null;
}

/** Advances the recorder toggle (same canonical path as the Ctrl+Shift+R shortcut). */
export async function toggleRecorder(rc: RecorderContext): Promise<{ isRecording: boolean }> {
  return await bgSend(rc, { type: 'TOGGLE_XPATH_RECORDER' }) as { isRecording: boolean };
}

/**
 * Waits until the recorder content script has injected into the tab. The
 * toolbar host carries all of its UI inside a closed shadow root, so the
 * host element itself has zero size and never counts as "visible" — wait for
 * attachment instead. (The __marcoXPathRecorderActive sentinel lives in the
 * content script's isolated world and is not visible to page.evaluate.)
 */
export async function waitForRecorderInjected(page: Page): Promise<void> {
  await page.waitForSelector('#marco-recorder-toolbar-host', { state: 'attached', timeout: 15_000 });
}

/** Waits until the recorder has detached from the tab (toolbar host removed). */
export async function waitForRecorderDetached(page: Page): Promise<void> {
  await page.waitForSelector('#marco-recorder-toolbar-host', { state: 'detached', timeout: 15_000 });
}

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

export interface PersistedStepView {
  StepId: number;
  StepKindId: number;
  OrderIndex: number;
  VariableName: string;
  LabelType: string;
  ParamsJson: string | null;
}

export async function listSteps(rc: RecorderContext, projectSlug: string): Promise<PersistedStepView[]> {
  const res = await bgSend(rc, { type: 'RECORDER_STEP_LIST', projectSlug }) as {
    steps: PersistedStepView[];
  };

  return [...res.steps].sort((a, b) => a.OrderIndex - b.OrderIndex);
}

/** Polls until at least `count` steps are persisted (or the timeout elapses). */
export async function waitForSteps(
  rc: RecorderContext,
  projectSlug: string,
  count: number,
  timeoutMs = 20_000,
): Promise<PersistedStepView[]> {
  const deadline = Date.now() + timeoutMs;
  let last: PersistedStepView[] = [];

  while (Date.now() < deadline) {
    last = await listSteps(rc, projectSlug);

    if (last.length >= count) {
      return last;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`timed out waiting for ${count} steps; have ${last.length}`);
}

export interface ResolvedSelectorView {
  kind: string;
  expression: string;
}

/** Resolves a step's primary selector through the replay contract. */
export async function resolveStep(
  rc: RecorderContext,
  projectSlug: string,
  stepId: number,
): Promise<ResolvedSelectorView> {
  const res = await bgSend(rc, {
    type: 'RECORDER_STEP_RESOLVE',
    projectSlug,
    stepId,
  }) as { resolved: { SelectorKind?: string; Kind?: string; Expression?: string; expression?: string } };

  const r = res.resolved;

  return {
    kind: r.SelectorKind ?? r.Kind ?? 'XPath',
    expression: r.Expression ?? r.expression ?? '',
  };
}

export interface PersistedSelectorView {
  SelectorId: number;
  StepId: number;
  Expression: string;
  AnchorSelectorId: number | null;
  IsPrimary: number;
}

/** Lists persisted selectors for a step (primary first by IsPrimary). */
export async function listSelectors(
  rc: RecorderContext,
  projectSlug: string,
  stepId: number,
): Promise<PersistedSelectorView[]> {
  const res = await bgSend(rc, {
    type: 'RECORDER_STEP_SELECTORS_LIST',
    projectSlug,
    stepId,
  }) as { selectors: PersistedSelectorView[] };

  return [...res.selectors].sort((a, b) => b.IsPrimary - a.IsPrimary);
}

/** Throws when the background reports isOk === false. */
function assertOk(res: unknown, what: string): asserts res is { isOk: true } {
  const r = res as { isOk?: boolean; errorMessage?: string };

  if (r.isOk === false) {
    throw new Error(`${what} rejected: ${r.errorMessage ?? 'unknown error'}`);
  }
}

export async function renameStep(
  rc: RecorderContext,
  projectSlug: string,
  stepId: number,
  newVariableName: string,
): Promise<void> {
  const res = await bgSend(rc, {
    type: 'RECORDER_STEP_RENAME',
    projectSlug,
    stepId,
    newVariableName,
  });
  assertOk(res, 'RECORDER_STEP_RENAME');
}

export async function deleteStep(
  rc: RecorderContext,
  projectSlug: string,
  stepId: number,
): Promise<void> {
  const res = await bgSend(rc, { type: 'RECORDER_STEP_DELETE', projectSlug, stepId });
  assertOk(res, 'RECORDER_STEP_DELETE');
}

export async function insertStep(
  rc: RecorderContext,
  projectSlug: string,
  draft: Record<string, unknown>,
): Promise<number> {
  const res = await bgSend(rc, {
    type: 'RECORDER_STEP_INSERT',
    projectSlug,
    draft,
  }) as { isOk?: boolean; errorMessage?: string; step: { StepId: number } };
  assertOk(res, 'RECORDER_STEP_INSERT');

  return res.step.StepId;
}

/* ------------------------------------------------------------------ */
/*  Replay driver                                                      */
/* ------------------------------------------------------------------ */

/**
 * Replays steps against a freshly loaded page: resolves each step's primary
 * XPath, locates the element, and performs the matching DOM action
 * (fill for text inputs, selectOption for selects, click otherwise).
 */
export async function replaySteps(
  page: Page,
  rc: RecorderContext,
  projectSlug: string,
  steps: PersistedStepView[],
): Promise<void> {
  for (const step of steps) {
    const { expression } = await resolveStep(rc, projectSlug, step.StepId);

    if (!expression) {
      throw new Error(`step ${step.StepId} resolved to an empty expression`);
    }

    const paramValue = step.ParamsJson ? (JSON.parse(step.ParamsJson) as { Value?: string }).Value : undefined;

    await page.evaluate(({ xpath, value }) => {
      const node = document.evaluate(
        xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;

      if (!node) {
        throw new Error('replay: XPath matched no element: ' + xpath);
      }

      const tag = node.tagName.toLowerCase();

      if (tag === 'select') {
        (node as HTMLSelectElement).value = value ?? '';
        node.dispatchEvent(new Event('change', { bubbles: true }));

        return;
      }

      if (tag === 'input' || tag === 'textarea') {
        const input = node as HTMLInputElement;

        if (input.type === 'checkbox' || input.type === 'radio') {
          input.click();

          return;
        }

        input.focus();
        input.value = value ?? '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        return;
      }

      (node as HTMLElement).click();
    }, { xpath: expression, value: paramValue });
  }
}

/** Evaluates an XPath in the page and returns the matched element's tag name. */
export async function xpathTagName(page: Page, xpath: string): Promise<string | null> {
  return page.evaluate((xp) => {
    const node = document.evaluate(
      xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
    ).singleNodeValue as Element | null;

    return node ? node.tagName.toLowerCase() : null;
  }, xpath);
}
