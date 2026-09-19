const fs = require('fs');

const data = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));
const issues = {
    'max-lines-per-function': [],
    'sonarjs/cognitive-complexity': [],
    'sonarjs/no-collapsible-if': [],
    'boolean-naming': [], // custom heuristic
};

data.forEach(file => {
    file.messages.forEach(msg => {
        if (msg.ruleId === 'max-lines-per-function') {
            issues['max-lines-per-function'].push(`${file.filePath}:${msg.line} - ${msg.message}`);
        } else if (msg.ruleId === 'sonarjs/cognitive-complexity') {
            issues['sonarjs/cognitive-complexity'].push(`${file.filePath}:${msg.line} - ${msg.message}`);
        } else if (msg.ruleId === 'sonarjs/no-collapsible-if') {
            issues['sonarjs/no-collapsible-if'].push(`${file.filePath}:${msg.line} - ${msg.message}`);
        }
    });
});

console.log("Max Lines Per Function:", issues['max-lines-per-function'].length);
console.log("Cognitive Complexity:", issues['sonarjs/cognitive-complexity'].length);
console.log("Nested Ifs (collapsible):", issues['sonarjs/no-collapsible-if'].length);
