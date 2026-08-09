const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, '../../src');

let countInverted = 0;
let countUnions = 0;
let invertedFiles = [];
let unionFiles = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let invertedMatches = content.match(/!\w+\.isSuccess/g);
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
walk(srcDir);
console.log('Inverted checks:', countInverted, invertedFiles.length, 'files');
console.log('String unions:', countUnions, unionFiles.length, 'files');
