const fs = require('fs');

const files = [
    "src/background/handlers/library-handler.ts",
    "src/background/handlers/logging-export-handler.ts",
    "src/background/handlers/logging-handler.ts",
    "src/background/handlers/logging-queries.ts"
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (!content.includes('ServiceResult.wrapDb')) {
        content = `import { ServiceResult } from '@/utils/result-wrapper';\n` + content;
        changed = true;
    }

    const regex = /db\.(run|exec|prepare)\s*\(/g;
    let match;
    let replacements = [];

    while ((match = regex.exec(content)) !== null) {
        const startIdx = match.index;
        const method = match[1];
        
        const before = content.slice(Math.max(0, startIdx - 30), startIdx);
        if (before.includes('ServiceResult.wrapDb(() => ')) {
            continue;
        }

        let i = match.index + match[0].length;
        let pCount = 1;
        let inString = false;
        let stringChar = '';

        while (i < content.length && pCount > 0) {
            const char = content[i];
            if (inString) {
                if (char === '\\') i++;
                else if (char === stringChar) inString = false;
            } else {
                if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') pCount++;
                else if (char === ')') pCount--;
            }
            i++;
        }

        const fullMatch = content.slice(startIdx, i);
        let replacement = '';
        if (method === 'run') {
            replacement = `ServiceResult.wrapDb(() => ${fullMatch})`;
        } else if (method === 'exec') {
            replacement = `(ServiceResult.wrapDb(() => ${fullMatch}).data ?? [])`;
        } else if (method === 'prepare') {
            replacement = `ServiceResult.wrapDb(() => ${fullMatch}).data!`;
        }

        replacements.push({ start: startIdx, end: i, replacement });
    }

    for (let j = replacements.length - 1; j >= 0; j--) {
        const rep = replacements[j];
        content = content.slice(0, rep.start) + rep.replacement + content.slice(rep.end);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Refactored ${file}`);
    }
}
