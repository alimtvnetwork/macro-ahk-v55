import fs from 'fs';
import path from 'path';

const REPO_ROOT = 'd:\\work\\macro-ahk';

const filesToFix = [
    'standalone-scripts/macro-controller/src/db/prompt-role-db.ts',
    'standalone-scripts/macro-controller/src/db/sql-bridge.ts',
    'standalone-scripts/macro-controller/src/seed/prompt-health-check.ts',
    'standalone-scripts/macro-controller/src/seed/reseed-command.ts',
    'standalone-scripts/macro-controller/src/seed/seed-plan-next.ts',
    'standalone-scripts/macro-controller/src/shared-state.ts',
    'standalone-scripts/macro-controller/src/toast.ts',
    'standalone-scripts/macro-controller/src/ui/error-overlay.ts',
    'standalone-scripts/macro-controller/src/ui/extension-relay.ts'
];

for (const file of filesToFix) {
    const fullPath = path.join(REPO_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Exact match for the injected logError
    content = content.replace(/[ \t]*logError\(ERROR_CONTEXT_AUTOCATCH, ERROR_MSG_UNHANDLED, err\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*logError\(ERROR_CONTEXT_AUTOCATCH, ERROR_MSG_UNHANDLED, _err\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*logError\('AutoCatch', 'Unhandled exception', err\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*logError\('AutoCatch', 'Unhandled exception', _err\);?\r?\n?/g, '');
    content = content.replace(/[ \t]*\/\/ TODO: Auto-injected by CatchAudit\r?\n?/g, '');
    
    // Clean up empty catch blocks
    content = content.replace(/[ \t]*catch \(err\) \{\r?\n[ \t]*\}\r?\n?/g, 'catch {}\n');
    content = content.replace(/[ \t]*catch \(_err\) \{\r?\n[ \t]*\}\r?\n?/g, 'catch {}\n');
    content = content.replace(/[ \t]*catch \(err\) \{ \}\r?\n?/g, 'catch {}\n');

    fs.writeFileSync(fullPath, content, 'utf-8');
}

// 1. prompt-role-db.ts specific fixes
const promptRoleDb = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/db/prompt-role-db.ts');
if (fs.existsSync(promptRoleDb)) {
    let content = fs.readFileSync(promptRoleDb, 'utf-8');
    content = content.replace(/catch \(e\) \{\s*\}/g, 'catch(e) { return DbResult.fail(String(e)); }');
    fs.writeFileSync(promptRoleDb, content, 'utf-8');
}

// 2. prompt-health-check.ts specific fixes
const promptHealthCheck = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/seed/prompt-health-check.ts');
if (fs.existsSync(promptHealthCheck)) {
    let content = fs.readFileSync(promptHealthCheck, 'utf-8');
    content = content.replace(/\.value/g, '.data');
    fs.writeFileSync(promptHealthCheck, content, 'utf-8');
}

// 3. reseed-command.ts specific fixes
const reseedCommand = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/seed/reseed-command.ts');
if (fs.existsSync(reseedCommand)) {
    let content = fs.readFileSync(reseedCommand, 'utf-8');
    content = content.replace(/let report = \{\};/g, 'let report: any = {};');
    fs.writeFileSync(reseedCommand, content, 'utf-8');
}

// 4. shared-state.ts specific fixes
const sharedState = path.join(REPO_ROOT, 'standalone-scripts/macro-controller/src/shared-state.ts');
if (fs.existsSync(sharedState)) {
    let content = fs.readFileSync(sharedState, 'utf-8');
    // It's trying to assign to root?.Projects which is illegal. Let's fix the assignment.
    content = content.replace(/root\?\.Projects = /g, 'root.Projects = ');
    content = content.replace(/root\?\.Projects\?\.MacroController = /g, 'root.Projects.MacroController = ');
    fs.writeFileSync(sharedState, content, 'utf-8');
}

console.log("Fixes applied");
