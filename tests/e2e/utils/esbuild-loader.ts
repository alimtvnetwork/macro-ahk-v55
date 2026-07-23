import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ESBUILD_MAIN_PATH = path.join('node_modules', 'esbuild', 'lib', 'main.js');
const PNPM_PACKAGE_PREFIX = 'esbuild@';

interface EsbuildBuildOptions {
    entryPoints: readonly string[];
    bundle: boolean;
    platform: 'browser';
    format: 'iife';
    globalName: string;
    write: false;
    target: string;
    logLevel: 'silent';
    footer: { readonly js: string };
}

interface EsbuildOutputFile {
    readonly text: string;
}

interface EsbuildBuildResult {
    readonly errors: readonly object[];
    readonly outputFiles: readonly EsbuildOutputFile[];
}

interface EsbuildModule {
    build(options: EsbuildBuildOptions): Promise<EsbuildBuildResult>;
}

interface BundleBrowserIifeOptions {
    readonly entryPoint: string;
    readonly globalName: string;
    readonly footerJs: string;
}

function findDirectEsbuildEntry(repoRoot: string): string | undefined {
    const directEntry = path.join(repoRoot, ESBUILD_MAIN_PATH);
    return fs.existsSync(directEntry) ? directEntry : undefined;
}

function listPnpmEsbuildEntries(repoRoot: string): string[] {
    const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
    if (!fs.existsSync(pnpmDir)) return [];

    return fs.readdirSync(pnpmDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(PNPM_PACKAGE_PREFIX))
        .map(dirent => path.join(pnpmDir, dirent.name, ESBUILD_MAIN_PATH));
}

function resolveEsbuildEntry(repoRoot: string): string {
    const directEntry = findDirectEsbuildEntry(repoRoot);
    if (directEntry) return directEntry;

    const pnpmEntry = listPnpmEsbuildEntries(repoRoot).find(candidate => fs.existsSync(candidate));
    if (pnpmEntry) return pnpmEntry;

    throw new Error(`Cannot locate ${ESBUILD_MAIN_PATH}. Run pnpm install before Playwright E2E.`);
}

async function loadEsbuild(repoRoot: string): Promise<EsbuildModule> {
    const esbuildEntry = resolveEsbuildEntry(repoRoot);
    return import(pathToFileURL(esbuildEntry).href) as Promise<EsbuildModule>;
}

export async function bundleBrowserIife(
    repoRoot: string,
    options: BundleBrowserIifeOptions,
): Promise<string> {
    const esbuild = await loadEsbuild(repoRoot);
    const built = await esbuild.build({
        entryPoints: [options.entryPoint],
        bundle: true,
        platform: 'browser',
        format: 'iife',
        globalName: options.globalName,
        write: false,
        target: 'chrome110',
        logLevel: 'silent',
        footer: { js: options.footerJs },
    });

    if (built.errors.length > 0) {
        throw new Error('esbuild failed: ' + JSON.stringify(built.errors));
    }

    const firstOutputFile = built.outputFiles[0];
    if (!firstOutputFile) {
        throw new Error('esbuild emitted no bundled output file');
    }

    return firstOutputFile.text;
}