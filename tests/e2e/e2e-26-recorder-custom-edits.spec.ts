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
  listSteps,
  listSelectors,
  renameStep,
  deleteStep,
  insertStep,
  replaySteps,
  type PersistedStepView,
} from './recorder-test-helpers';

/**
 * E2E-26 - Recorder Custom Edits
 *
 * Records a short macro, then applies on-the-fly custom changes through the
 * step messages and replays the edited sequence:
 *
 *   rename  - RECORDER_STEP_RENAME (+ variable-name uniqueness enforcement)
 *   delete  - RECORDER_STEP_DELETE (+ OrderIndex reindexing)
 *   insert  - RECORDER_STEP_INSERT (custom Type step spliced into the flow)
 *   reorder - delete + re-insert in a new order, then replay to prove the
 *             new order drives the resulting page state
 *
 * Priority: P0 | Auto: yes | Est: 5 min
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

async function openRecordingPage(): Promise<Harness> {
  const rc = await launchRecorderContext();
  const page = await rc.context.newPage();
  await gotoFixture(page, `${server.baseUrl}/recorder-form.html`);

  return { rc, page };
}

async function closeHarness(h: Harness): Promise<void> {
  await h.rc.context.close();
}

async function startRecording(h: Harness): Promise<void> {
  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(true);
  await waitForRecorderInjected(h.page);
}

async function stopRecording(h: Harness): Promise<void> {
  const phase = await getRecorderPhase(h.rc);

  if (phase === 'Recording') {
    await toggleRecorder(h.rc);
  }

  const res = await toggleRecorder(h.rc);
  expect(res.isRecording).toBe(false);
  expect(await getRecorderPhase(h.rc)).toBeNull();
}

/** Builds a minimal one-selector draft for RECORDER_STEP_INSERT. */
function xpathDraft(
  kindId: number,
  variableName: string,
  labelType: string,
  expression: string,
  value?: string,
): Record<string, unknown> {
  return {
    StepKindId: kindId,
    VariableName: variableName,
    LabelType: labelType,
    InlineJs: null,
    ParamsJson: value === undefined ? null : JSON.stringify({ Value: value }),
    IsBreakpoint: false,
    Selectors: [
      {
        SelectorKindId: 1,
        Expression: expression,
        AnchorSelectorId: null,
        IsPrimary: true,
      },
    ],
  };
}

async function primaryExpression(h: Harness, step: PersistedStepView): Promise<string> {
  const selectors = await listSelectors(h.rc, h.rc.projectSlug, step.StepId);
  const primary = selectors.find((s) => s.IsPrimary === 1);

  if (!primary) {
    throw new Error(`step ${step.StepId} has no primary selector`);
  }

  return primary.Expression;
}

