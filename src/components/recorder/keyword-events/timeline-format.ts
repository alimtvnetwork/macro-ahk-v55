/**
 * Marco Extension, Keyword Events, Timeline formatting helpers
 *
 * Split from `TimelineRow.tsx` (Plan 25 step 10) so the component module
 * only exports components (`react-refresh/only-export-components`).
 */

export function formatOffset(ms: number): string {
    const total = Math.max(0, Math.floor(ms));
    const seconds = Math.floor(total / 1000);
    const remainder = total % 1000;
    const padded = remainder.toString().padStart(3, "0");
    return `${seconds.toString().padStart(2, "0")}.${padded}s`;
}
