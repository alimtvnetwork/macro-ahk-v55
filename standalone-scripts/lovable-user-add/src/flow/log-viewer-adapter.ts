/**
 * User Add — log → viewer adapter.
 *
 * Maps `UserAddLogEntry` (Phase = StepA/StepB/Row/Task/SignOut) into
 * the shared `LogViewerEntry` shape. P17 contract: Step A and Step B
 * remain distinguishable because their phase strings carry through
 * unchanged into the viewer's filter dropdown — no text parsing.
 */

import { LogViewerSeverityCodeType } from "../../../lovable-common/src/ui/log-viewer-types";
import type { LogViewerEntry } from "../../../lovable-common/src/ui/log-viewer-types";
import { UserAddLogSeverityType } from "./log-sink";
import type { UserAddLogEntry } from "./log-sink";

const mapSeverity = (severity: UserAddLogSeverityType): LogViewerSeverityCodeType => {
    if (severity === UserAddLogSeverityType.Error) {
        return LogViewerSeverityCodeType.Error;
    }

    if (severity === UserAddLogSeverityType.Warn) {
        return LogViewerSeverityCodeType.Warn;
    }

    return LogViewerSeverityCodeType.Info;
};

export const toUserAddLogViewerEntries = (
    entries: ReadonlyArray<UserAddLogEntry>,
): ReadonlyArray<LogViewerEntry> => {
    return entries.map((e) => ({
        TimestampUtc: e.TimestampUtc,
        Phase: e.Phase,
        RowIndex: e.RowIndex,
        Severity: mapSeverity(e.Severity),
        Message: e.Message,
    }));
};
