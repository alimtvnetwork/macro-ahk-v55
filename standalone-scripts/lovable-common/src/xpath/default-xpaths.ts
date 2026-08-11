import { XPathKeyCodeType } from "./xpath-key-code";

/**
 * DefaultXPaths — code-side source of truth restored on Reset.
 *
 * Captured from spec/.../70-lovable-owner-switch/03-xpaths-and-defaults.md
 * and spec/.../71-lovable-user-add/01-overview.md (identical defaults).
 */
export const DefaultXPaths: Readonly<Record<XPathKeyCodeType, string>> = Object.freeze({
  [XPathKeyCodeType.LoginEmailInput]: "/html/body/div[2]/div[1]/div/div[1]/main/div[2]/div/div/form/div/div[1]/div/input",
  [XPathKeyCodeType.ContinueButton]: "/html/body/div[2]/div[1]/div/div[1]/main/div[2]/div/div/form/div/div[2]/div[1]/div/button",
  [XPathKeyCodeType.PasswordInput]: "/html/body/div[2]/div[1]/div/div[1]/main/div[2]/div/div/form/div/div[1]/div[3]/input",
  [XPathKeyCodeType.LoginButton]: "/html/body/div[2]/div[1]/div/div[1]/main/div[2]/div/div/form/div/div[2]/div[1]/div[1]/button",
  [XPathKeyCodeType.WorkspaceButton]: "/html/body/div[2]/div[1]/div[2]/aside/div/div[2]/button",
  [XPathKeyCodeType.SettingsButton]: "/html/body/div[5]/div/div[2]/button[1]",
  [XPathKeyCodeType.ProfileButton]: "/html/body/div[2]/div[1]/div[2]/aside/div/div[4]/button",
  [XPathKeyCodeType.SignOutButton]: "/html/body/div[5]/div/div[7]",
});
