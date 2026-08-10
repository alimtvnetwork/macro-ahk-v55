import { XPathKeyCodeType } from "./xpath-key-code";

/**
 * DefaultDelaysMs — wait-after-action defaults per XPath key.
 *
 * Conservative values; user-editable in popup, persisted to
 * `XPathSetting.DelayMs`, restored from this map on Reset.
 */
export const DefaultDelaysMs: Readonly<Record<XPathKeyCodeType, number>> = Object.freeze({
    [XPathKeyCodeType.LoginEmailInput]: 400,
    [XPathKeyCodeType.ContinueButton]: 800,
    [XPathKeyCodeType.PasswordInput]: 400,
    [XPathKeyCodeType.LoginButton]: 1500,
    [XPathKeyCodeType.WorkspaceButton]: 2000,
    [XPathKeyCodeType.SettingsButton]: 600,
    [XPathKeyCodeType.ProfileButton]: 600,
    [XPathKeyCodeType.SignOutButton]: 1200,
});
