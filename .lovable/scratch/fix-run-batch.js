const fs = require('fs');
const file = 'src/background/recorder/step-library/run-batch.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/if \(outcome\.isSuccess\) succeeded\+\+; else failed\+\+;/g, "if (outcome.ok) succeeded++; else failed++;");
content = content.replace(/if \(outcome\.isFail && policy === "StopOnFailure"\) aborted = true;/g, "if (!outcome.ok && policy === 'StopOnFailure') aborted = true;");
fs.writeFileSync(file, content);
