/**
 * Lovable login flow — per-step executor.
 *
 * One narrow function per `LoginStepCodeType`. Each measures its own
 * duration and returns a `LoginStepOutcome`; throws bubble up to
 * `run-login` which records the failed step + XPath in the row's
 * `LastError`.
 */

import { XPathKeyCodeType } from "../../../lovable-common/src/xpath/xpath-key-code";
import { fillInput, clickButton } from "./dom-actions";
import { waitForXPath } from "./wait-for-xpath";
import { resolveXPath } from "./xpath-resolver";
import { LoginStepCodeType } from "./login-types";
import type { LoginStepOutcome, LoginCredentials } from "./login-types";
import type { XPathSettingSeed } from "../migrations/xpath-setting-seed";

const NAVIGATE_DELAY_MS = 50;

const measure = async (step: LoginStepCodeType, run: () => Promise<void> | void): Promise<LoginStepOutcome> => {
    const startedAt = Date.now();
    await Promise.resolve(run());

    return { Step: step, DurationMs: Date.now() - startedAt };
};

export const stepNavigate = (loginUrl: string): Promise<LoginStepOutcome> => {
    return measure(LoginStepCodeType.NavigateToLogin, (): void => {
        if (globalThis.location.href !== loginUrl) {
            globalThis.location.assign(loginUrl);
        }
    }).then(async (outcome): Promise<LoginStepOutcome> => {
        await new Promise<void>((r) => globalThis.setTimeout(r, NAVIGATE_DELAY_MS));

        return outcome;
    });
};

export const stepFillEmail = (
    credentials: LoginCredentials,
    overrides: ReadonlyArray<XPathSettingSeed>,
): Promise<LoginStepOutcome> => {
    const resolved = resolveXPath(XPathKeyCodeType.LoginEmailInput, overrides);

    return measure(LoginStepCodeType.FillEmail, async (): Promise<void> => {
        await waitForXPath(resolved.XPath);
        fillInput(resolved.XPath, credentials.LoginEmail);
        await new Promise<void>((r) => globalThis.setTimeout(r, resolved.DelayMs));
    });
};

export const stepClick = (
    key: XPathKeyCodeType,
    stepCode: LoginStepCodeType,
    overrides: ReadonlyArray<XPathSettingSeed>,
): Promise<LoginStepOutcome> => {
    const resolved = resolveXPath(key, overrides);

    return measure(stepCode, async (): Promise<void> => {
        await waitForXPath(resolved.XPath);
        clickButton(resolved.XPath);
        await new Promise<void>((r) => globalThis.setTimeout(r, resolved.DelayMs));
    });
};

export const stepFillPassword = (
    credentials: LoginCredentials,
    overrides: ReadonlyArray<XPathSettingSeed>,
): Promise<LoginStepOutcome> => {
    const resolved = resolveXPath(XPathKeyCodeType.PasswordInput, overrides);

    return measure(LoginStepCodeType.FillPassword, async (): Promise<void> => {
        await waitForXPath(resolved.XPath);
        fillInput(resolved.XPath, credentials.Password);
        await new Promise<void>((r) => globalThis.setTimeout(r, resolved.DelayMs));
    });
};

export const stepAwaitWorkspace = (
    overrides: ReadonlyArray<XPathSettingSeed>,
): Promise<LoginStepOutcome> => {
    const resolved = resolveXPath(XPathKeyCodeType.WorkspaceButton, overrides);

    return measure(LoginStepCodeType.AwaitWorkspace, async (): Promise<void> => {
        await waitForXPath(resolved.XPath, { TimeoutMs: 30000 });
    });
};
