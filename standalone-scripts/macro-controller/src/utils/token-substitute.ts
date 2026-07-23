/**
 * token-substitute.ts - plan-15 step 7.
 *
 * Single substitution helper for the plan/next chips. Replaces every
 * `{{key}}` AND `${key}` occurrence in `body` with `value`, using the
 * caller-supplied `key` from the DB `ReplaceKey` column. Whitespace inside
 * `{{ ... }}` / `${ ... }` is tolerated so `{{ n }}` and `{{n}}` both
 * substitute. Legacy Plan/Next rows are also tolerated when the stored
 * ReplaceKey drifted between `N` and `n`, because old database rows can keep
 * the uppercase key while the current bundled default body uses lowercase.
 *
 * Root cause this fixes: the plan/next resolvers previously called
 * `.split('{{n}}').join(value)`, which ignored (a) any user-renamed
 * `ReplaceKey` and (b) the `${key}` syntax used by bundled JSON
 * prompts. Centralizing the two-shape substitution here removes both
 * call-site drift risks and gives the chip a single audit surface.
 */

import { logError } from '../error-utils';

const KEY_RE_SAFE = /^[A-Za-z0-9_.:-]+$/;

function escapeForRegex(key: string): string {
    return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTokenRegex(key: string): RegExp {
    const k = escapeForRegex(key);
    // {{  key  }}  OR  ${  key  }
    return new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}|\\$\\{\\s*' + k + '\\s*\\}', 'g');
}

/**
 * Replace every `{{key}}` and `${key}` occurrence in `body` with
 * `String(value)`. If the key is legacy `N` or current `n`, both forms are
 * replaced so stale persisted rows cannot leak raw `{{n}}` into chat. Returns
 * `body` untouched when `key` is empty or
 * shape-invalid (logged, never thrown) so a corrupt DB row cannot
 * kill the chip.
 */
export function substituteToken(body: string, key: string, value: string | number): string {
    if (typeof body !== 'string' || body.length === 0) return body ?? '';
    if (typeof key !== 'string' || key.length === 0 || !KEY_RE_SAFE.test(key)) {
        logError('TokenSubstitute', 'invalid replace key; returning body unchanged', { key });
        return body;
    }
    const valueText = String(value);
    const primary = body.replace(buildTokenRegex(key), valueText);
    // n/N alias substitution (case-insensitive) for legacy DB rows.
    const alternateKey = key === 'n' ? 'N' : key === 'N' ? 'n' : '';
    const aliased = alternateKey ? primary.replace(buildTokenRegex(alternateKey), valueText) : primary;
    return aliased;
}
