import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

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

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;

    // 1. Fix logError imports
    if (content.includes('logError(') && !content.includes('import { logError }')) {
        // Determine correct import path based on location
        let importPath = '';
        if (file.includes('standalone-scripts\\macro-controller') || file.includes('standalone-scripts/macro-controller')) {
            // relative to standalone-scripts/macro-controller/src/error-utils.ts
            const target = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/error-utils.ts');
            let rel = path.relative(path.dirname(file), target).replace(/\\/g, '/');
            if (!rel.startsWith('.')) rel = './' + rel;
            rel = rel.replace(/\.ts$/, '');
            importPath = `import { logError } from "${rel}";\n`;
        } else if (file.includes('src\\background') || file.includes('src/background')) {
            // relative to src/background/bg-logger.ts
            const target = path.join(REPO_ROOT, 'src/background/bg-logger.ts');
            let rel = path.relative(path.dirname(file), target).replace(/\\/g, '/');
            if (!rel.startsWith('.')) rel = './' + rel;
            rel = rel.replace(/\.ts$/, '');
            importPath = `import { logError } from "${rel}";\n`;
        } else {
            // default to lib-logger
            const target = path.join(REPO_ROOT, 'src/lib/lib-logger.ts');
            let rel = path.relative(path.dirname(file), target).replace(/\\/g, '/');
            if (!rel.startsWith('.')) rel = './' + rel;
            rel = rel.replace(/\.ts$/, '');
            importPath = `import { logError } from "${rel}";\n`;
        }
        
        content = importPath + content;
        changed = true;
    }

    // 2. Fix response.isSuccess / response.isFail back to response.ok
    // The broken commit replaced fetch().ok with fetch().isSuccess
    // We can't know for sure if it's a Response object, but in most cases where it fails, it's native fetch.
    // Actually, it's safer to fix the specific files.
    if (file.includes('db-manager.ts') || file.includes('project-db-manager.ts')) {
        if (content.includes('!response.isFail')) {
            content = content.replace(/!response\.isFail/g, 'response.ok');
            changed = true;
        }
        if (content.includes('response.isFail')) {
            content = content.replace(/response\.isFail/g, '!response.ok');
            changed = true;
        }
    }
    
    if (file.includes('credit-balance-fetcher.ts') || file.includes('input-source.ts')) {
        if (content.includes('response.isFail')) {
            content = content.replace(/response\.isFail/g, '!response.ok');
            changed = true;
        }
    }

    // 3. Fix variable redeclarations
    if (content.includes('const isMissingIsOk = !isOk;')) {
        // Just inline it!
        content = content.replace(/const isMissingIsOk = !isOk;\s*if\s*\(isMissingIsOk\)/g, 'if (!isOk)');
        changed = true;
    }
    if (content.includes('const isMissingToken = !token;')) {
        content = content.replace(/const isMissingToken = !token;\s*if\s*\(isMissingToken\)/g, 'if (!token)');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf-8');
    }
}

console.log("Auto-fix script completed.");