test.describe('E2E-26 - Recorder custom edits', () => {
  test('rename a step; duplicate names are rejected', async () => {
    const h = await openRecordingPage();

    try {
      await startRecording(h);
      await h.page.fill('#fullName', 'Alicia Tan');
      await h.page.click('#submitBtn');
      await h.page.waitForTimeout(3_000);
      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 2);
      await stopRecording(h);

      await renameStep(h.rc, h.rc.projectSlug, steps[0].StepId, 'CustomerName');
      let listed = await listSteps(h.rc, h.rc.projectSlug);
      expect(listed[0].VariableName).toBe('CustomerName');

      // Uniqueness: renaming the second step to the same name must fail.
      let rejected: unknown = null;

      try {
        await renameStep(h.rc, h.rc.projectSlug, steps[1].StepId, 'CustomerName');
      } catch (err) {
        rejected = err;
      }

      expect(rejected).not.toBeNull();
      expect(String(rejected)).toContain('CustomerName');

      // The failed rename left the original name intact.
      listed = await listSteps(h.rc, h.rc.projectSlug);
      expect(listed[1].VariableName).not.toBe('CustomerName');
    } finally {
      await closeHarness(h);
    }
  });

  test('delete a step removes it and preserves order', async () => {
    const h = await openRecordingPage();

    try {
      await startRecording(h);
      await h.page.fill('#fullName', 'Alicia Tan');
      await h.page.fill('#email', 'alicia@example.com');
      await h.page.click('#submitBtn');
      await h.page.waitForTimeout(3_000);
      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 3);
      // Allow the capture pipeline to fully drain before snapshotting.
      await h.page.waitForTimeout(2_000);
      const drained = await listSteps(h.rc, h.rc.projectSlug);
      await stopRecording(h);

      const emailStepId = drained[1].StepId;
      const submitName = drained[drained.length - 1].VariableName;
      const beforeCount = drained.length;
      await deleteStep(h.rc, h.rc.projectSlug, emailStepId);

      const listed = await listSteps(h.rc, h.rc.projectSlug);
      expect(listed).toHaveLength(beforeCount - 1);
      expect(listed.some((s) => s.StepId === emailStepId)).toBe(false);
      // Relative order preserved (sorted by OrderIndex).
      const ordered = [...listed].sort((a, b) => a.OrderIndex - b.OrderIndex);
      expect(ordered[ordered.length - 1].VariableName).toBe(submitName);

      // Replay skips the deleted email fill: submitted email is empty.
      await gotoFixture(h.page, `${server.baseUrl}/recorder-form.html`);
      await replaySteps(h.page, h.rc, h.rc.projectSlug, listed);
      const status = await h.page.locator('#formStatus').textContent();
      expect(status).toContain('name=Alicia Tan');
      expect(status).toContain('email=|');
    } finally {
      await closeHarness(h);
    }
  });

  test('insert a custom step, then replay the edited sequence', async () => {
    const h = await openRecordingPage();

    try {
      await startRecording(h);
      await h.page.fill('#fullName', 'Alicia Tan');
      await h.page.click('#submitBtn');
      await h.page.waitForTimeout(3_000);
      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 2);
      await stopRecording(h);

      // Splice a custom email fill between the name fill and submit:
      // delete submit, insert the email step, re-insert submit.
      const submitExpr = await primaryExpression(h, steps[1]);
      await deleteStep(h.rc, h.rc.projectSlug, steps[1].StepId);
      await insertStep(
        h.rc,
        h.rc.projectSlug,
        xpathDraft(2, 'InsertedEmail', '<input> email', '//*[@id="email"]', 'inserted@example.com'),
      );
      await insertStep(
        h.rc,
        h.rc.projectSlug,
        xpathDraft(1, 'SubmitFormAgain', '<button> Submit Form', submitExpr),
      );

      const listed = await listSteps(h.rc, h.rc.projectSlug);
      expect(listed).toHaveLength(3);
      expect(listed.map((s) => s.VariableName)).toEqual([
        steps[0].VariableName,
        'InsertedEmail',
        'SubmitFormAgain',
      ]);

      await gotoFixture(h.page, `${server.baseUrl}/recorder-form.html`);
      await replaySteps(h.page, h.rc, h.rc.projectSlug, listed);
      const status = await h.page.locator('#formStatus').textContent();
      expect(status).toBe(
        'SUBMITTED:name=Alicia Tan|email=inserted@example.com|phone=|country=|newsletter=no|notes=',
      );
    } finally {
      await closeHarness(h);
    }
  });

  test('reorder via delete and re-insert changes the replayed outcome', async () => {
    const h = await openRecordingPage();

    try {
      await startRecording(h);
      await h.page.fill('#fullName', 'Alicia Tan');
      await h.page.click('#submitBtn');
      await h.page.waitForTimeout(3_000);
      const steps = await waitForSteps(h.rc, h.rc.projectSlug, 2);
      await stopRecording(h);

      // Reverse the order: submit (empty form) first, then the name fill.
      const nameExpr = await primaryExpression(h, steps[0]);
      const submitExpr = await primaryExpression(h, steps[1]);
      await deleteStep(h.rc, h.rc.projectSlug, steps[0].StepId);
      await deleteStep(h.rc, h.rc.projectSlug, steps[1].StepId);
      await insertStep(
        h.rc,
        h.rc.projectSlug,
        xpathDraft(1, 'SubmitFirst', '<button> Submit Form', submitExpr),
      );
      await insertStep(
        h.rc,
        h.rc.projectSlug,
        xpathDraft(2, 'FillNameLast', '<input> name', nameExpr, 'Alicia Tan'),
      );

      const listed = await listSteps(h.rc, h.rc.projectSlug);
      expect(listed.map((s) => s.VariableName)).toEqual(['SubmitFirst', 'FillNameLast']);

      await gotoFixture(h.page, `${server.baseUrl}/recorder-form.html`);
      await replaySteps(h.page, h.rc, h.rc.projectSlug, listed);
      const status = await h.page.locator('#formStatus').textContent();
      // Submit ran before the fill, so the submitted name is empty.
      expect(status).toBe(
        'SUBMITTED:name=|email=|phone=|country=|newsletter=no|notes=',
      );
    } finally {
      await closeHarness(h);
    }
  });
});
