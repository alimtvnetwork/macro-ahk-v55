/**
 * prompt-token-guard.ts - `{{token}}` parity check (plan-14, step 6).
 *
 * Root cause this prevents: silent drift of parameterized variables when
 * a user edits a Plan or Next prompt body. If the old body contained
 * `{{count}}` and the edit accidentally renames or drops it, the
 * downstream renderer will inject a literal or crash at substitute
 * time. `assertParamTokensUnchanged` compares the multisets of
 * `{{...}}` tokens between `oldBody` and `newBody` and throws
 * `ParamTokenMismatch` on any divergence.
 *
 * Multiset semantics: three occurrences of `{{n}}` in old and three in
 * new is fine; two in old and three in new is a mismatch. Order does
 * NOT matter, whitespace inside `{{ ... }}` is normalized.
 */

/**
 * Matches BOTH parameter syntaxes the codebase uses today:
 *   `{{name}}` (plan-14 canonical, whitespace-tolerant)
 *   `${name}`  (existing bundled prompts under standalone-scripts/prompts/**)
 * Extracted key is the bare name so `{{N}}` and `${N}` are the same token.
 */
const TOKEN_RE = /\{\{\s*([A-Za-z0-9_.:-]+)\s*\}\}|\$\{\s*([A-Za-z0-9_.:-]+)\s*\}/g;

export class ParamTokenMismatch extends Error {
    constructor(message: string, public readonly added: string[], public readonly removed: string[]) {
        super(message);
        this.name = 'ParamTokenMismatch';
    }
}

export function extractParamTokens(body: string): string[] {
    const out: string[] = [];
    for (const m of body.matchAll(TOKEN_RE)) {
        out.push(m[1] ?? m[2]);
    }
    return out;
}

function toMultiset(tokens: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
}

function diffAdded(newSet: Map<string, number>, oldSet: Map<string, number>): string[] {
    const added: string[] = [];
    for (const [k, v] of newSet) {
        const gap = v - (oldSet.get(k) ?? 0);
        for (let i = 0; i < gap; i++) added.push(k);
    }
    return added;
}

function diffRemoved(newSet: Map<string, number>, oldSet: Map<string, number>): string[] {
    const removed: string[] = [];
    for (const [k, v] of oldSet) {
        const gap = v - (newSet.get(k) ?? 0);
        for (let i = 0; i < gap; i++) removed.push(k);
    }
    return removed;
}

/**
 * Options for `assertParamTokensUnchanged`.
 *
 * When the caller renames the configured replace key (plan-15), pass
 * `{ oldKey, newKey }` so the guard treats occurrences of `oldKey` in
 * `oldBody` as if they were already `newKey`. This allows a legitimate
 * rename to pass while any *other* token drift (count changes on the
 * renamed key, or diffs on unrelated tokens) still throws.
 */
export interface AssertOptions {
    oldKey?: string | undefined;
    newKey?: string | undefined;
}

function renameToken(tokens: string[], oldKey: string, newKey: string): string[] {
    if (!oldKey || !newKey || oldKey === newKey) return tokens;
    return tokens.map((t) => (t === oldKey ? newKey : t));
}

/**
 * Throws `ParamTokenMismatch` if the `{{token}}` multiset of `newBody`
 * differs from `oldBody`. Reorderings and whitespace inside `{{ ... }}`
 * are allowed. When `options.oldKey` and `options.newKey` differ, the
 * old key is normalized to the new key in `oldBody` before comparison.
 */
export function assertParamTokensUnchanged(
    oldBody: string,
    newBody: string,
    options: AssertOptions = {},
): void {
    const rawOld = extractParamTokens(oldBody);
    const normalizedOld = renameToken(rawOld, options.oldKey ?? '', options.newKey ?? '');
    const oldSet = toMultiset(normalizedOld);
    const newSet = toMultiset(extractParamTokens(newBody));
    const added = diffAdded(newSet, oldSet);
    const removed = diffRemoved(newSet, oldSet);
    if (added.length === 0 && removed.length === 0) return;
    const parts: string[] = [];
    if (added.length > 0) parts.push('added: {{' + added.join('}}, {{') + '}}');
    if (removed.length > 0) parts.push('removed: {{' + removed.join('}}, {{') + '}}');
    throw new ParamTokenMismatch('ParamTokenMismatch: ' + parts.join('; '), added, removed);
}

