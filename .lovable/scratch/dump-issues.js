const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '../../');

let invertedFiles = [];
let unionFiles = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === '.lovable' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let hasInverted = /!\w+\.(?:isSuccess|ok)/.test(content);
            let hasUnion = /type\s+\w+\s*=\s*['"][^'"]+['"]\s*\|/.test(content);
            if (hasInverted) invertedFiles.push(fullPath);
            if (hasUnion) unionFiles.push(fullPath);
        }
    }
}
walk(rootDir);
fs.writeFileSync(path.join(__dirname, 'issues.json'), JSON.stringify({ invertedFiles, unionFiles }, null, 2));
console.log('Issues written to issues.json');
