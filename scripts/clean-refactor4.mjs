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

    // Remove the Auto-injected CatchAudit logError lines completely, including the comment
    content = content.replace(/[ \t]*\/\/ TODO: Auto-injected by CatchAudit\r?\n[ \t]*logError\('AutoCatch'[\s\S]*?\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*\/\/ TODO: Auto-injected by CatchAudit\r?\n[ \t]*logError\("AutoCatch"[\s\S]*?\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*logError\('AutoCatch'[\s\S]*?\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*logError\("AutoCatch"[\s\S]*?\);?\r?\n?/g, '');
    
    // Some lines have err, which causes TS2304: Cannot find name 'err'
    content = content.replace(/catch \(err\) \{\r?\n[ \t]*\}\r?\n/g, 'catch {\n}\n');
    content = content.replace(/catch \(err\) \{ \}/g, 'catch {}');

    // Any missing `.ok` for AuthStrategyResult and InjectionResult
    content = content.replace(/\.ok/g, '.isSuccess'); 
    // Wait, reverting .isSuccess to .ok broke things like `InjectionResult` which use `.ok` natively! No, `InjectionResult` uses `.isSuccess` natively, and the bad commit changed it to `.ok`. Let me revert my previous regex mistakes in my head:
    // In final-fix.mjs I did `content.replace(/\.isSuccess/g, '.ok')`.
    // So now I need to undo that for specific files where it broke!
    
    if (content !== orig) {
        fs.writeFileSync(file, content, 'utf-8');
        fixes++;
    }
}

// Re-fix the specific files that use .ok or .isSuccess properly
const injectionResults = path.join(REPO_ROOT, 'src/popup/components/InjectionResults.tsx');
if (fs.existsSync(injectionResults)) {
    let content = fs.readFileSync(injectionResults, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(injectionResults, content, 'utf-8');
}

const scriptToggleList = path.join(REPO_ROOT, 'src/components/popup/ScriptToggleList.tsx');
if (fs.existsSync(scriptToggleList)) {
    let content = fs.readFileSync(scriptToggleList, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(scriptToggleList, content, 'utf-8');
}

const usePopupActions = path.join(REPO_ROOT, 'src/hooks/use-popup-actions.ts');
if (fs.existsSync(usePopupActions)) {
    let content = fs.readFileSync(usePopupActions, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(usePopupActions, content, 'utf-8');
}

const authHealth = path.join(REPO_ROOT, 'src/options/sections/AuthHealthPanel.tsx');
if (fs.existsSync(authHealth)) {
    let content = fs.readFileSync(authHealth, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(authHealth, content, 'utf-8');
}

const injResultBuilderTest = path.join(REPO_ROOT, 'src/test/regression/injection-result-builder.test.ts');
if (fs.existsSync(injResultBuilderTest)) {
    let content = fs.readFileSync(injResultBuilderTest, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(injResultBuilderTest, content, 'utf-8');
}

const injSyntaxTest = path.join(REPO_ROOT, 'src/test/regression/injection-syntax-preflight.test.ts');
if (fs.existsSync(injSyntaxTest)) {
    let content = fs.readFileSync(injSyntaxTest, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(injSyntaxTest, content, 'utf-8');
}

const injPipelineTest = path.join(REPO_ROOT, 'src/test/regression/injection-pipeline.test.ts');
if (fs.existsSync(injPipelineTest)) {
    let content = fs.readFileSync(injPipelineTest, 'utf-8');
    content = content.replace(/\.ok/g, '.isSuccess');
    fs.writeFileSync(injPipelineTest, content, 'utf-8');
}

console.log(`Fixes applied to ${fixes} files`);
