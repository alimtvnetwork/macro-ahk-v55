/**
 * Shared XPath Editor — types.
 *
 * Storage-agnostic: the editor accepts current rows and a save
 * callback. Owner Switch wires this against its `XPathSetting` SQLite
 * table; User Add wires the same against its own `XPathSetting` table.
 * Both projects share the `XPathKeyCodeType` enum from `lovable-common`.
 */

import type { XPathKeyCodeType } from "../xpath/xpath-key-code";

export interface XPathEditorRow {
    KeyCode: XPathKeyCodeType;
    XPath: string;
    DelayMs: number;
}

export interface XPathEditorOptions {
    InitialRows: ReadonlyArray<XPathEditorRow>;
    DefaultRows: ReadonlyArray<XPathEditorRow>;
    OnSave: (rows: ReadonlyArray<XPathEditorRow>) => void;
    OnReset?: () => void;
}
