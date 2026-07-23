/**
 * Marco Extension — Step Group Library dialog block wrapper.
 *
 * Passthrough that forwards the six hook-return bags to the presentational
 * `LibraryDialogs`. Plan 25 · Step 8: after collapsing the flat 41-prop
 * surface into bags, this wrapper no longer needs to unpack anything.
 * Kept as a separate file so `StepGroupLibraryBody` can compose it with
 * the header + two-pane sections without any function exceeding the
 * ESLint `max-lines-per-function` ceiling.
 */

import { LibraryDialogs, type LibraryDialogsProps } from "./LibraryDialogs";

export function LibraryDialogSection(props: LibraryDialogsProps) {
    return <LibraryDialogs {...props} />;
}
