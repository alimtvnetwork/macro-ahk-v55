/**
 * Marco Extension — URL Fingerprinting
 *
 * Produces a stable, hash-free fingerprint string for a URL so the
 * decision cache can detect "same effective URL" across the three
 * allowed re-evaluation triggers (initial load, refresh, tab change)
 * without re-running `evaluateUrlMatches()`.
 *
 * Rules (spec: 2026-05-16 URL trigger & energy audit):
 *   • origin + pathname are case-sensitive (browsers treat them that way)
 *   • search params are sorted alphabetically and re-joined — `?a=1&b=2`
 *     and `?b=2&a=1` MUST produce the same fingerprint
 *   • the hash fragment is ALWAYS stripped — SPA hash-only navigation
 *     does not change which scripts apply
 *   • malformed URLs fall back to the raw string (still deterministic
 *     and dedup-friendly) so a parse failure never silently bypasses
 *     the dedup gate
 *
 * Returned value is opaque — callers must compare with strict `===`
 * and treat it as a black-box key. Do NOT parse or display it.
 */

/** Returns a stable fingerprint for URL dedup. */
export function urlFingerprint(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        const sortedSearch = sortSearchParams(parsed.searchParams);
        return `${parsed.origin}${parsed.pathname}${sortedSearch}`;
    } catch {
        return rawUrl;
    }
}

/** Sorts URLSearchParams alphabetically and serializes back to a leading-`?` string (or empty). */
function sortSearchParams(params: URLSearchParams): string {
    const entries: Array<[string, string]> = [];
    params.forEach((value, key) => {
        entries.push([key, value]);
    });

    const hasParams = entries.length > 0;
    if (!hasParams) {
        return "";
    }

    entries.sort(compareEntries);

    const sorted = new URLSearchParams();
    for (const [key, value] of entries) {
        sorted.append(key, value);
    }
    return `?${sorted.toString()}`;
}

/** Tuple comparator: key first, then value, both lexicographic. */
function compareEntries(a: [string, string], b: [string, string]): number {
    const keyDelta = a[0].localeCompare(b[0]);
    if (keyDelta !== 0) {
        return keyDelta;
    }
    return a[1].localeCompare(b[1]);
}
