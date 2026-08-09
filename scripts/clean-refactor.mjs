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
let fixedFiles = 0;

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    // 1. Remove badly injected logError("AutoCatch", ...)
    content = content.replace(/[\s]*logError\("AutoCatch", "Unhandled exception", [^)]+\);/g, '');
    
    // 2. Fix variable redeclarations
    content = content.replace(/const isMissingIsOk = !isOk;[\s\n]*if\s*\(\s*isMissingIsOk\s*\)/g, 'if (!isOk)');
    content = content.replace(/const isMissingToken = !token;[\s\n]*if\s*\(\s*isMissingToken\s*\)/g, 'if (!token)');
    content = content.replace(/const isMissingMethod = !method;[\s\n]*if\s*\(\s*isMissingMethod\s*\)/g, 'if (!method)');
    content = content.replace(/const isMissingPanel = !panel;[\s\n]*if\s*\(\s*isMissingPanel\s*\)/g, 'if (!panel)');

    // 3. Fix Duplicate Enum Keys manually for the two known enums
    if (file.endsWith('src\\types\\enums.ts') || file.endsWith('src/types/enums.ts')) {
        content = content.replace(/export const DelimiterEnum = \{ _: ",", _: ";" \} as const;/g, 
                                  'export const DelimiterEnum = { COMMA: ",", SEMICOLON: ";" } as const;');
    }
    if (file.endsWith('standalone-scripts\\macro-controller\\src\\types\\enums.ts') || file.endsWith('standalone-scripts/macro-controller/src/types/enums.ts')) {
        content = content.replace(/export const ExtLogLevelType = \{ DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error", SUCCESS: "success", DELEGATE: "delegate", CHECK: "check", SKIP: "skip", SUB: "sub", INFO: "INFO", ERROR: "ERROR", WARN: "WARN", DEBUG: "DEBUG", SUB: "SUB" \} as const;/g, 
                                  'export const ExtLogLevelType = { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error", SUCCESS: "success", DELEGATE: "delegate", CHECK: "check", SKIP: "skip", SUB: "sub" } as const;');
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles++;
    }
}
console.log(`Clean script applied to ${fixedFiles} files.`);
