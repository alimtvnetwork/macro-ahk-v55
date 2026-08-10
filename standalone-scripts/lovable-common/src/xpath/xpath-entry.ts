import { XPathKeyCodeType } from "./xpath-key-code";

/**
 * XPathEntry — typed shape for `XPathSetting` rows surfaced to runtime
 * code (PascalCase fields match the SQLite column names directly).
 */
export interface XPathEntry {
    KeyCode: XPathKeyCodeType;
    Value: string;
    DelayMs: number;
    IsCustomized: boolean;
}
