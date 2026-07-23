/**
 * End-to-end regression for the Read Memory (Enhanced) prompt.
 *
 * Root contract this test locks:
 *   1. Canonical (standalone-scripts/prompts/16-read-memory/prompt.md) and
 *      mirror (.lovable/prompts/05-read-memory.md) MUST be byte-identical.
 *      `scripts/check-prompt-mirrors.mjs` only checks existence, not content.
 *   2. The prompt is STATIC (no `ReplaceKey` in info.json). It MUST NOT
 *      contain any `{{token}}` / `${token}` placeholders — running
 *      substituteToken with any key is therefore a no-op and returns the
 *      body byte-for-byte. This guards against someone slipping a dynamic
 *      token into a static prompt (which would then paste raw `{{n}}` into
 *      the chat box, since the read-memory chip has no substitution wiring).
 *   3. Key structural anchors from v1.7 are present: version marker,
 *      the ambiguity folder rules, and the Completion Confirmation block.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { substituteToken } from '../../standalone-scripts/macro-controller/src/utils/token-substitute';

const ROOT = resolve(__dirname, '..', '..');
const CANONICAL = resolve(ROOT, 'standalone-scripts/prompts/16-read-memory/prompt.md');
const MIRROR = resolve(ROOT, '.lovable/prompts/05-read-memory.md');
const INFO = resolve(ROOT, 'standalone-scripts/prompts/16-read-memory/info.json');
const MIRROR_MANIFEST = resolve(ROOT, '.lovable/prompt-mirrors.json');
const GENERATED_PROMPTS = resolve(ROOT, 'standalone-scripts/macro-controller/03-macro-prompts.json');

interface ReadMemoryInfo {
    Version: string;
    Slug: string;
    ReplaceKey?: string;
}

interface MirrorEntry {
    canonical: string;
    slug: string;
}

interface MirrorManifest {
    mirrors: MirrorEntry[];
}

interface GeneratedPrompt {
    id: string;
    slug: string;
}

interface GeneratedPrompts {
    prompts: GeneratedPrompt[];
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf-8')) as T;

const canonicalBody = readFileSync(CANONICAL, 'utf-8');
const mirrorBody = readFileSync(MIRROR, 'utf-8');
const info = readJson<ReadMemoryInfo>(INFO);
const mirrorManifest = readJson<MirrorManifest>(MIRROR_MANIFEST);
const generatedPrompts = readJson<GeneratedPrompts>(GENERATED_PROMPTS);
const EXPECTED_SLUG = 'read-memory-enhanced';

const getMirrorSlug = (): string | undefined =>
    mirrorManifest.mirrors.find((entry) => entry.canonical === '16-read-memory')?.slug;

const getGeneratedSlug = (): string | undefined =>
    generatedPrompts.prompts.find((entry) => entry.id === 'default-read-memory')?.slug;

describe('read-memory prompt v1.7', () => {
    it('canonical and mirror are byte-identical', () => {
        expect(mirrorBody).toBe(canonicalBody);
    });

    it('info.json is marked v1.7.0 and static (no ReplaceKey)', () => {
        expect(info.Version).toBe('1.7.0');
        expect(info.Slug).toBe(EXPECTED_SLUG);
        expect('ReplaceKey' in info).toBe(false);
    });

    it('uses the same canonical slug across metadata, mirror manifest, body, and generated prompts', () => {
        expect(info.Slug).toBe(EXPECTED_SLUG);
        expect(getMirrorSlug()).toBe(EXPECTED_SLUG);
        expect(canonicalBody).toContain(`slug: ${EXPECTED_SLUG}`);
        expect(getGeneratedSlug()).toBe(EXPECTED_SLUG);
    });

    it('body has the v1.7 anchors (ambiguity paths + Completion Confirmation)', () => {
        expect(canonicalBody).toContain('version: 1.7');
        expect(canonicalBody).toContain('.lovable/ambiguous-questions/01-new-ambiguity/');
        expect(canonicalBody).toContain('.lovable/ambiguous-questions/02-ambiguity-resolved/');
        expect(canonicalBody).toContain('## Completion Confirmation');
        expect(canonicalBody).toContain('✅ Onboarding complete.');
    });

    it('is a STATIC prompt: no {{...}} or ${...} substitution tokens present', () => {
        // Guards against accidental token injection. If someone adds a
        // dynamic token here, they must also add ReplaceKey to info.json
        // and rewire the chip; the failing assertion forces that review.
        expect(canonicalBody).not.toMatch(/\{\{\s*[A-Za-z0-9_.:-]+\s*\}\}/);
        expect(canonicalBody).not.toMatch(/\$\{\s*[A-Za-z0-9_.:-]+\s*\}/);
    });

    it.each(['n', 'N', 'count', 'x'])(
        'substituteToken with key %s is a no-op on a static prompt',
        (key) => {
            const rendered = substituteToken(canonicalBody, key, 42);
            expect(rendered).toBe(canonicalBody);
        },
    );
});
