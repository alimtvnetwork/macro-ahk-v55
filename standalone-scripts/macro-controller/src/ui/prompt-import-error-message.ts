/**
 * prompt-import-error-message.ts
 *
 * Maps raw parser diagnostics from `parsePromptsText` into a short, user-
 * friendly headline + guidance line the Prompt Library modal shows in its
 * error banner. Keeps message shaping out of the modal file so it can be
 * unit-tested in isolation.
 *
 * Contract: input is the `errors` array returned by `parsePromptsText` plus
 * the source filename. Output is a `{ headline, hint }` pair where:
 *   - headline is <= ~80 chars, plain language, no stack traces
 *   - hint is an actionable next step (e.g. "expected a JSON file exported
 *     from Prompt Library")
 */

export interface FriendlyImportError {
    headline: string;
    hint: string;
}

const HINT_DEFAULT = 'Expected a JSON file exported from Prompt Library (Export button).';

export function buildFriendlyImportError(
    rawErrors: ReadonlyArray<string>,
    filename: string,
): FriendlyImportError {
    const first = (rawErrors[0] ?? '').trim();
    const safeName = filename && filename.trim() ? filename.trim() : 'the selected file';

    if (!first) {
        return {
            headline: 'Could not read ' + safeName + '.',
            hint: HINT_DEFAULT,
        };
    }

    // JSON.parse failure surfaced by parsePromptsText.
    if (first.toLowerCase().startsWith('failed to parse json')) {
        return {
            headline: safeName + " isn't valid JSON.",
            hint: HINT_DEFAULT,
        };
    }

    // Row-level rejections ("entries[3]: Invalid prompt schema..." /
    // "Row 2: Invalid prompt schema..."). Checked BEFORE the envelope-shape
    // branch so per-row messages that mention "entries[..]" aren't misrouted.
    if (/invalid prompt schema/i.test(first) || /requires name and text/i.test(first) || /^Row \d+/i.test(first) || /^\/entries\//i.test(first) || /^\/\d+\//.test(first)) {
        const rejected = rawErrors.length;
        return {
            headline: 'No importable prompts found in ' + safeName + '.',
            hint: rejected === 1
                ? 'Every row needs a non-empty "name" and a "text" string.'
                : rejected + ' rows were rejected. Each prompt needs a non-empty "name" and a "text" string.',
        };
    }

    // Envelope-shape failures from validatePromptsBundle.
    if (first.toLowerCase().includes('schemaversion') || first.toLowerCase().includes('entries')) {
        return {
            headline: safeName + " doesn't match the Prompt Library export format.",
            hint: 'Re-export from a supported build, or drop a bare array of prompts.',
        };
    }

    // Fallback: surface the raw first error but keep it terse.
    const trimmed = first.length > 140 ? first.slice(0, 137) + '...' : first;
    return { headline: 'Import failed: ' + trimmed, hint: HINT_DEFAULT };
}
