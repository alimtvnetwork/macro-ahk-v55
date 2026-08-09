import fs from 'fs';
import path from 'path';

const REPO_ROOT = 'd:\\work\\macro-ahk';

function walk(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (file === "node_modules" || file === ".git" || file === "dist") continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, files);
        } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = walk(REPO_ROOT);
let fixes = 0;

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let orig = content;

    // 1. Remove all logError("AutoCatch" blocks entirely.
    content = content.replace(/[ \t]*logError\([\s\S]*?"AutoCatch"[\s\S]*?\);?\r?\n?/g, '');

    // 2. Fix duplicate DbResult declarations (it was injected multiple times)
    content = content.replace(/export type DbResult<T> = ServiceResult<T, string>;\r?\n?/g, '');
    
    // 3. Fix isSuccess/isFail on TrackedMessage, WasmProbeSnapshot, BundleValidationResult
    // First, fix '!foo.isFail' -> 'foo.ok'
    content = content.replace(/!([a-zA-Z0-9_.]+)\.isFail/g, '$1.ok');
    // Then 'foo.isFail' -> '!foo.ok'
    content = content.replace(/([a-zA-Z0-9_.]+)\.isFail/g, '!$1.ok');
    // And 'foo.isSuccess' -> 'foo.ok'
    content = content.replace(/\.isSuccess/g, '.ok');

    if (content !== orig) {
        fs.writeFileSync(file, content, 'utf-8');
        fixes++;
    }
}

// Special fixes for specific files:
const dbManager = path.join(REPO_ROOT, 'src/background/db-manager.ts');
if (fs.existsSync(dbManager)) {
    let content = fs.readFileSync(dbManager, 'utf-8');
    content = content.replace(/ServiceResult\.wrapFetch\((await fetch\([^)]+\))\)/g, '$1');
    content = content.replace(/ServiceResult\.wrapFetch\((await fetch\([^)]+\, \{[\s\S]*?\}\))\)/g, '$1');
    fs.writeFileSync(dbManager, content, 'utf-8');
}

const projDbManager = path.join(REPO_ROOT, 'src/background/project-db-manager.ts');
if (fs.existsSync(projDbManager)) {
    let content = fs.readFileSync(projDbManager, 'utf-8');
    content = content.replace(/ServiceResult\.wrapFetch\((await fetch\([^)]+\))\)/g, '$1');
    content = content.replace(/ServiceResult\.wrapFetch\((await fetch\([^)]+\, \{[\s\S]*?\}\))\)/g, '$1');
    fs.writeFileSync(projDbManager, content, 'utf-8');
}

console.log(`Fixes applied to ${fixes} files`);
