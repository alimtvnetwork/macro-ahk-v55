const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
                walkDir(dirPath, callback);
            }
        } else if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
            callback(dirPath);
        }
    });
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    let modified = false;

    // Replace manual negative mapping: const isFailed = !resp.ok; -> const isFailed = resp.isFail;
    content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*!([a-zA-Z0-9_]+)\.ok;/g, (match, p1, p2) => {
        modified = true;
        return `const ${p1} = ${p2}.isFail;`;
    });

    // We can wrap `await fetch(...)` by matching parenthesis.
    // Let's do a simple replace: `!response.ok` -> `response.isFail`, etc.
    // And if `fetch` is used, we wrap the `fetch` manually where we see `.isFail` failing in the build.
    // But since the user wants a wrapper, let's wrap ALL `await fetch(...)` with `ServiceResult.wrapFetch(...)`.
    let newContent = "";
    let i = 0;
    while (i < content.length) {
        let idx = content.indexOf('await fetch(', i);
        if (idx === -1) {
            newContent += content.slice(i);
            break;
        }
        newContent += content.slice(i, idx);
        newContent += 'ServiceResult.wrapFetch(await fetch(';
        let pCount = 1;
        let j = idx + 12; // length of 'await fetch('
        while (j < content.length && pCount > 0) {
            if (content[j] === '(') pCount++;
            else if (content[j] === ')') pCount--;
            newContent += content[j];
            j++;
        }
        newContent += ')';
        i = j;
        modified = true;
    }
    content = newContent;

    // Wrap rawSql calls: `await rawSql(...)` -> `ServiceResult.wrap(await rawSql(...))`
    // Wait, rawSql returns an object with `.isOk`, not `.ok`. We should leave rawSql alone or wrap it properly.
    // Let's stick to the user's issue with `.ok`.

    // Replace !xxx.ok -> xxx.isFail
    content = content.replace(/!([a-zA-Z0-9_]+)\.ok/g, (match, p1) => {
        modified = true;
        return `${p1}.isFail`;
    });

    // Replace xxx.ok -> xxx.isSuccess
    content = content.replace(/([a-zA-Z0-9_]+)\.ok([^a-zA-Z0-9_])/g, (match, p1, p2) => {
        // Exclude assignments or if it's already "isSuccess"
        if (p2.startsWith(' =')) return match; 
        if (p1 === 'ServiceResult') return match;
        modified = true;
        return `${p1}.isSuccess${p2}`;
    });

    if (modified && original !== content) {
        // Try to guess import path
        const depth = filePath.replace(/\\/g, '/').split('src/')[1].split('/').length - 1;
        let importPath = depth === 0 ? './utils/result-wrapper' : '../'.repeat(depth) + 'utils/result-wrapper';
        
        if (!content.includes('ServiceResult')) {
            content = `import { ServiceResult } from '${importPath}';\n` + content;
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

walkDir('d:/work/macro-ahk/src', processFile);
walkDir('d:/work/macro-ahk/standalone-scripts/macro-controller/src', processFile);
