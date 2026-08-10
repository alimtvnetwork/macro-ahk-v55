import { UrlMatchType } from "../../types/enums";
export type UrlMatchDialect = UrlMatchType;

export interface CompiledPattern {
    readonly Ok: true;
    readonly Test: (url: string) => boolean;
}
export interface CompiledPatternError {
    readonly Ok: false;
    readonly Detail: string;
}
export type CompileResult = CompiledPattern | CompiledPatternError;

const SCHEME_HOST_RE = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]+)(.*)$/i;

export function splitForCaseFold(url: string): { readonly Lead: string; readonly Tail: string } {
    const match = SCHEME_HOST_RE.exec(url);
    if (!match) return { Lead: "", Tail: url };
    const lead = (match[1] + match[2]).toLowerCase();

    return { Lead: lead, Tail: match[3] ?? "" };
}

function stripTrailingSlash(s: string): string {
    return s.endsWith("/") ? s.slice(0, -1) : s;
}

function globTokenAt(pattern: string, i: number): { readonly Out: string; readonly Advance: number } {
    const ch = pattern[i];
    if (ch !== "*") {
        return { Out: ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&"), Advance: 1 };
    }
    if (pattern[i + 1] === "*") return { Out: ".*", Advance: 2 };

    return { Out: "[^/]*", Advance: 1 };
}

function globToRegex(pattern: string): RegExp {
    let out = "^";
    let i = 0;
    while (i < pattern.length) {
        const tok = globTokenAt(pattern, i);
        out += tok.Out;
        i += tok.Advance;
    }

    return new RegExp(out + "$");
}

function compileExact(pattern: string): CompileResult {
    const want = stripTrailingSlash(pattern);
    const wantSplit = splitForCaseFold(want);

    return {
        Ok: true,
        Test: (url) => {
            const gotSplit = splitForCaseFold(stripTrailingSlash(url));

            return gotSplit.Lead === wantSplit.Lead && gotSplit.Tail === wantSplit.Tail;
        },
    };
}

function compilePrefix(pattern: string): CompileResult {
    const wantSplit = splitForCaseFold(pattern);

    return {
        Ok: true,
        Test: (url) => {
            const gotSplit = splitForCaseFold(url);
            if (wantSplit.Lead === "") return url.startsWith(pattern);
            if (!gotSplit.Lead.startsWith(wantSplit.Lead)) return false;

            return gotSplit.Tail.startsWith(wantSplit.Tail);
        },
    };
}

function compileGlob(pattern: string): CompileResult {
    const split = splitForCaseFold(pattern);
    if (split.Lead === "") {
        const re = globToRegex(pattern);

        return { Ok: true, Test: (url) => re.test(url) };
    }
    const tailRe = globToRegex(split.Tail);

    return {
        Ok: true,
        Test: (url) => {
            const gotSplit = splitForCaseFold(url);

            return gotSplit.Lead === split.Lead && tailRe.test(gotSplit.Tail);
        },
    };
}

function compileRegex(pattern: string): CompileResult {
    try {
        const re = new RegExp(pattern);

        return { Ok: true, Test: (url) => re.test(url) };
    } catch (err) {
        const detail = err instanceof Error ? err.message : "regex compile failed";

        return { Ok: false, Detail: detail };
    }
}

export function compileUrlPattern(
    pattern: string,
    dialect: UrlMatchDialect,
): CompileResult {
    if (pattern === "") return { Ok: false, Detail: "UrlPattern is empty" };
    switch (dialect) {
        case "Exact": return compileExact(pattern);
        case "Prefix": return compilePrefix(pattern);
        case "Glob": return compileGlob(pattern);
        case "Regex": return compileRegex(pattern);
        default: {
            const exhaust: never = dialect;

            return { Ok: false, Detail: `unknown dialect ${String(exhaust)}` };
        }
    }
}
