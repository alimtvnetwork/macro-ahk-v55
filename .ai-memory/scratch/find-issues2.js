const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '../../');

let countInverted = 0;
let countUnions = 0;
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
            let invertedMatches = content.match(/!\w+\.(?:isSuccess|ok)/g);
            let unionMatches = content.match(/type\s+\w+\s*=\s*['"][^'"]+['"]\s*\|/g);
            if (invertedMatches) {
                countInverted += invertedMatches.length;
                invertedFiles.push(fullPath);
            }
            if (unionMatches) {
                countUnions += unionMatches.length;
                unionFiles.push(fullPath);
            }
        }
    }
}
walk(rootDir);
console.log('Inverted checks:', countInverted, invertedFiles.length, 'files');
console.log('String unions:', countUnions, unionFiles.length, 'files');
